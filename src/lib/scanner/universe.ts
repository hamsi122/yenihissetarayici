const US_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "BRK-B", "JPM",
  "V", "MA", "LLY", "AVGO", "XOM", "UNH", "JNJ", "WMT", "PG", "HD", "COST", "BAC",
  "ABBV", "KO", "PEP", "MRK", "ORCL", "ADBE", "CRM", "NFLX", "AMD", "CVX", "TMO",
  "ACN", "MCD", "CSCO", "INTU", "LIN", "ABT", "QCOM", "DIS", "DHR", "VZ", "TXN",
  "AMAT", "PFE", "CMCSA", "NKE", "PM", "UNP", "MS", "HON", "IBM", "INTC", "RTX",
  "SPGI", "GS", "CAT", "NOW", "GE", "BKNG", "BLK", "PLD", "ISRG", "AMGN", "SYK",
  "SCHW", "AXP", "COP", "LMT", "SBUX", "DE", "MDT", "ELV", "ADI", "GILD", "MO",
  "TJX", "MMM", "LOW", "C", "PYPL", "T", "VRTX", "REGN", "UPS", "BA", "F", "GM",
  "MU", "PANW", "SNOW", "SHOP", "UBER", "SQ", "COIN", "ROKU", "SOFI", "BABA", "NIO",
];

const BIST_SYMBOLS = [
  "AEFES", "AGHOL", "AHGAZ", "AKBNK", "AKFGY", "AKFYE", "AKSA", "AKSEN", "ALARK", "ALBRK",
  "ALFAS", "ARCLK", "ASELS", "ASTOR", "AVPGY", "BERA", "BIMAS", "BIOEN", "BOBET", "BRSAN",
  "BUCIM", "CCOLA", "CIMSA", "CWENE", "DOAS", "DOHOL", "ECILC", "ECZYT", "EGEEN", "ENJSA",
  "ENKAI", "EREGL", "EUPWR", "FROTO", "GARAN", "GESAN", "GLYHO", "GOKNR", "GUBRF", "GWIND",
  "HALKB", "HEKTS", "ISCTR", "ISMEN", "KARSN", "KAYSE", "KCAER", "KCHOL", "KLSER", "KONTR",
  "KOZAA", "KOZAL", "KRDMD", "MAVI", "MGROS", "MIATK", "MPARK", "ODAS", "OTKAR", "OYAKC",
  "PETKM", "PGSUS", "QUAGR", "REEDR", "SAHOL", "SASA", "SISE", "SKBNK", "SMRTG", "SOKM",
  "TABGD", "TAVHL", "TCELL", "THYAO", "TKFEN", "TOASO", "TSKB", "TTKOM", "TTRAK", "TUKAS",
  "TUPRS", "ULKER", "VAKBN", "VESBE", "VESTL", "YEOTK", "YKBNK", "ZOREN", "AKENR", "ARASE",
  "BNTAS", "CANTE", "KONYA", "SELEC", "TATEN", "YUNSA", "ANHYT", "AKCNS", "ISGYO", "PENTA",
];

export const SCAN_INTERVAL_SECONDS = 300;

export const MARKET_UNIVERSE = {
  US: Array.from(new Set(US_SYMBOLS)).slice(0, 100),
  BIST: Array.from(new Set(BIST_SYMBOLS)).slice(0, 100).map((s) => `${s}.IS`),
};

export const ALL_SYMBOLS: Array<{ symbol: string; market: "US" | "BIST" }> = [
  ...MARKET_UNIVERSE.US.map((symbol) => ({ symbol, market: "US" as const })),
  ...MARKET_UNIVERSE.BIST.map((symbol) => ({ symbol, market: "BIST" as const })),
];

export function marketForSymbol(symbol: string): "US" | "BIST" {
  return symbol.toUpperCase().endsWith(".IS") ? "BIST" : "US";
}

const BIST_BASE_SET = new Set(MARKET_UNIVERSE.BIST.map((s) => s.replace(/\.IS$/i, "")));

/** Aynı hissenin iki farklı kayıt olarak saklanmasını önlemek için kanonik sembol biçimi. */
export function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".IS")) return upper;
  return BIST_BASE_SET.has(upper) ? `${upper}.IS` : upper;
}

export const SECTOR_PE_BENCHMARK: Record<string, number> = {
  Technology: 28,
  "Financial Services": 14,
  Healthcare: 22,
  "Consumer Defensive": 20,
  "Consumer Cyclical": 24,
  Industrials: 21,
  Energy: 12,
  "Basic Materials": 18,
  "Real Estate": 16,
  "Communication Services": 22,
  Utilities: 17,
};