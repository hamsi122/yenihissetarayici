type HistoryPoint = {
  date?: string;
  close?: number | null;
  high?: number | null;
  low?: number | null;
};

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Formasyon onay görselini sunucu tarafında SVG olarak üretir ve data URL döner.
 * Harici görsel servisine bağımlı olmadığı için her zaman render edilebilir bir çıktı verir.
 */
export function buildPatternImage(doc: Record<string, any>): string {
  const history: HistoryPoint[] = Array.isArray(doc["price_history"]) ? doc["price_history"] : [];
  const points = history.slice(-120);
  const closes = points.map((p) => Number(p.close)).filter((v) => Number.isFinite(v));

  const width = 960;
  const height = 520;
  const padLeft = 60;
  const padRight = 24;
  const padTop = 72;
  const padBottom = 48;

  const symbol = String(doc["symbol"] ?? "");
  const action = String(doc["action"] ?? "");
  const score = Number(doc["bullish_score"] ?? 0);
  const patterns: Array<Record<string, any>> = Array.isArray(doc["patterns"]) ? doc["patterns"] : [];
  const confirmed = patterns.filter((p) => p["confirmed"]);
  const primary = confirmed[0] ?? patterns[0] ?? null;
  const bullish = primary?.["direction"] === "bullish";
  const accent = bullish ? "#22c55e" : "#ef4444";

  if (closes.length < 5) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="200" viewBox="0 0 ${width} 200">
<rect width="100%" height="100%" fill="#0b0f14"/>
<text x="${width / 2}" y="100" fill="#94a3b8" font-family="monospace" font-size="18" text-anchor="middle">${esc(symbol)} için yeterli fiyat geçmişi yok</text>
</svg>`;
    return toDataUrl(svg);
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const x = (i: number) => padLeft + (i / (closes.length - 1)) * innerW;
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const line = closes.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(closes.length - 1).toFixed(1)},${(padTop + innerH).toFixed(1)} L${padLeft},${(padTop + innerH).toFixed(1)} Z`;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const value = min + (span * i) / 4;
    const gy = y(value);
    return `<line x1="${padLeft}" y1="${gy.toFixed(1)}" x2="${width - padRight}" y2="${gy.toFixed(1)}" stroke="#1e293b" stroke-width="1"/>
<text x="${padLeft - 8}" y="${(gy + 4).toFixed(1)}" fill="#64748b" font-family="monospace" font-size="11" text-anchor="end">${value.toFixed(2)}</text>`;
  }).join("");

  const neckline = Number(primary?.["neckline"]);
  const necklineSvg =
    Number.isFinite(neckline) && neckline >= min && neckline <= max
      ? `<line x1="${padLeft}" y1="${y(neckline).toFixed(1)}" x2="${width - padRight}" y2="${y(neckline).toFixed(1)}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 6"/>
<text x="${width - padRight}" y="${(y(neckline) - 8).toFixed(1)}" fill="${accent}" font-family="monospace" font-size="12" text-anchor="end">Boyun Çizgisi ${neckline.toFixed(2)}</text>`
      : "";

  const geometry = (primary?.["geometry"] ?? {}) as Record<string, any>;
  const rawBreakout = Number(geometry["breakout_index"]);
  const offset = history.length - points.length;
  const localBreakout = rawBreakout - offset;
  const breakoutSvg =
    Number.isFinite(localBreakout) && localBreakout >= 0 && localBreakout < closes.length
      ? `<circle cx="${x(localBreakout).toFixed(1)}" cy="${y(closes[localBreakout]!).toFixed(1)}" r="7" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2"/>
<text x="${x(localBreakout).toFixed(1)}" y="${(y(closes[localBreakout]!) - 14).toFixed(1)}" fill="${accent}" font-family="monospace" font-size="12" text-anchor="middle">Kırılım</text>`
      : "";

  const firstDate = esc(String(points[0]?.date ?? ""));
  const lastDate = esc(String(points[points.length - 1]?.date ?? ""));
  const patternName = esc(String(primary?.["name"] ?? "Formasyon takipte"));
  const statusText = confirmed.length ? "ONAYLI KIRILIM" : "ONAY BEKLENİYOR";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
<stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="100%" height="100%" fill="#0b0f14"/>
<text x="${padLeft - 36}" y="38" fill="#e2e8f0" font-family="monospace" font-size="24" font-weight="bold">${esc(symbol)} · ${patternName}</text>
<text x="${padLeft - 36}" y="58" fill="${accent}" font-family="monospace" font-size="13">${statusText} · ${esc(action)} · Skor ${score}</text>
${gridLines}
<path d="${area}" fill="url(#fill)"/>
<path d="${line}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>
${necklineSvg}
${breakoutSvg}
<text x="${padLeft}" y="${height - 16}" fill="#64748b" font-family="monospace" font-size="11">${firstDate}</text>
<text x="${width - padRight}" y="${height - 16}" fill="#64748b" font-family="monospace" font-size="11" text-anchor="end">${lastDate}</text>
</svg>`;

  return toDataUrl(svg);
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
