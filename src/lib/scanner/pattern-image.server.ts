type HistoryPoint = {
  date?: string;
  close?: number | null;
  high?: number | null;
  low?: number | null;
};

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Eski kayıtlarda `type` alanı olmayabilir; Türkçe/İngilizce ada göre tip çıkarılır. */
function patternType(pattern: Record<string, any> | null): string {
  if (!pattern) return "";
  const explicit = String(pattern["type"] ?? "");
  if (explicit) return explicit;
  const name = String(pattern["name"] ?? "").toLowerCase();
  if (name.includes("çift tepe") || name.includes("double top")) return "double_top";
  if (name.includes("çift dip") || name.includes("double bottom")) return "double_bottom";
  if (name.includes("tobo") || name.includes("inverse head")) return "inverse_head_shoulders";
  if (name.includes("obo") || name.includes("head and shoulders")) return "head_shoulders";
  if (name.includes("üçgen") || name.includes("triangle")) return "symmetrical_triangle";
  if (name.includes("fincan") || name.includes("cup")) return "cup_handle";
  return "";
}

const TR_NAMES: Record<string, string> = {
  double_top: "Çift Tepe",
  double_bottom: "Çift Dip",
  head_shoulders: "Omuz Baş Omuz (OBO)",
  inverse_head_shoulders: "Ters Omuz Baş Omuz (TOBO)",
  symmetrical_triangle: "Simetrik Üçgen",
  cup_handle: "Fincan ve Kulp",
};

/**
 * Formasyon onay görselini sunucu tarafında SVG olarak üretir ve data URL döner.
 * Sadece boyun çizgisini değil, tespit edilen formasyonun geometrisini (tepe/dip noktaları,
 * omuzlar, üçgen kenarları, fincan-kulp) de çizer.
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
  const type = patternType(primary);
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

  const geometry = (primary?.["geometry"] ?? {}) as Record<string, any>;
  const offset = history.length - points.length;
  /** Global bar index -> yerel (kırpılmış) index. */
  const local = (value: unknown): number | null => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const idx = num - offset;
    return idx >= 0 && idx < closes.length ? idx : null;
  };
  const priceAt = (idx: number) => closes[idx]!;
  const inRange = (v: number) => Number.isFinite(v) && v >= min && v <= max;

  const shapes: string[] = [];

  const marker = (idx: number | null, label: string, price?: number) => {
    if (idx === null) return;
    const py = price !== undefined && inRange(price) ? price : priceAt(idx);
    shapes.push(
      `<circle cx="${x(idx).toFixed(1)}" cy="${y(py).toFixed(1)}" r="5" fill="#0b0f14" stroke="${accent}" stroke-width="2"/>
<text x="${x(idx).toFixed(1)}" y="${(y(py) - 12).toFixed(1)}" fill="#e2e8f0" font-family="monospace" font-size="11" text-anchor="middle">${esc(label)}</text>`,
    );
  };

  const segment = (aIdx: number | null, aPrice: number, bIdx: number | null, bPrice: number, dashed = false) => {
    if (aIdx === null || bIdx === null || !inRange(aPrice) || !inRange(bPrice)) return;
    shapes.push(
      `<line x1="${x(aIdx).toFixed(1)}" y1="${y(aPrice).toFixed(1)}" x2="${x(bIdx).toFixed(1)}" y2="${y(bPrice).toFixed(1)}" stroke="${accent}" stroke-width="2"${dashed ? ' stroke-dasharray="8 6"' : ""}/>`,
    );
  };

  const leftIdx = local(geometry["left_index"]);
  const rightIdx = local(geometry["right_index"]);
  const headIdx = local(geometry["head_index"]);
  const bottomIdx = local(geometry["bottom_index"]);
  const handleIdx = local(geometry["handle_index"]);

  if (type === "double_top" || type === "double_bottom") {
    const top = type === "double_top";
    marker(leftIdx, top ? "Tepe 1" : "Dip 1", Number(geometry["left_price"]));
    marker(rightIdx, top ? "Tepe 2" : "Dip 2", Number(geometry["right_price"]));
    segment(leftIdx, Number(geometry["left_price"]), rightIdx, Number(geometry["right_price"]), true);
  } else if (type === "head_shoulders" || type === "inverse_head_shoulders") {
    marker(leftIdx, "Sol Omuz", Number(geometry["left_price"]));
    marker(headIdx, "Baş", Number(geometry["head_price"]));
    marker(rightIdx, "Sağ Omuz", Number(geometry["right_price"]));
    segment(leftIdx, Number(geometry["left_price"]), headIdx, Number(geometry["head_price"]));
    segment(headIdx, Number(geometry["head_price"]), rightIdx, Number(geometry["right_price"]));
  } else if (type === "symmetrical_triangle") {
    const us = local(geometry["upper_start_index"]);
    const ue = local(geometry["upper_end_index"]);
    const ls = local(geometry["lower_start_index"]);
    const le = local(geometry["lower_end_index"]);
    segment(us, Number(geometry["upper_start_price"]), ue, Number(geometry["upper_end_price"]));
    segment(ls, Number(geometry["lower_start_price"]), le, Number(geometry["lower_end_price"]));
    marker(ue, "Direnç", Number(geometry["upper_end_price"]));
    marker(le, "Destek", Number(geometry["lower_end_price"]));
  } else if (type === "cup_handle") {
    marker(leftIdx, "Sol Kenar", Number(geometry["left_price"]));
    marker(bottomIdx, "Fincan Dibi", Number(geometry["bottom_price"]));
    marker(rightIdx, "Sağ Kenar", Number(geometry["right_price"]));
    marker(handleIdx, "Kulp", Number(geometry["handle_price"]));
    if (leftIdx !== null && rightIdx !== null && bottomIdx !== null) {
      const lp = Number(geometry["left_price"]);
      const bp = Number(geometry["bottom_price"]);
      const rp = Number(geometry["right_price"]);
      if (inRange(lp) && inRange(bp) && inRange(rp)) {
        shapes.push(
          `<path d="M${x(leftIdx).toFixed(1)},${y(lp).toFixed(1)} Q${x(bottomIdx).toFixed(1)},${(y(bp) + 30).toFixed(1)} ${x(rightIdx).toFixed(1)},${y(rp).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6 5"/>`,
        );
      }
    }
  }

  // Boyun / kırılım çizgisi
  const necklineStart = local(geometry["neckline_start_index"]);
  const necklineEnd = local(geometry["neckline_end_index"]);
  const necklineStartPrice = Number(geometry["neckline_start_price"]);
  const necklineEndPrice = Number(geometry["neckline_end_price"]);
  const neckline = Number(primary?.["neckline"]);
  let necklineSvg = "";
  if (
    necklineStart !== null &&
    necklineEnd !== null &&
    inRange(necklineStartPrice) &&
    inRange(necklineEndPrice)
  ) {
    const slope =
      necklineEnd === necklineStart
        ? 0
        : (necklineEndPrice - necklineStartPrice) / (necklineEnd - necklineStart);
    const y0 = necklineStartPrice + slope * (0 - necklineStart);
    const y1 = necklineStartPrice + slope * (closes.length - 1 - necklineStart);
    if (inRange(y0) && inRange(y1)) {
      necklineSvg = `<line x1="${padLeft}" y1="${y(y0).toFixed(1)}" x2="${width - padRight}" y2="${y(y1).toFixed(1)}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 6"/>
<text x="${width - padRight}" y="${(y(y1) - 8).toFixed(1)}" fill="${accent}" font-family="monospace" font-size="12" text-anchor="end">Boyun Çizgisi ${Number.isFinite(neckline) ? neckline.toFixed(2) : y1.toFixed(2)}</text>`;
    }
  }
  if (!necklineSvg && inRange(neckline)) {
    necklineSvg = `<line x1="${padLeft}" y1="${y(neckline).toFixed(1)}" x2="${width - padRight}" y2="${y(neckline).toFixed(1)}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 6"/>
<text x="${width - padRight}" y="${(y(neckline) - 8).toFixed(1)}" fill="${accent}" font-family="monospace" font-size="12" text-anchor="end">Boyun Çizgisi ${neckline.toFixed(2)}</text>`;
  }

  const targetPrice = Number(geometry["target_price"]);
  const targetSvg = inRange(targetPrice)
    ? `<line x1="${padLeft}" y1="${y(targetPrice).toFixed(1)}" x2="${width - padRight}" y2="${y(targetPrice).toFixed(1)}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 6"/>
<text x="${padLeft + 6}" y="${(y(targetPrice) - 6).toFixed(1)}" fill="#38bdf8" font-family="monospace" font-size="11">Hedef ${targetPrice.toFixed(2)}</text>`
    : "";

  const localBreakout = local(geometry["breakout_index"]);
  const breakoutSvg =
    localBreakout !== null
      ? `<circle cx="${x(localBreakout).toFixed(1)}" cy="${y(priceAt(localBreakout)).toFixed(1)}" r="7" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2"/>
<text x="${x(localBreakout).toFixed(1)}" y="${(y(priceAt(localBreakout)) + 22).toFixed(1)}" fill="${accent}" font-family="monospace" font-size="12" text-anchor="middle">Kırılım</text>`
      : "";

  const firstDate = esc(String(points[0]?.date ?? ""));
  const lastDate = esc(String(points[points.length - 1]?.date ?? ""));
  const patternName = esc(String(primary?.["name"] ?? TR_NAMES[type] ?? "Formasyon takipte"));
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
<path d="${line}" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linejoin="round"/>
${shapes.join("\n")}
${necklineSvg}
${targetSvg}
${breakoutSvg}
<text x="${padLeft}" y="${height - 16}" fill="#64748b" font-family="monospace" font-size="11">${firstDate}</text>
<text x="${width - padRight}" y="${height - 16}" fill="#64748b" font-family="monospace" font-size="11" text-anchor="end">${lastDate}</text>
</svg>`;

  return toDataUrl(svg);
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
