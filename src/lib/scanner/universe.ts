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
/**
 * Veri sağlayıcı sektör bilgisini döndürmediğinde (Yahoo 401/429 veya stockanalysis'te alan yok)
 * sektör "Unknown" kalıyordu. Tarama evrenindeki tüm semboller için sabit eşleme kullanılır.
 */
export const SYMBOL_SECTOR_MAP: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", AVGO: "Technology", ORCL: "Technology",
  ADBE: "Technology", CRM: "Technology", AMD: "Technology", ACN: "Technology", CSCO: "Technology",
  INTU: "Technology", QCOM: "Technology", TXN: "Technology", AMAT: "Technology", IBM: "Technology",
  NOW: "Technology", INTC: "Technology", MU: "Technology", PANW: "Technology", SNOW: "Technology",
  SHOP: "Technology", "BRK-B": "Financial Services", JPM: "Financial Services", V: "Financial Services",
  MA: "Financial Services", BAC: "Financial Services", MS: "Financial Services", SPGI: "Financial Services",
  GS: "Financial Services", BLK: "Financial Services", SCHW: "Financial Services", AXP: "Financial Services",
  C: "Financial Services", PYPL: "Financial Services", SQ: "Financial Services", COIN: "Financial Services",
  SOFI: "Financial Services", LLY: "Healthcare", UNH: "Healthcare", JNJ: "Healthcare", ABBV: "Healthcare",
  MRK: "Healthcare", TMO: "Healthcare", ABT: "Healthcare", DHR: "Healthcare", PFE: "Healthcare",
  ISRG: "Healthcare", AMGN: "Healthcare", SYK: "Healthcare", MDT: "Healthcare", ELV: "Healthcare",
  GILD: "Healthcare", VRTX: "Healthcare", REGN: "Healthcare", ADI: "Technology",
  XOM: "Energy", CVX: "Energy", COP: "Energy", WMT: "Consumer Defensive", PG: "Consumer Defensive",
  COST: "Consumer Defensive", KO: "Consumer Defensive", PEP: "Consumer Defensive", PM: "Consumer Defensive",
  MO: "Consumer Defensive", AMZN: "Consumer Cyclical", TSLA: "Consumer Cyclical", HD: "Consumer Cyclical",
  MCD: "Consumer Cyclical", NKE: "Consumer Cyclical", SBUX: "Consumer Cyclical", TJX: "Consumer Cyclical",
  LOW: "Consumer Cyclical", BKNG: "Consumer Cyclical", F: "Consumer Cyclical", GM: "Consumer Cyclical",
  BABA: "Consumer Cyclical", NIO: "Consumer Cyclical", UBER: "Technology",
  GOOGL: "Communication Services", GOOG: "Communication Services", META: "Communication Services",
  NFLX: "Communication Services", DIS: "Communication Services", CMCSA: "Communication Services",
  VZ: "Communication Services", T: "Communication Services", ROKU: "Communication Services",
  LIN: "Basic Materials", UNP: "Industrials", HON: "Industrials", RTX: "Industrials", CAT: "Industrials",
  GE: "Industrials", LMT: "Industrials", DE: "Industrials", MMM: "Industrials", UPS: "Industrials",
  BA: "Industrials", PLD: "Real Estate",
  // BIST
  AEFES: "Consumer Defensive", BIMAS: "Consumer Defensive", MGROS: "Consumer Defensive", SOKM: "Consumer Defensive",
  ULKER: "Consumer Defensive", CCOLA: "Consumer Defensive", TUKAS: "Consumer Defensive", TATEN: "Consumer Defensive",
  GOKNR: "Consumer Defensive", SELEC: "Healthcare", MPARK: "Healthcare", ECZYT: "Healthcare",
  AKBNK: "Financial Services", GARAN: "Financial Services", ISCTR: "Financial Services", YKBNK: "Financial Services",
  VAKBN: "Financial Services", HALKB: "Financial Services", TSKB: "Financial Services", SKBNK: "Financial Services",
  ALBRK: "Financial Services", ISMEN: "Financial Services", ANHYT: "Financial Services",
  AKFGY: "Real Estate", AVPGY: "Real Estate", ISGYO: "Real Estate", QUAGR: "Basic Materials",
  SAHOL: "Financial Services", KCHOL: "Industrials", AGHOL: "Industrials", DOHOL: "Industrials",
  ALARK: "Industrials", ENKAI: "Industrials", TKFEN: "Industrials", GESAN: "Industrials",
  ASELS: "Industrials", OTKAR: "Industrials", KARSN: "Consumer Cyclical", TOASO: "Consumer Cyclical",
  FROTO: "Consumer Cyclical", DOAS: "Consumer Cyclical", TTRAK: "Industrials", ARCLK: "Consumer Cyclical",
  VESTL: "Consumer Cyclical", VESBE: "Consumer Cyclical", MAVI: "Consumer Cyclical", TABGD: "Consumer Cyclical",
  PENTA: "Technology", MIATK: "Technology", KONTR: "Industrials", ASTOR: "Industrials", EUPWR: "Industrials",
  KCAER: "Basic Materials", EREGL: "Basic Materials", KRDMD: "Basic Materials", SASA: "Basic Materials",
  PETKM: "Basic Materials", AKSA: "Basic Materials", HEKTS: "Basic Materials", GUBRF: "Basic Materials",
  SISE: "Industrials", CIMSA: "Basic Materials", AKCNS: "Basic Materials", BUCIM: "Basic Materials",
  OYAKC: "Basic Materials", BRSAN: "Basic Materials", BERA: "Industrials", ECILC: "Industrials",
  EGEEN: "Consumer Cyclical", KLSER: "Consumer Cyclical", YUNSA: "Consumer Cyclical", BNTAS: "Industrials",
  KAYSE: "Basic Materials", KONYA: "Basic Materials", BOBET: "Basic Materials", KOZAL: "Basic Materials",
  KOZAA: "Basic Materials", TUPRS: "Energy", AKSEN: "Utilities", ENJSA: "Utilities", ODAS: "Utilities",
  ZOREN: "Utilities", AKENR: "Utilities", ARASE: "Utilities", BIOEN: "Utilities", GWIND: "Utilities",
  SMRTG: "Technology", CWENE: "Technology", AKFYE: "Utilities", YEOTK: "Industrials", CANTE: "Utilities",
  AHGAZ: "Utilities", ALFAS: "Technology", REEDR: "Technology", GLYHO: "Industrials",
  THYAO: "Industrials", PGSUS: "Industrials", TAVHL: "Industrials", TCELL: "Communication Services",
  TTKOM: "Communication Services",
};

/** Ekranda gösterilecek Türkçe sektör adları. */
export const SECTOR_LABEL_TR: Record<string, string> = {
  Technology: "Teknoloji",
  "Financial Services": "Finans",
  Healthcare: "Sağlık",
  "Consumer Defensive": "Temel Tüketim",
  "Consumer Cyclical": "İsteğe Bağlı Tüketim",
  Industrials: "Sanayi",
  Energy: "Enerji",
  "Basic Materials": "Temel Malzeme",
  "Real Estate": "Gayrimenkul",
  "Communication Services": "İletişim",
  Utilities: "Kamu Hizmetleri",
};

/** Sağlayıcı sektörü boş/Unknown döndüğünde sabit eşlemeden tamamlar. */
export function resolveSector(symbol: string, provided?: string | null): string {
  const clean = (provided ?? "").trim();
  if (clean && clean.toLowerCase() !== "unknown" && clean !== "n/a") return clean;
  const base = symbol.trim().toUpperCase().replace(/\.IS$/i, "");
  return SYMBOL_SECTOR_MAP[base] ?? "Diğer";
}
