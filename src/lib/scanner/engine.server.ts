import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildSignal } from "./signal.server";
import { fetchFundamentals, fetchSymbolOhlcv } from "./yahoo.server";
import { MARKET_UNIVERSE, marketForSymbol } from "./universe";
import type { SignalDoc } from "./types";

const BATCH_PER_MARKET = 50;
const CONCURRENCY = 4;
/** Yarıda kesilen bir taramanın kilidi bu süre sonunda otomatik serbest bırakılır. */
const STALE_RUN_MS = 20 * 60 * 1000;

export async function getScannerState() {
  const { data } = await supabaseAdmin.from("scanner_state").select("*").eq("id", 1).maybeSingle();
  const startedAt = data?.started_at ? Date.parse(data.started_at) : null;
  const stale = startedAt !== null && Date.now() - startedAt > STALE_RUN_MS;
  return {
    running: Boolean(data?.running) && !stale,
    last_run: data?.last_run ?? null,
    last_error: data?.last_error ?? null,
    last_duration_seconds: data?.last_duration_seconds ?? null,
    last_scanned_count: data?.last_scanned_count ?? 0,
    cursor_index: data?.cursor_index ?? 0,
  };
}

type ScannerStatePatch = {
  running?: boolean;
  started_at?: string | null;
  last_run?: string | null;
  last_error?: string | null;
  last_duration_seconds?: number | null;
  last_scanned_count?: number;
  cursor_index?: number;
};

async function setScannerState(patch: ScannerStatePatch) {
  await supabaseAdmin.from("scanner_state").update(patch).eq("id", 1);
}

export async function storeSignal(doc: SignalDoc) {
  await supabaseAdmin.from("signals").upsert(
    {
      symbol: doc.symbol,
      market: doc.market,
      action: doc.action,
      bullish_score: doc.bullish_score,
      updated_at: new Date().toISOString(),
      doc: doc as never,
    },
    { onConflict: "symbol" },
  );
}

export async function fetchSignalDocument(symbol: string): Promise<SignalDoc | null> {
  const upper = symbol.toUpperCase();
  const { data } = await supabaseAdmin.from("signals").select("doc").eq("symbol", upper).maybeSingle();
  if (data?.doc) return data.doc as unknown as SignalDoc;
  if (!upper.endsWith(".IS")) {
    const { data: alt } = await supabaseAdmin
      .from("signals")
      .select("doc")
      .eq("symbol", `${upper}.IS`)
      .maybeSingle();
    if (alt?.doc) return alt.doc as unknown as SignalDoc;
  }
  return null;
}

export async function analyzeSymbol(symbol: string): Promise<SignalDoc | null> {
  const upper = symbol.toUpperCase();
  const bars = await fetchSymbolOhlcv(upper);
  if (!bars) return null;
  let fundamentals = await fetchFundamentals(upper);
  // Veri sağlayıcı temel verileri döndüremediğinde (401/429) skor sıfıra düşerdi ve aynı hisse
  // otomatik tarama ile manuel analizde farklı sonuç verirdi. Bu durumda son bilinen temel veri seti
  // yeniden kullanılır; böylece sonuçlar tekrarlanabilir olur.
  if (fundamentals.pe === null && fundamentals.current_ratio === null) {
    const previous = await fetchSignalDocument(upper);
    const cached = previous?.["fundamental"] as Record<string, any> | undefined;
    if (cached && (cached["pe"] !== null || cached["current_ratio"] !== null)) {
      fundamentals = { ...cached, notes: [...(cached["notes"] ?? []), "Temel veriler önbellekten alındı."] } as typeof fundamentals;
    }
  }
  const doc = buildSignal(upper, marketForSymbol(upper), bars, fundamentals);
  await storeSignal(doc);
  return doc;
}

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await worker(items[index]!);
      } catch (error) {
        console.error("scan item failed", error);
      }
    }
  });
  await Promise.all(runners);
}

/** Scans the next batch of the universe and rotates the cursor. */
export async function runScanBatch() {
  const state = await getScannerState();
  // Her turda her piyasadan BATCH_PER_MARKET adet hisse taranır (50 NASDAQ + 50 BIST).
  const start = state.cursor_index;
  const batch: Array<{ symbol: string; market: "US" | "BIST" }> = [];
  for (const market of ["US", "BIST"] as const) {
    const list = MARKET_UNIVERSE[market];
    for (let i = 0; i < Math.min(BATCH_PER_MARKET, list.length); i++) {
      batch.push({ symbol: list[(start + i) % list.length]!, market });
    }
  }
  const nextCursor = (start + BATCH_PER_MARKET) % Math.max(MARKET_UNIVERSE.US.length, MARKET_UNIVERSE.BIST.length);

  const began = Date.now();
  await setScannerState({ running: true, started_at: new Date().toISOString(), last_error: null });
  let scanned = 0;
  let lastError: string | null = null;

  try {
    await mapWithConcurrency(batch, CONCURRENCY, async ({ symbol }) => {
      // Veri sağlayıcı sınırlamalarında tek seferlik yeniden deneme.
      let doc = await analyzeSymbol(symbol).catch(() => null);
      if (!doc) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        doc = await analyzeSymbol(symbol).catch(() => null);
      }
      if (doc) scanned += 1;
    });
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await setScannerState({
    running: false,
    started_at: null,
    last_run: new Date().toISOString(),
    last_error: lastError,
    last_duration_seconds: (Date.now() - began) / 1000,
    last_scanned_count: scanned,
    cursor_index: nextCursor,
  });

  return { scanned, batch_size: batch.length, next_cursor: nextCursor };
}

export function buildLocalSummary(doc: Record<string, any>): string {
  const indicators = (doc["indicators"] ?? {}) as Record<string, unknown>;
  const fundamentals = (doc["fundamental"] ?? {}) as Record<string, unknown>;
  const risk = (doc["risk"] ?? {}) as Record<string, unknown>;
  const volume = (doc["volume_analysis"] ?? {}) as Record<string, unknown>;
  const patterns = (doc["patterns"] ?? []) as Array<Record<string, unknown>>;
  const confirmed = patterns.filter((p) => p["confirmed"]).map((p) => String(p["name"]));
  const patternText = confirmed.length ? confirmed.join(", ") : "Onaylı kırılım formasyonu henüz yok";

  return [
    `1. **Teknik Durum:** ${patternText}. RSI: ${indicators["rsi14"]} ve MACD: ${indicators["macd"]} seviyelerinde.`,
    `2. **Temel Durum:** P/E=${fundamentals["pe"]}, P/B=${fundamentals["pb"]}, Cari Oran=${fundamentals["current_ratio"]}.`,
    `3. **Hacim Durumu:** ${volume["human_text"] ?? "Hacim analizi hesaplanamadı."}`,
    `4. **Aksiyon ve Risk:** ${doc["action"]} sinyali. Giriş=${risk["entry_price"]}, Stop-Loss=${risk["stop_loss"]}, Take-Profit=${risk["take_profit"]}.`,
  ].join("\n");
}

export async function generateAiSummary(doc: Record<string, any>): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return buildLocalSummary(doc);

  const systemPrompt = [
    "Sen bir yatırım danışmanısın. Sana verilen ham skorları ve formasyonları analiz ederek 4 maddelik bir özet çıkar.",
    "Format:",
    "1. **Teknik Durum:** (Örn: Fiyat 50 günlük ortalamasından sekti ve Çift Dip formasyonu onaylandı.)",
    "2. **Temel Durum:** (Örn: F/K oranı sektörünün %15 altında.)",
    "3. **Hacim Durumu:** (Örn: Hacim son 10 gün ortalamasına göre %18 arttı.)",
    "4. **Aksiyon ve Risk:** (Örn: X fiyatından AL sinyali üretildi, Y stop-loss, Z take-profit.)",
  ].join("\n");

  const payload = {
    symbol: doc["symbol"],
    action: doc["action"],
    bullish_score: doc["bullish_score"],
    score_breakdown: doc["score_breakdown"],
    patterns: doc["patterns"],
    indicators: doc["indicators"],
    fundamental: doc["fundamental"],
    volume_analysis: doc["volume_analysis"],
    risk: doc["risk"],
  };

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "Aşağıdaki ham verileri analiz et ve sadece 4 maddelik formatta Türkçe yanıt üret. 4 başlık dışına çıkma.\nVeri:\n" +
              JSON.stringify(payload),
          },
        ],
      }),
    });
    if (!response.ok) return buildLocalSummary(doc);
    const json = (await response.json()) as any;
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : buildLocalSummary(doc);
  } catch {
    return buildLocalSummary(doc);
  }
}