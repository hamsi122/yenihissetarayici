import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { useSession } from "@tanstack/react-start/server";

export type AdminSession = { username?: string };

function sessionConfig() {
  const password = process.env["ADMIN_SESSION_SECRET"];
  if (!password) throw new Error("ADMIN_SESSION_SECRET tanımlı değil");
  return {
    password,
    name: "admin-session",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getSession() {
  return await useSession<AdminSession>(sessionConfig());
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("username,password_hash,password_salt")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!data) {
    // Zamanlama sızıntısını azaltmak için yine de hesaplama yap.
    await hashPassword(password, "dummy-salt");
    return false;
  }
  const computed = await hashPassword(password, data.password_salt);
  return safeEqual(computed, data.password_hash);
}

export async function requireAdmin(): Promise<string> {
  const session = await getSession();
  const username = session.data.username;
  if (!username) throw new Error("Yetkisiz erişim");
  return username;
}

export async function listAdmins() {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("id,username,created_by,created_at")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createAdmin(username: string, password: string, createdBy: string) {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3) throw new Error("Kullanıcı adı en az 3 karakter olmalı");
  if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalı");
  const salt = randomSalt();
  const password_hash = await hashPassword(password, salt);
  const { error } = await supabaseAdmin
    .from("admin_users")
    .insert({ username: normalized, password_hash, password_salt: salt, created_by: createdBy });
  if (error) throw new Error(error.message.includes("duplicate") ? "Bu kullanıcı adı zaten var" : error.message);
  return { username: normalized };
}

export async function recordPageView(path: string, referrer: string | null, sessionId: string | null) {
  await supabaseAdmin.from("page_views").insert({ path, referrer, session_id: sessionId });
}

export async function recordError(message: string, source: string | null, details: unknown) {
  await supabaseAdmin
    .from("error_logs")
    .insert({ message: message.slice(0, 1000), source, details: (details ?? null) as never });
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** Onaylı formasyonların kırılım sonrası fiyat davranışına göre isabet oranı. */
async function computePatternAccuracy() {
  const { data } = await supabaseAdmin.from("signals").select("doc").limit(1200);
  let hit = 0;
  let miss = 0;
  const perPattern: Record<string, { hit: number; total: number }> = {};

  for (const row of data ?? []) {
    const doc = row.doc as Record<string, any> | null;
    if (!doc) continue;
    const history: Array<Record<string, any>> = doc["price_history"] ?? [];
    if (history.length < 20) continue;
    for (const pattern of (doc["patterns"] ?? []) as Array<Record<string, any>>) {
      if (!pattern["confirmed"]) continue;
      const geometry = (pattern["geometry"] ?? {}) as Record<string, any>;
      // price_history son 180 barı içerir; kırılım sonrası 10 barlık takip penceresi değerlendirilir.
      const rawIdx = geometry["breakout_index"];
      const start =
        typeof rawIdx === "number" && rawIdx >= 0 && rawIdx < history.length ? rawIdx : history.length - 15;
      if (start < 0 || start + 5 >= history.length) continue;
      const base = Number(history[start]?.["close"]);
      const window = history.slice(start + 1, start + 11).map((h) => Number(h["close"]));
      if (!Number.isFinite(base) || !window.length) continue;
      const bullish = pattern["direction"] === "bullish";
      const best = bullish ? Math.max(...window) : Math.min(...window);
      const success = bullish ? best >= base * 1.02 : best <= base * 0.98;
      const name = String(pattern["name"] ?? "Bilinmeyen");
      perPattern[name] = perPattern[name] ?? { hit: 0, total: 0 };
      perPattern[name]!.total += 1;
      if (success) {
        hit += 1;
        perPattern[name]!.hit += 1;
      } else {
        miss += 1;
      }
    }
  }

  const evaluated = hit + miss;
  return {
    evaluated,
    hit,
    miss,
    accuracy_pct: evaluated ? Math.round((hit / evaluated) * 1000) / 10 : 0,
    per_pattern: Object.entries(perPattern)
      .map(([name, v]) => ({
        name,
        total: v.total,
        hit: v.hit,
        accuracy_pct: v.total ? Math.round((v.hit / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

export async function getAdminStats() {
  const [totalViews, views24h, views7d, uniqueSessions, errors, signalCount, accuracy, scannerRow, latestSignals] =
    await Promise.all([
    supabaseAdmin.from("page_views").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", daysAgo(1)),
    supabaseAdmin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", daysAgo(7)),
    supabaseAdmin.from("page_views").select("session_id").gte("created_at", daysAgo(30)).limit(5000),
    supabaseAdmin.from("error_logs").select("id,message,source,created_at").order("created_at", { ascending: false }).limit(25),
    supabaseAdmin.from("signals").select("*", { count: "exact", head: true }),
    computePatternAccuracy(),
    supabaseAdmin.from("scanner_state").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin
      .from("signals")
      .select("symbol,market,action,bullish_score,updated_at")
      .order("updated_at", { ascending: false })
      .limit(15),
  ]);

  const sessions = new Set((uniqueSessions.data ?? []).map((r) => r.session_id).filter(Boolean));
  const { count: errorCount } = await supabaseAdmin
    .from("error_logs")
    .select("*", { count: "exact", head: true });

  return {
    page_views_total: totalViews.count ?? 0,
    page_views_24h: views24h.count ?? 0,
    page_views_7d: views7d.count ?? 0,
    unique_visitors_30d: sessions.size,
    signals_tracked: signalCount.count ?? 0,
    error_count: errorCount ?? 0,
    recent_errors: errors.data ?? [],
    accuracy,
    scanner: {
      running: Boolean(scannerRow.data?.running),
      last_run: scannerRow.data?.last_run ?? null,
      last_error: scannerRow.data?.last_error ?? null,
      last_duration_seconds: scannerRow.data?.last_duration_seconds ?? null,
      last_scanned_count: scannerRow.data?.last_scanned_count ?? 0,
      cursor_index: scannerRow.data?.cursor_index ?? 0,
    },
    recent_signals: latestSignals.data ?? [],
  };
}
