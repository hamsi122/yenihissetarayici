import {
  adx,
  atr,
  bbands,
  ema,
  macd as macdIndicator,
  rollingMax,
  rollingMin,
  round,
  rsi,
  shift,
  sma,
  stochastic,
  type Num,
} from "./indicators.server";
import {
  detectCupHandle,
  detectDoubleTopBottom,
  detectHeadShoulders,
  detectLocalExtrema,
  detectSymmetricalTriangle,
} from "./patterns.server";
import type { Bar, PatternMatch, SignalDoc } from "./types";

export type Indicators = {
  ema20: Num[];
  sma50: Num[];
  sma200: Num[];
  macd: Num[];
  macdSignal: Num[];
  rsi14: Num[];
  atr14: Num[];
  bbUpper: Num[];
  bbMiddle: Num[];
  bbLower: Num[];
  stochK: Num[];
  stochD: Num[];
  adx14: Num[];
  tenkan: Num[];
  kijun: Num[];
  spanA: Num[];
  spanB: Num[];
};

export function applyIndicators(bars: Bar[]): Indicators {
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);

  const { macd, signal } = macdIndicator(close);
  const bands = bbands(close);
  const stoch = stochastic(high, low, close);

  const highMax9 = rollingMax(high, 9);
  const lowMin9 = rollingMin(low, 9);
  const tenkan: Num[] = highMax9.map((v, i) =>
    v === null || lowMin9[i] === null || lowMin9[i] === undefined ? null : (v + (lowMin9[i] as number)) / 2,
  );
  const highMax26 = rollingMax(high, 26);
  const lowMin26 = rollingMin(low, 26);
  const kijun: Num[] = highMax26.map((v, i) =>
    v === null || lowMin26[i] === null || lowMin26[i] === undefined ? null : (v + (lowMin26[i] as number)) / 2,
  );
  const spanA = shift(
    tenkan.map((v, i) => (v === null || kijun[i] === null || kijun[i] === undefined ? null : (v + (kijun[i] as number)) / 2)),
    26,
  );
  const highMax52 = rollingMax(high, 52);
  const lowMin52 = rollingMin(low, 52);
  const spanB = shift(
    highMax52.map((v, i) =>
      v === null || lowMin52[i] === null || lowMin52[i] === undefined ? null : (v + (lowMin52[i] as number)) / 2,
    ),
    26,
  );

  return {
    ema20: ema(close, 20),
    sma50: sma(close, 50),
    sma200: sma(close, 200),
    macd,
    macdSignal: signal,
    rsi14: rsi(close, 14),
    atr14: atr(high, low, close, 14),
    bbUpper: bands.upper,
    bbMiddle: bands.middle,
    bbLower: bands.lower,
    stochK: stoch.k,
    stochD: stoch.d,
    adx14: adx(high, low, close, 14),
    tenkan,
    kijun,
    spanA,
    spanB,
  };
}

export function scoreToAction(score: number): string {
  if (score > 75) return "GÜÇLÜ AL";
  if (score >= 60) return "AL";
  if (score >= 40) return "TUT";
  if (score >= 25) return "SAT";
  return "GÜÇLÜ SAT";
}

function buildRiskBlock(action: string, entry: number, atrValue: number | null) {
  if (atrValue === null || !["AL", "GÜÇLÜ AL"].includes(action)) {
    return { entry_price: round(entry), atr: null, stop_loss: null, take_profit: null, risk_reward: null };
  }
  return {
    entry_price: round(entry),
    atr: round(atrValue),
    stop_loss: round(entry - 1.5 * atrValue),
    take_profit: round(entry + 3.0 * atrValue),
    risk_reward: "1:2",
  };
}

function buildPriceHistory(bars: Bar[], ind: Indicators) {
  const start = Math.max(0, bars.length - 180);
  return bars.slice(start).map((bar, offset) => {
    const i = start + offset;
    return {
      date: bar.date,
      open: round(bar.open),
      high: round(bar.high),
      low: round(bar.low),
      close: round(bar.close),
      volume: round(bar.volume, 2),
      ema20: round(ind.ema20[i] ?? null),
      sma50: round(ind.sma50[i] ?? null),
      sma200: round(ind.sma200[i] ?? null),
      rsi14: round(ind.rsi14[i] ?? null),
    };
  });
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

function buildVolumeAnalysis(bars: Bar[], confirmedPatterns: PatternMatch[]) {
  const volume = bars.map((b) => b.volume);
  const recentAvg20 = volume.length >= 20 ? mean(volume.slice(-20)) : mean(volume);
  const recentAvg10 = volume.length >= 10 ? mean(volume.slice(-10)) : mean(volume);
  const prevAvg10 = volume.length >= 20 ? mean(volume.slice(-20, -10)) : recentAvg10;

  let pctChange10 = 0;
  if (prevAvg10 > 0) pctChange10 = ((recentAvg10 - prevAvg10) / prevAvg10) * 100;

  let breakoutRatio = 0;
  let breakoutVolume: number | null = null;
  let breakoutAvgRef = recentAvg20;
  let volumeConfirmedBreakout = false;

  for (const pattern of confirmedPatterns) {
    const breakoutIdx = pattern.geometry["breakout_index"];
    if (typeof breakoutIdx === "number" && breakoutIdx >= 0 && breakoutIdx < volume.length) {
      breakoutVolume = volume[breakoutIdx]!;
      const reference = breakoutIdx > 0 ? mean(volume.slice(Math.max(0, breakoutIdx - 20), breakoutIdx)) : recentAvg20;
      breakoutAvgRef = reference > 0 ? reference : recentAvg20;
      if (breakoutAvgRef > 0) {
        breakoutRatio = breakoutVolume / breakoutAvgRef;
        volumeConfirmedBreakout = breakoutRatio >= 1.2;
      }
      break;
    }
  }

  const flowLabel = pctChange10 < -1.0 ? "Para çıkışı" : "Para girişi";
  const statusWord = pctChange10 >= 0 ? "arttı" : "azaldı";
  const absPct = Math.round(Math.abs(pctChange10) * 100) / 100;

  return {
    avg_10: round(recentAvg10, 2),
    avg_20: round(recentAvg20, 2),
    prev_10: round(prevAvg10, 2),
    breakout_volume: breakoutVolume === null ? null : round(breakoutVolume, 2),
    breakout_reference_avg: round(breakoutAvgRef, 2),
    breakout_ratio: round(breakoutRatio),
    volume_confirmed_breakout: volumeConfirmedBreakout,
    breakout_note: volumeConfirmedBreakout ? "Hacim Onaylı Kırılım" : "Hacim Onayı Bekleniyor",
    change_10d_pct: round(pctChange10, 2),
    human_text: `Hacim son 10 gün ortalamasına göre %${absPct} ${statusWord}. ${flowLabel} sinyali destekliyor.`,
  };
}

function detectBearishDivergence(bars: Bar[], ind: Indicators, highs: number[]): boolean {
  const recentHighs = highs.filter((i) => i >= Math.max(0, bars.length - 90));
  if (recentHighs.length < 2) return false;
  const firstIdx = recentHighs[recentHighs.length - 2]!;
  const secondIdx = recentHighs[recentHighs.length - 1]!;
  const firstRsi = ind.rsi14[firstIdx] ?? null;
  const secondRsi = ind.rsi14[secondIdx] ?? null;
  if (firstRsi === null || secondRsi === null) return false;
  return bars[secondIdx]!.close > bars[firstIdx]!.close && secondRsi < firstRsi;
}

export function buildSignal(
  symbol: string,
  market: string,
  bars: Bar[],
  fundamentals: Record<string, any>,
): SignalDoc {
  const ind = applyIndicators(bars);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const { highs, lows } = detectLocalExtrema(close);

  const patternCandidates: PatternMatch[] = [
    ...detectDoubleTopBottom(bars, highs, lows),
    ...detectHeadShoulders(bars, highs, lows),
    ...detectSymmetricalTriangle(bars, highs, lows),
    ...detectCupHandle(bars, highs, lows),
  ];
  const confirmedPatterns = patternCandidates.filter((p) => p.confirmed);
  // Geometri indeksleri tam bar dizisine göredir; grafik yalnızca son barları gösterdiği için
  // her indeksin tarih karşılığı da saklanır ve çizim tarih eşleşmesiyle yapılır.
  for (const pattern of patternCandidates) {
    const dates: Record<string, string> = {};
    for (const [key, value] of Object.entries(pattern.geometry)) {
      if (!key.endsWith("_index")) continue;
      if (typeof value === "number" && value >= 0 && value < bars.length) {
        dates[key.replace(/_index$/, "_date")] = bars[value]!.date;
      }
    }
    pattern.geometry_dates = dates;
  }
  const volumeAnalysis = buildVolumeAnalysis(bars, confirmedPatterns);

  const last = bars.length - 1;
  const prev = Math.max(0, last - 1);
  const closeValue = close[last]!;
  const ema20 = ind.ema20[last] ?? null;
  const sma50 = ind.sma50[last] ?? null;
  const sma200 = ind.sma200[last] ?? null;
  const atr14 = ind.atr14[last] ?? null;
  const prevSma50 = ind.sma50[prev] ?? null;
  const prevSma200 = ind.sma200[prev] ?? null;

  const volumeConfirmation = mean(volume.slice(-3)) > mean(volume.slice(-20));
  const goldenCross =
    prevSma50 !== null && prevSma200 !== null && sma50 !== null && sma200 !== null && prevSma50 <= prevSma200 && sma50 > sma200;
  const deathCross =
    prevSma50 !== null && prevSma200 !== null && sma50 !== null && sma200 !== null && prevSma50 >= prevSma200 && sma50 < sma200;
  const bearishDivergence = detectBearishDivergence(bars, ind, highs);

  const rsiVal = ind.rsi14[last] ?? null;
  const macdVal = ind.macd[last] ?? null;
  const macdSignalVal = ind.macdSignal[last] ?? null;

  const trendPositive =
    ema20 !== null && sma50 !== null && sma200 !== null && closeValue > ema20 && sma50 > sma200;
  const momentumPositive =
    rsiVal !== null && macdVal !== null && macdSignalVal !== null && rsiVal >= 38 && rsiVal <= 72 && macdVal >= macdSignalVal;

  let technicalRaw = 20;
  if (confirmedPatterns.length) technicalRaw += 45;
  if (trendPositive || goldenCross) technicalRaw += 20;
  if (momentumPositive) technicalRaw += 15;
  if (deathCross) technicalRaw -= 20;
  if (bearishDivergence) technicalRaw -= 15;
  technicalRaw = Math.max(0, Math.min(100, technicalRaw));

  // Matris skoru sabit ağırlıklarla hesaplanır: Teknik %40, Hacim %30, Temel %30.
  const TECHNICAL_WEIGHT = 0.4;
  const VOLUME_WEIGHT = 0.3;
  const FUNDAMENTAL_WEIGHT = 0.3;

  const fundamentalsAvailable = fundamentals["pe"] !== null || fundamentals["current_ratio"] !== null;
  const fundamentalRaw = Math.max(0, Math.min(100, Number(fundamentals["score"] ?? 0)));
  let volumeRaw = volumeConfirmation ? 70 : 20;
  if (volumeAnalysis.volume_confirmed_breakout) volumeRaw = 100;

  const technicalPoints = Math.round(technicalRaw * TECHNICAL_WEIGHT);
  const fundamentalPoints = Math.round(fundamentalRaw * FUNDAMENTAL_WEIGHT);
  const volumePoints = Math.round(volumeRaw * VOLUME_WEIGHT);

  // Toplam skor tam olarak parçaların toplamıdır (maks. 100). Ek bonus uygulanmaz.
  let technicalFinal = technicalPoints;
  let fundamentalFinal = fundamentalPoints;
  let volumeFinal = volumePoints;

  // Güvenlik sınırı tetiklendiğinde toplamı kırpmak yerine bileşenler düşürülür;
  // böylece matris kırılımı ile gösterilen toplam skor her zaman birebir uyumlu kalır.
  const HARD_CAP = 45;
  if (fundamentals["hard_cap_trigger"]) {
    let excess = technicalFinal + fundamentalFinal + volumeFinal - HARD_CAP;
    if (excess > 0) {
      const take = (value: number) => {
        const amount = Math.min(value, excess);
        excess -= amount;
        return value - amount;
      };
      fundamentalFinal = take(fundamentalFinal);
      volumeFinal = take(volumeFinal);
      technicalFinal = take(technicalFinal);
    }
  }

  const bullishScore = Math.max(0, Math.min(100, technicalFinal + fundamentalFinal + volumeFinal));

  const action = scoreToAction(bullishScore);
  const risk = buildRiskBlock(action, closeValue, atr14);

  return {
    symbol,
    market,
    action,
    bullish_score: bullishScore,
    score_breakdown: {
      technical: technicalFinal,
      volume: volumeFinal,
      fundamental: fundamentalFinal,
      raw_technical: technicalRaw,
      raw_fundamental: fundamentalRaw,
      raw_volume: volumeRaw,
      volume_breakout_bonus: 0,
      hard_cap_applied: Boolean(fundamentals["hard_cap_trigger"]),
      weights: { technical: TECHNICAL_WEIGHT, volume: VOLUME_WEIGHT, fundamental: FUNDAMENTAL_WEIGHT },
      fundamentals_available: fundamentalsAvailable,
    },
    last_price: round(closeValue),
    patterns: patternCandidates,
    indicators: {
      ema20: round(ema20),
      sma50: round(sma50),
      sma200: round(sma200),
      rsi14: round(rsiVal),
      macd: round(macdVal),
      macd_signal: round(macdSignalVal),
      atr14: round(atr14),
      bb_upper: round(ind.bbUpper[last] ?? null),
      bb_middle: round(ind.bbMiddle[last] ?? null),
      bb_lower: round(ind.bbLower[last] ?? null),
      stochastic_k: round(ind.stochK[last] ?? null),
      stochastic_d: round(ind.stochD[last] ?? null),
      adx14: round(ind.adx14[last] ?? null),
      ichimoku_tenkan: round(ind.tenkan[last] ?? null),
      ichimoku_kijun: round(ind.kijun[last] ?? null),
      ichimoku_span_a: round(ind.spanA[last] ?? null),
      ichimoku_span_b: round(ind.spanB[last] ?? null),
      golden_cross: goldenCross,
      death_cross: deathCross,
      bearish_divergence: bearishDivergence,
      volume_confirmation: volumeConfirmation,
    },
    fundamental: fundamentals,
    risk,
    volume_analysis: volumeAnalysis,
    updated_at: new Date().toISOString(),
    price_history: buildPriceHistory(bars, ind),
    ai_summary: null,
    ai_summary_updated_at: null,
    pattern_image_url: null,
    pattern_image_updated_at: null,
  };
}

export function estimateTargetDuration(patterns: PatternMatch[], action: string): string {
  const confirmed = patterns.filter((p) => p.confirmed);
  if (!confirmed.length) return "7-14 Gün";
  const mapping: Record<string, string> = {
    double_top: "5-10 Gün",
    double_bottom: "5-10 Gün",
    head_shoulders: "10-20 Gün",
    inverse_head_shoulders: "10-20 Gün",
    symmetrical_triangle: "7-14 Gün",
    cup_handle: "15-30 Gün",
  };
  const primary = confirmed[0]?.type ?? "";
  if (mapping[primary]) return mapping[primary]!;
  return ["AL", "GÜÇLÜ AL"].includes(action) ? "5-10 Gün" : "7-14 Gün";
}

export function signalLabel(action: string): string {
  const mapping: Record<string, string> = {
    "GÜÇLÜ AL": "Güçlü Al",
    AL: "Al",
    TUT: "Tut",
    SAT: "Sat",
    "GÜÇLÜ SAT": "Güçlü Sat",
  };
  return mapping[action] ?? action;
}

export function buildExportNote(doc: Record<string, any>): string {
  const volume = doc?.["volume_analysis"] as { volume_confirmed_breakout?: boolean } | undefined;
  return volume?.volume_confirmed_breakout ? "Hacim onaylı kırılım" : "Hacim onayı zayıf";
}