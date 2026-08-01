export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PatternMatch = {
  name: string;
  /** Formasyon tipi anahtarı (görsel çizimi ve eşleştirme için sabit, dile bağımsız). */
  type: string;
  direction: string;
  confirmed: boolean;
  neckline: number | null;
  points: string[];
  volume_validated: boolean;
  detail: string;
  geometry: Record<string, number | null>;
};

export type SignalDoc = Record<string, unknown> & {
  symbol: string;
  market: string;
  action: string;
  bullish_score: number;
};