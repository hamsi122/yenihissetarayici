// Technical indicator implementations (TA-Lib port).

export type Num = number | null;

const nan = (n: number): Num[] => new Array(n).fill(null);

export function sma(values: number[], period: number): Num[] {
  const out: Num[] = nan(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Num[] {
  const out: Num[] = nan(values.length);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i]!;
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: Num[]; signal: Num[]; hist: Num[] } {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const macdLine: Num[] = values.map((_, i) =>
    fastLine[i] === null || slowLine[i] === null ? null : (fastLine[i] as number) - (slowLine[i] as number),
  );
  const start = macdLine.findIndex((v) => v !== null);
  const compact = start === -1 ? [] : (macdLine.slice(start) as number[]);
  const sigCompact = ema(compact, signal);
  const signalLine: Num[] = nan(values.length);
  if (start !== -1) for (let i = 0; i < sigCompact.length; i++) signalLine[start + i] = sigCompact[i]!;
  const hist: Num[] = values.map((_, i) =>
    macdLine[i] === null || signalLine[i] === null ? null : (macdLine[i] as number) - (signalLine[i] as number),
  );
  return { macd: macdLine, signal: signalLine, hist };
}

export function rsi(values: number[], period = 14): Num[] {
  const out: Num[] = nan(values.length);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function trueRange(high: number[], low: number[], close: number[]): number[] {
  const tr: number[] = [high[0]! - low[0]!];
  for (let i = 1; i < high.length; i++) {
    tr.push(
      Math.max(high[i]! - low[i]!, Math.abs(high[i]! - close[i - 1]!), Math.abs(low[i]! - close[i - 1]!)),
    );
  }
  return tr;
}

export function atr(high: number[], low: number[], close: number[], period = 14): Num[] {
  const out: Num[] = nan(high.length);
  const tr = trueRange(high, low, close);
  if (high.length <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i]!;
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < high.length; i++) {
    prev = (prev * (period - 1) + tr[i]!) / period;
    out[i] = prev;
  }
  return out;
}

export function bbands(values: number[], period = 20, dev = 2) {
  const middle = sma(values, period);
  const upper: Num[] = nan(values.length);
  const lower: Num[] = nan(values.length);
  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i] as number;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j]! - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = mean + dev * sd;
    lower[i] = mean - dev * sd;
  }
  return { upper, middle, lower };
}

export function stochastic(
  high: number[],
  low: number[],
  close: number[],
  fastK = 14,
  slowK = 3,
  slowD = 3,
) {
  const rawK: Num[] = nan(close.length);
  for (let i = fastK - 1; i < close.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - fastK + 1; j <= i; j++) {
      hh = Math.max(hh, high[j]!);
      ll = Math.min(ll, low[j]!);
    }
    rawK[i] = hh === ll ? 0 : ((close[i]! - ll) / (hh - ll)) * 100;
  }
  const smoothed = smaOfNullable(rawK, slowK);
  const d = smaOfNullable(smoothed, slowD);
  return { k: smoothed, d };
}

function smaOfNullable(values: Num[], period: number): Num[] {
  const out: Num[] = nan(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j] ?? null;
      if (v === null) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (ok) out[i] = sum / period;
  }
  return out;
}

export function adx(high: number[], low: number[], close: number[], period = 14): Num[] {
  const len = high.length;
  const out: Num[] = nan(len);
  if (len < period * 2 + 1) return out;
  const tr = trueRange(high, low, close);
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < len; i++) {
    const up = high[i]! - high[i - 1]!;
    const down = low[i - 1]! - low[i]!;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  let trS = 0;
  let pS = 0;
  let mS = 0;
  for (let i = 1; i <= period; i++) {
    trS += tr[i]!;
    pS += plusDM[i]!;
    mS += minusDM[i]!;
  }
  const dxs: Array<{ i: number; dx: number }> = [];
  for (let i = period + 1; i < len; i++) {
    trS = trS - trS / period + tr[i]!;
    pS = pS - pS / period + plusDM[i]!;
    mS = mS - mS / period + minusDM[i]!;
    const pdi = trS === 0 ? 0 : (pS / trS) * 100;
    const mdi = trS === 0 ? 0 : (mS / trS) * 100;
    const denom = pdi + mdi;
    dxs.push({ i, dx: denom === 0 ? 0 : (Math.abs(pdi - mdi) / denom) * 100 });
  }
  if (dxs.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += dxs[i]!.dx;
  let prev = sum / period;
  out[dxs[period - 1]!.i] = prev;
  for (let i = period; i < dxs.length; i++) {
    prev = (prev * (period - 1) + dxs[i]!.dx) / period;
    out[dxs[i]!.i] = prev;
  }
  return out;
}

export function rollingMax(values: number[], period: number): Num[] {
  const out: Num[] = nan(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let m = -Infinity;
    for (let j = i - period + 1; j <= i; j++) m = Math.max(m, values[j]!);
    out[i] = m;
  }
  return out;
}

export function rollingMin(values: number[], period: number): Num[] {
  const out: Num[] = nan(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let m = Infinity;
    for (let j = i - period + 1; j <= i; j++) m = Math.min(m, values[j]!);
    out[i] = m;
  }
  return out;
}

export function shift(values: Num[], by: number): Num[] {
  const out: Num[] = nan(values.length);
  for (let i = 0; i < values.length; i++) {
    const src = i - by;
    if (src >= 0 && src < values.length) out[i] = values[src]!;
  }
  return out;
}

export function round(value: Num | undefined, digits = 4): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}