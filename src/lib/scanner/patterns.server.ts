import type { Bar, PatternMatch } from "./types";

const r4 = (v: number) => Math.round(v * 10000) / 10000;

export function detectLocalExtrema(values: number[], order = 4): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  if (values.length < order * 2 + 5) return { highs, lows };
  for (let i = order; i < values.length - order; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= order; j++) {
      if (!(values[i]! > values[i - j]! && values[i]! > values[i + j]!)) isHigh = false;
      if (!(values[i]! < values[i - j]! && values[i]! < values[i + j]!)) isLow = false;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

function findBreakoutIndex(
  close: number[],
  startIdx: number,
  threshold: (idx: number) => number,
  direction: "above" | "below",
): number | null {
  for (let idx = startIdx; idx < close.length; idx++) {
    const value = close[idx]!;
    const t = threshold(idx);
    if (direction === "above" && value > t) return idx;
    if (direction === "below" && value < t) return idx;
  }
  return null;
}

export function lineValue(
  startIdx: number,
  startPrice: number,
  endIdx: number,
  endPrice: number,
  queryIdx: number,
): number {
  if (endIdx === startIdx) return startPrice;
  const slope = (endPrice - startPrice) / (endIdx - startIdx);
  return startPrice + slope * (queryIdx - startIdx);
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export function detectDoubleTopBottom(
  bars: Bar[],
  highs: number[],
  lows: number[],
): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const lookbackStart = Math.max(0, bars.length - 60);
  const latestClose = close[close.length - 1]!;
  const volumeAvg20 = mean(volume.slice(-20));

  const recentHighs = highs.filter((i) => i >= lookbackStart);
  for (let i = recentHighs.length - 1; i > 0; i--) {
    const leftIdx = recentHighs[i - 1]!;
    const rightIdx = recentHighs[i]!;
    if (rightIdx - leftIdx < 4) continue;
    const leftPeak = close[leftIdx]!;
    const rightPeak = close[rightIdx]!;
    const avgPeak = Math.max((leftPeak + rightPeak) / 2, 1e-9);
    if (Math.abs(leftPeak - rightPeak) / avgPeak > 0.02) continue;
    const neckline = Math.min(...close.slice(leftIdx, rightIdx + 1));
    const breakoutIdx = findBreakoutIndex(close, rightIdx, () => neckline, "below");
    const volumeValidated = breakoutIdx !== null && volume[breakoutIdx]! > volumeAvg20;
    const confirmed = latestClose < neckline && breakoutIdx !== null && volumeValidated;
    const targetPrice = neckline - (Math.max(leftPeak, rightPeak) - neckline);
    patterns.push({
      name: "Double Top",
      direction: "bearish",
      confirmed,
      neckline: r4(neckline),
      points: [bars[leftIdx]!.date, bars[rightIdx]!.date],
      volume_validated: volumeValidated,
      detail: "Son 60 periyotta iki tepe %2 toleransla eşleşti, neckline kapanışla test edildi.",
      geometry: {
        left_index: leftIdx,
        right_index: rightIdx,
        left_price: r4(leftPeak),
        right_price: r4(rightPeak),
        neckline_start_index: leftIdx,
        neckline_end_index: rightIdx,
        neckline_start_price: r4(neckline),
        neckline_end_price: r4(neckline),
        breakout_index: breakoutIdx,
        target_price: r4(targetPrice),
      },
    });
    break;
  }

  const recentLows = lows.filter((i) => i >= lookbackStart);
  for (let i = recentLows.length - 1; i > 0; i--) {
    const leftIdx = recentLows[i - 1]!;
    const rightIdx = recentLows[i]!;
    if (rightIdx - leftIdx < 4) continue;
    const leftBottom = close[leftIdx]!;
    const rightBottom = close[rightIdx]!;
    const avgBottom = Math.max((leftBottom + rightBottom) / 2, 1e-9);
    if (Math.abs(leftBottom - rightBottom) / avgBottom > 0.02) continue;
    const neckline = Math.max(...close.slice(leftIdx, rightIdx + 1));
    const breakoutIdx = findBreakoutIndex(close, rightIdx, () => neckline, "above");
    const volumeValidated = breakoutIdx !== null && volume[breakoutIdx]! > volumeAvg20;
    const confirmed = latestClose > neckline && breakoutIdx !== null && volumeValidated;
    const targetPrice = neckline + (neckline - Math.min(leftBottom, rightBottom));
    patterns.push({
      name: "Double Bottom",
      direction: "bullish",
      confirmed,
      neckline: r4(neckline),
      points: [bars[leftIdx]!.date, bars[rightIdx]!.date],
      volume_validated: volumeValidated,
      detail: "Son 60 periyotta iki dip %2 toleransla eşleşti, neckline kapanışla yukarı kırıldı.",
      geometry: {
        left_index: leftIdx,
        right_index: rightIdx,
        left_price: r4(leftBottom),
        right_price: r4(rightBottom),
        neckline_start_index: leftIdx,
        neckline_end_index: rightIdx,
        neckline_start_price: r4(neckline),
        neckline_end_price: r4(neckline),
        breakout_index: breakoutIdx,
        target_price: r4(targetPrice),
      },
    });
    break;
  }

  return patterns;
}

function argMin(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! < values[best]!) best = i;
  return best;
}

function argMax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
  return best;
}

export function detectHeadShoulders(bars: Bar[], highs: number[], lows: number[]): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const lookbackStart = Math.max(0, bars.length - 120);
  const volumeAvg20 = mean(volume.slice(-20));

  const recentHighs = highs.filter((i) => i >= lookbackStart);
  for (let i = 0; i < recentHighs.length - 2; i++) {
    const left = recentHighs[i]!;
    const head = recentHighs[i + 1]!;
    const right = recentHighs[i + 2]!;
    const leftVal = close[left]!;
    const headVal = close[head]!;
    const rightVal = close[right]!;
    const balanced = Math.abs(leftVal - rightVal) / Math.max(leftVal, rightVal, 1e-9) <= 0.03;
    const headValid = headVal >= Math.max(leftVal, rightVal) * 1.03;
    if (!(balanced && headValid)) continue;

    const leftTroughIdx = left + argMin(close.slice(left, head + 1));
    const rightTroughIdx = head + argMin(close.slice(head, right + 1));
    const leftTrough = close[leftTroughIdx]!;
    const rightTrough = close[rightTroughIdx]!;
    const leftVolume = mean(volume.slice(Math.max(left - 3, 0), left + 1));
    const rightVolume = mean(volume.slice(Math.max(right - 3, 0), right + 1));
    const breakoutIdx = findBreakoutIndex(
      close,
      right,
      (idx) => lineValue(leftTroughIdx, leftTrough, rightTroughIdx, rightTrough, idx),
      "below",
    );
    const breakoutVolume = breakoutIdx !== null ? volume[breakoutIdx]! : 0;
    const volumeValidated = rightVolume < leftVolume && breakoutVolume > volumeAvg20;
    const necklineLatest = lineValue(leftTroughIdx, leftTrough, rightTroughIdx, rightTrough, close.length - 1);
    const confirmed = close[close.length - 1]! < necklineLatest && breakoutIdx !== null && volumeValidated;
    const targetPrice = necklineLatest - (headVal - Math.min(leftTrough, rightTrough));
    patterns.push({
      name: "Head and Shoulders",
      direction: "bearish",
      confirmed,
      neckline: r4(necklineLatest),
      points: [bars[left]!.date, bars[head]!.date, bars[right]!.date],
      volume_validated: volumeValidated,
      detail:
        "Baş noktası omuzlardan %3+ yüksek; sağ omuz hacim düşüşü ve neckline kırılımında hacim artışı kontrol edildi.",
      geometry: {
        left_index: left,
        head_index: head,
        right_index: right,
        left_price: r4(leftVal),
        head_price: r4(headVal),
        right_price: r4(rightVal),
        neckline_start_index: leftTroughIdx,
        neckline_end_index: rightTroughIdx,
        neckline_start_price: r4(leftTrough),
        neckline_end_price: r4(rightTrough),
        breakout_index: breakoutIdx,
        target_price: r4(targetPrice),
      },
    });
    break;
  }

  const recentLows = lows.filter((i) => i >= lookbackStart);
  for (let i = 0; i < recentLows.length - 2; i++) {
    const left = recentLows[i]!;
    const head = recentLows[i + 1]!;
    const right = recentLows[i + 2]!;
    const leftVal = close[left]!;
    const headVal = close[head]!;
    const rightVal = close[right]!;
    const balanced = Math.abs(leftVal - rightVal) / Math.max(leftVal, rightVal, 1e-9) <= 0.03;
    const headValid = headVal <= Math.min(leftVal, rightVal) * 0.97;
    if (!(balanced && headValid)) continue;

    const leftPeakIdx = left + argMax(close.slice(left, head + 1));
    const rightPeakIdx = head + argMax(close.slice(head, right + 1));
    const leftPeak = close[leftPeakIdx]!;
    const rightPeak = close[rightPeakIdx]!;
    const leftVolume = mean(volume.slice(Math.max(left - 3, 0), left + 1));
    const rightVolume = mean(volume.slice(Math.max(right - 3, 0), right + 1));
    const breakoutIdx = findBreakoutIndex(
      close,
      right,
      (idx) => lineValue(leftPeakIdx, leftPeak, rightPeakIdx, rightPeak, idx),
      "above",
    );
    const breakoutVolume = breakoutIdx !== null ? volume[breakoutIdx]! : 0;
    const volumeValidated = rightVolume < leftVolume && breakoutVolume > volumeAvg20;
    const necklineLatest = lineValue(leftPeakIdx, leftPeak, rightPeakIdx, rightPeak, close.length - 1);
    const confirmed = close[close.length - 1]! > necklineLatest && breakoutIdx !== null && volumeValidated;
    const targetPrice = necklineLatest + (Math.max(leftPeak, rightPeak) - headVal);
    patterns.push({
      name: "Inverse Head and Shoulders",
      direction: "bullish",
      confirmed,
      neckline: r4(necklineLatest),
      points: [bars[left]!.date, bars[head]!.date, bars[right]!.date],
      volume_validated: volumeValidated,
      detail: "Ters OBO algılandı; sağ omuz hacmi düşük ve neckline kırılımında hacim artışı doğrulandı.",
      geometry: {
        left_index: left,
        head_index: head,
        right_index: right,
        left_price: r4(leftVal),
        head_price: r4(headVal),
        right_price: r4(rightVal),
        neckline_start_index: leftPeakIdx,
        neckline_end_index: rightPeakIdx,
        neckline_start_price: r4(leftPeak),
        neckline_end_price: r4(rightPeak),
        breakout_index: breakoutIdx,
        target_price: r4(targetPrice),
      },
    });
    break;
  }

  return patterns;
}

export function detectSymmetricalTriangle(bars: Bar[], highs: number[], lows: number[]): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const lookbackStart = Math.max(0, bars.length - 90);
  const volumeAvg20 = mean(volume.slice(-20));

  const recentHighs = highs.filter((i) => i >= lookbackStart);
  const recentLows = lows.filter((i) => i >= lookbackStart);
  if (recentHighs.length < 2 || recentLows.length < 2) return patterns;

  const upperStartIdx = recentHighs[recentHighs.length - 2]!;
  const upperEndIdx = recentHighs[recentHighs.length - 1]!;
  const lowerStartIdx = recentLows[recentLows.length - 2]!;
  const lowerEndIdx = recentLows[recentLows.length - 1]!;
  if (upperEndIdx <= upperStartIdx || lowerEndIdx <= lowerStartIdx) return patterns;

  const upperStartPrice = close[upperStartIdx]!;
  const upperEndPrice = close[upperEndIdx]!;
  const lowerStartPrice = close[lowerStartIdx]!;
  const lowerEndPrice = close[lowerEndIdx]!;
  const upperSlope = (upperEndPrice - upperStartPrice) / (upperEndIdx - upperStartIdx);
  const lowerSlope = (lowerEndPrice - lowerStartPrice) / (lowerEndIdx - lowerStartIdx);
  if (!(upperSlope < 0 && lowerSlope > 0)) return patterns;

  const startIdx = Math.max(upperStartIdx, lowerStartIdx);
  const endIdx = bars.length - 1;
  const upperStartEval = lineValue(upperStartIdx, upperStartPrice, upperEndIdx, upperEndPrice, startIdx);
  const lowerStartEval = lineValue(lowerStartIdx, lowerStartPrice, lowerEndIdx, lowerEndPrice, startIdx);
  const upperLatestEval = lineValue(upperStartIdx, upperStartPrice, upperEndIdx, upperEndPrice, endIdx);
  const lowerLatestEval = lineValue(lowerStartIdx, lowerStartPrice, lowerEndIdx, lowerEndPrice, endIdx);

  const initialWidth = upperStartEval - lowerStartEval;
  const currentWidth = upperLatestEval - lowerLatestEval;
  if (initialWidth <= 0 || currentWidth <= 0) return patterns;
  if (currentWidth > initialWidth * 0.85) return patterns;

  const latestClose = close[close.length - 1]!;
  let breakoutIdx: number | null = null;
  let direction = "neutral";
  if (latestClose > upperLatestEval) {
    direction = "bullish";
    breakoutIdx = bars.length - 1;
  } else if (latestClose < lowerLatestEval) {
    direction = "bearish";
    breakoutIdx = bars.length - 1;
  }

  const volumeValidated = breakoutIdx !== null && volume[breakoutIdx]! > volumeAvg20;
  const confirmed = breakoutIdx !== null && volumeValidated;
  const targetMagnitude = initialWidth * 0.8;
  const targetPrice =
    direction === "bullish"
      ? latestClose + targetMagnitude
      : direction === "bearish"
        ? latestClose - targetMagnitude
        : latestClose;

  patterns.push({
    name: "Symmetrical Triangle",
    direction,
    confirmed,
    neckline: r4((upperLatestEval + lowerLatestEval) / 2),
    points: [bars[upperStartIdx]!.date, bars[upperEndIdx]!.date, bars[lowerStartIdx]!.date, bars[lowerEndIdx]!.date],
    volume_validated: volumeValidated,
    detail: "Simetrik üçgen daralması tespit edildi; kırılım yönü ve hacim onayı kontrol edildi.",
    geometry: {
      upper_start_index: upperStartIdx,
      upper_end_index: upperEndIdx,
      lower_start_index: lowerStartIdx,
      lower_end_index: lowerEndIdx,
      upper_start_price: r4(upperStartPrice),
      upper_end_price: r4(upperEndPrice),
      lower_start_price: r4(lowerStartPrice),
      lower_end_price: r4(lowerEndPrice),
      breakout_index: breakoutIdx,
      target_price: r4(targetPrice),
    },
  });

  return patterns;
}

export function detectCupHandle(bars: Bar[], highs: number[], lows: number[]): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const lookbackStart = Math.max(0, bars.length - 180);
  const volumeAvg20 = mean(volume.slice(-20));

  const recentHighs = highs.filter((i) => i >= lookbackStart);
  const recentLows = lows.filter((i) => i >= lookbackStart);
  if (recentHighs.length < 2 || recentLows.length < 1) return patterns;

  for (let i = 0; i < recentHighs.length - 1; i++) {
    const leftIdx = recentHighs[i]!;
    const rightIdx = recentHighs[i + 1]!;
    if (rightIdx - leftIdx < 22) continue;
    const leftPeak = close[leftIdx]!;
    const rightPeak = close[rightIdx]!;
    if (Math.abs(leftPeak - rightPeak) / Math.max(leftPeak, rightPeak, 1e-9) > 0.06) continue;

    const bottomIdx = leftIdx + argMin(close.slice(leftIdx, rightIdx + 1));
    const bottomPrice = close[bottomIdx]!;
    if (bottomIdx === leftIdx || bottomIdx === rightIdx) continue;
    const cupDepthRatio = (Math.max(leftPeak, rightPeak) - bottomPrice) / Math.max(leftPeak, rightPeak, 1e-9);
    if (cupDepthRatio < 0.08) continue;

    const handleEnd = Math.min(close.length - 1, rightIdx + 30);
    if (handleEnd - rightIdx < 4) continue;
    const handleIdx = rightIdx + argMin(close.slice(rightIdx, handleEnd + 1));
    const handleLow = close[handleIdx]!;
    const handleDropRatio = (rightPeak - handleLow) / Math.max(rightPeak, 1e-9);
    if (handleDropRatio > 0.15) continue;
    if (handleLow < bottomPrice + (Math.max(leftPeak, rightPeak) - bottomPrice) * 0.45) continue;

    const neckline = Math.max(leftPeak, rightPeak);
    const breakoutIdx = findBreakoutIndex(close, handleIdx, () => neckline, "above");
    const volumeValidated = breakoutIdx !== null && volume[breakoutIdx]! > volumeAvg20;
    const confirmed = breakoutIdx !== null && volumeValidated && close[close.length - 1]! > neckline;
    const targetPrice = neckline + (neckline - bottomPrice);

    patterns.push({
      name: "Cup and Handle",
      direction: "bullish",
      confirmed,
      neckline: r4(neckline),
      points: [bars[leftIdx]!.date, bars[bottomIdx]!.date, bars[rightIdx]!.date, bars[handleIdx]!.date],
      volume_validated: volumeValidated,
      detail:
        "Fincan-kulp formasyonu tespit edildi; kulp sonrası neckline kırılımı ve hacim onayı kontrol edildi.",
      geometry: {
        left_index: leftIdx,
        bottom_index: bottomIdx,
        right_index: rightIdx,
        handle_index: handleIdx,
        left_price: r4(leftPeak),
        bottom_price: r4(bottomPrice),
        right_price: r4(rightPeak),
        handle_price: r4(handleLow),
        neckline_start_index: leftIdx,
        neckline_end_index: rightIdx,
        neckline_start_price: r4(neckline),
        neckline_end_price: r4(neckline),
        breakout_index: breakoutIdx,
        target_price: r4(targetPrice),
      },
    });
    break;
  }

  return patterns;
}