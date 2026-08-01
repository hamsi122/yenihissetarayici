import { SECTOR_PE_BENCHMARK } from "./universe";
import type { Bar } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

/** Sunucu IP'leri Yahoo tarafından sık sık 429 ile engellendiği için okuma proxy'si yedek olarak kullanılır. */
async function readThroughProxy(url: string): Promise<any | null> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain", "X-Return-Format": "text" },
  });
  if (!response.ok) return null;
  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Yahoo quoteSummary uçları cookie + crumb ister; oturum süreç içinde önbelleklenir. */
let yahooSession: { cookie: string; crumb: string; createdAt: number } | null = null;

const isValidCrumb = (value: string) => /^[A-Za-z0-9._%\-\\/]{6,32}$/.test(value);

async function getYahooSession(force = false): Promise<{ cookie: string; crumb: string } | null> {
  if (!force && yahooSession && Date.now() - yahooSession.createdAt < 30 * 60 * 1000) {
    return yahooSession;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const seed = await fetch("https://fc.yahoo.com/", {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        redirect: "follow",
      });
      const setCookie =
        (seed.headers as any).getSetCookie?.().join(", ") ?? seed.headers.get("set-cookie") ?? "";
      const cookie = setCookie
        .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
        .map((part: string) => part.split(";")[0]!.trim())
        .filter(Boolean)
        .join("; ");
      if (cookie) {
        for (const host of HOSTS) {
          const crumbResponse = await fetch(`https://${host}/v1/test/getcrumb`, {
            headers: { "User-Agent": UA, Accept: "text/plain,*/*", Cookie: cookie },
          });
          const crumb = (await crumbResponse.text()).trim();
          if (crumbResponse.ok && isValidCrumb(crumb)) {
            yahooSession = { cookie, crumb, createdAt: Date.now() };
            return yahooSession;
          }
        }
      }
    } catch {
      // ağ hatasında yeniden dene
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  return null;
}

async function yahooGet(path: string, withCrumb = false): Promise<any | null> {
  for (const host of HOSTS) {
    for (let attempt = 0; attempt < (withCrumb ? 3 : 3); attempt++) {
      try {
        const session = withCrumb ? await getYahooSession(attempt > 0) : null;
        if (withCrumb && !session) break;
        const url = session
          ? `https://${host}${path}${path.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(session.crumb)}`
          : `https://${host}${path}`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": UA,
            Accept: "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://finance.yahoo.com/",
            ...(session ? { Cookie: session.cookie } : {}),
          },
        });
        if (response.ok) return await response.json();
        // 429/999: hız sınırı - kısa bekleme sonrası aynı host tekrar denenir.
        if (response.status === 429 || response.status === 999) {
          await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 900));
          continue;
        }
        if (response.status !== 401) break;
      } catch {
        // ağ hatasında sıradaki denemeye geç
      }
    }
  }
  return await readThroughProxy(`https://${HOSTS[0]}${path}`);
}

export async function fetchSymbolOhlcv(symbol: string): Promise<Bar[] | null> {
  const json = await yahooGet(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&includePrePost=false`,
  );
  if (!json) return null;
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return null;

  const bars: Bar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
    if ([open, high, low, close, volume].some((v) => v === null || v === undefined || !Number.isFinite(v))) {
      continue;
    }
    bars.push({
      date: new Date(timestamps[i]! * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
    });
  }
  const deduped = new Map<string, Bar>();
  for (const bar of bars) deduped.set(bar.date, bar);
  const final = Array.from(deduped.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (final.length < 120) return null;
  return final;
}

const round = (value: number | null, digits = 4) =>
  value === null || !Number.isFinite(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits;

const toFloat = (value: unknown): number | null => {
  const raw = typeof value === "object" && value !== null ? (value as any).raw : value;
  const num = typeof raw === "string" ? Number(raw) : raw;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
};

export type Fundamentals = ReturnType<typeof buildFundamentals>;

type FundamentalScoreInput = {
  pe: number | null;
  pb: number | null;
  sector_pe_avg: number;
  current_ratio: number | null;
  debt_to_equity: number | null;
  eps_growth_qoq: number | null;
};

/**
 * Temel skor daima aynı alanlardan yeniden hesaplanır; böylece veriler kısmen önbellekten
 * gelse bile otomatik tarama ile istek üzerine analiz aynı sonucu üretir.
 */
export function scoreFundamentals(f: FundamentalScoreInput) {
  let qualityScore = 0;
  const notes: string[] = [];
  let hardCapTrigger = false;

  if (f.pe !== null && f.pb !== null && f.pe < f.sector_pe_avg && f.pb < 3) {
    qualityScore += 35;
    notes.push("Değerleme metrikleri sektör ortalamasına göre avantajlı.");
  } else {
    notes.push("Değerleme metriklerinde nötr/negatif görünüm var.");
  }

  if (f.current_ratio !== null && f.current_ratio >= 1.0 && (f.debt_to_equity === null || f.debt_to_equity < 220)) {
    qualityScore += 30;
    notes.push("Likidite ve borç dengesi kabul edilebilir seviyede.");
  } else {
    notes.push("Likidite veya borç dengesi ideal eşiklerin altında.");
  }

  if (f.eps_growth_qoq !== null && f.eps_growth_qoq > 0) {
    qualityScore += 35;
    notes.push("Çeyreklik EPS büyümesi pozitif.");
  } else {
    notes.push("EPS büyümesinde zayıflık gözleniyor.");
  }

  if (f.current_ratio !== null && f.current_ratio < 0.75) {
    hardCapTrigger = true;
    notes.push("Cari oran 0.75 altında: skora güvenlik sınırı uygulanır.");
  }
  if (f.eps_growth_qoq !== null && f.eps_growth_qoq < 0) {
    hardCapTrigger = true;
    notes.push("EPS büyümesi negatif: skora güvenlik sınırı uygulanır.");
  }

  return { score: Math.max(0, Math.min(100, qualityScore)), hard_cap_trigger: hardCapTrigger, notes };
}

const FUNDAMENTAL_NUMERIC_KEYS = [
  "pe",
  "pb",
  "market_cap",
  "current_ratio",
  "debt_to_equity",
  "eps_growth_qoq",
  "roe",
  "net_profit_margin",
  "dividend_yield",
  "quick_ratio",
  "interest_coverage",
  "gross_margin",
  "operating_margin",
  "fcf_margin",
  "revenue_growth_3y",
  "peg_ratio",
  "earnings_yield",
  "payout_ratio",
  "eps",
  "beta",
  "altman_z",
  "piotroski_f",
] as const;

/**
 * Canlı kaynak bazı alanları döndüremediğinde eksik alanlar son bilinen değerlerle tamamlanır ve
 * skor yeniden hesaplanır. Aksi halde aynı hisse, veri sağlayıcının o anki durumuna göre farklı
 * skor üretiyordu.
 */
export function mergeFundamentals(fresh: Fundamentals, cached: Record<string, any> | null | undefined): Fundamentals {
  if (!cached) return fresh;
  const merged: Record<string, any> = { ...fresh };
  let usedCache = false;
  for (const key of FUNDAMENTAL_NUMERIC_KEYS) {
    const current = merged[key];
    const previous = cached[key];
    if ((current === null || current === undefined) && typeof previous === "number" && Number.isFinite(previous)) {
      merged[key] = previous;
      usedCache = true;
    }
  }
  if ((merged["sector"] === "Unknown" || !merged["sector"]) && typeof cached["sector"] === "string" && cached["sector"] !== "Unknown") {
    merged["sector"] = cached["sector"];
    merged["sector_pe_avg"] = SECTOR_PE_BENCHMARK[cached["sector"]] ?? merged["sector_pe_avg"];
    usedCache = true;
  }
  const scored = scoreFundamentals(merged as FundamentalScoreInput);
  merged["score"] = scored.score;
  merged["hard_cap_trigger"] = scored.hard_cap_trigger;
  merged["notes"] = usedCache ? [...scored.notes, "Eksik temel veriler son bilinen değerlerle tamamlandı."] : scored.notes;
  return merged as Fundamentals;
}

function buildFundamentals(info: Record<string, unknown>) {
  const pe = toFloat(info["trailingPE"]) ?? toFloat(info["forwardPE"]);
  const pb = toFloat(info["priceToBook"]);
  const currentRatio = toFloat(info["currentRatio"]);
  const debtToEquity = toFloat(info["debtToEquity"]);
  const epsGrowth = toFloat(info["earningsQuarterlyGrowth"]);
  const marketCap = toFloat(info["marketCap"]);
  const roe = toFloat(info["returnOnEquity"]);
  const netProfitMargin = toFloat(info["profitMargins"]);
  const dividendYield = toFloat(info["dividendYield"]);
  const sector = String(info["sector"] ?? "Unknown");
  const sectorPeAvg = SECTOR_PE_BENCHMARK[sector] ?? 22.0;

  const scored = scoreFundamentals({
    pe: round(pe),
    pb: round(pb),
    sector_pe_avg: sectorPeAvg,
    current_ratio: round(currentRatio),
    debt_to_equity: round(debtToEquity),
    eps_growth_qoq: round(epsGrowth),
  });

  return {
    pe: round(pe),
    pb: round(pb),
    market_cap: round(marketCap, 2),
    sector,
    sector_pe_avg: sectorPeAvg,
    current_ratio: round(currentRatio),
    debt_to_equity: round(debtToEquity),
    eps_growth_qoq: round(epsGrowth),
    roe: round(roe),
    net_profit_margin: round(netProfitMargin),
    dividend_yield: round(dividendYield),
    quick_ratio: round(toFloat(info["quickRatio"])),
    interest_coverage: round(toFloat(info["interestCoverage"])),
    gross_margin: round(toFloat(info["grossMargin"])),
    operating_margin: round(toFloat(info["operatingMargin"])),
    fcf_margin: round(toFloat(info["freeCashflowMargin"])),
    revenue_growth_3y: round(toFloat(info["revenueGrowth3y"])),
    peg_ratio: round(toFloat(info["pegRatio"])),
    earnings_yield: round(toFloat(info["earningsYield"])),
    payout_ratio: round(toFloat(info["payoutRatio"])),
    eps: round(toFloat(info["eps"])),
    beta: round(toFloat(info["beta"])),
    altman_z: round(toFloat(info["altmanZ"])),
    piotroski_f: round(toFloat(info["piotroskiF"])),
    score: scored.score,
    hard_cap_trigger: scored.hard_cap_trigger,
    notes: scored.notes,
  };
}

/** stockanalysis.com SvelteKit veri grafiğinden id -> değer haritası çıkarır. */
function flattenStockAnalysis(payload: any): Record<string, string> {
  const map: Record<string, string> = {};
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  for (const node of nodes) {
    const data = node?.data;
    if (!Array.isArray(data)) continue;
    const resolve = (index: unknown) =>
      typeof index === "number" && index >= 0 && index < data.length ? data[index] : index;
    for (const entry of data) {
      if (entry && typeof entry === "object" && !Array.isArray(entry) && "id" in entry && "value" in entry) {
        const id = resolve((entry as any).id);
        const value = resolve((entry as any).hover ?? (entry as any).value);
        if (typeof id === "string" && (typeof value === "string" || typeof value === "number")) {
          map[id] = String(value);
        }
      }
    }
  }
  return map;
}

const parseMetric = (value: string | undefined): number | null => {
  if (!value || value === "n/a") return null;
  const isPercent = value.includes("%");
  const num = Number(value.replace(/[,%\s]/g, ""));
  if (!Number.isFinite(num)) return null;
  return isPercent ? num / 100 : num;
};

/** Yahoo quoteSummary sık sık 401/429 döndüğü için temel veriler stockanalysis.com'dan çekilir. */
async function fetchStockAnalysisInfo(symbol: string): Promise<Record<string, unknown> | null> {
  const isBist = symbol.toUpperCase().endsWith(".IS");
  const base = symbol.replace(/\.IS$/i, "");
  const url = isBist
    ? `https://stockanalysis.com/quote/ist/${encodeURIComponent(base)}/statistics/__data.json`
    : `https://stockanalysis.com/stocks/${encodeURIComponent(base)}/statistics/__data.json`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!response.ok) return null;
    const map = flattenStockAnalysis(await response.json());
    if (!Object.keys(map).length) return null;
    const debtEquity = parseMetric(map["debtEquity"]);
    const info: Record<string, unknown> = {
      trailingPE: parseMetric(map["pe"]),
      forwardPE: parseMetric(map["peForward"]),
      priceToBook: parseMetric(map["pb"]),
      currentRatio: parseMetric(map["currentRatio"]),
      // Yahoo D/E yüzde ölçeğinde geldiği için eşiklerle uyumlu olsun diye 100 ile ölçeklenir.
      debtToEquity: debtEquity === null ? null : debtEquity * 100,
      earningsQuarterlyGrowth: parseMetric(map["eps3y"]),
      marketCap: parseMetric(map["marketcap"]),
      returnOnEquity: parseMetric(map["roe"]),
      profitMargins: parseMetric(map["profitMargin"]),
      dividendYield: parseMetric(map["dividendYield"]),
      revenueGrowth3y: parseMetric(map["revenue3y"]),
      grossMargin: parseMetric(map["grossMargin"]),
      operatingMargin: parseMetric(map["operatingMargin"]),
      freeCashflowMargin: parseMetric(map["fcfMargin"]),
      quickRatio: parseMetric(map["quickRatio"]),
      interestCoverage: parseMetric(map["interestCoverage"]),
      pegRatio: parseMetric(map["pegRatio"]),
      earningsYield: parseMetric(map["earningsYield"]),
      beta: parseMetric(map["beta"]),
      eps: parseMetric(map["eps"]),
      payoutRatio: parseMetric(map["payoutRatio"]),
      altmanZ: parseMetric(map["zScore"]),
      piotroskiF: parseMetric(map["fScore"]),
    };
    return info;
  } catch {
    return null;
  }
}

export async function fetchFundamentals(symbol: string) {
  const modules = "summaryDetail,defaultKeyStatistics,financialData,assetProfile,price";
  const info: Record<string, unknown> = {};
  try {
    const json = await yahooGet(
      `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
      true,
    );
    const result = json?.quoteSummary?.result?.[0] ?? {};
    for (const section of Object.values(result) as Array<Record<string, unknown>>) {
      if (section && typeof section === "object") Object.assign(info, section);
    }
  } catch {
    // temel veri alınamazsa alternatif kaynağa düşülür
  }

  if (info["trailingPE"] === undefined && info["currentRatio"] === undefined) {
    const alternative = await fetchStockAnalysisInfo(symbol);
    if (alternative) {
      for (const [key, value] of Object.entries(alternative)) {
        if (value !== null && value !== undefined) info[key] = value;
      }
    }
  }
  return buildFundamentals(info);
}