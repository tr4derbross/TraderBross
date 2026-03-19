// TraderBross v2.0 — Sentiment Analysis (keyword-based, no API key)

const BULLISH_WORDS = [
  "surge", "rally", "breakout", "adoption", "bullish", "ath", "pump",
  "soar", "jump", "gain", "rise", "up", "high", "record", "accumulate",
  "buy", "long", "bull", "moon", "recovery", "support", "bounce",
  "outperform", "upgrade", "partnership", "launch", "approve", "etf",
  "inflow", "accumulation", "institutional",
];

const BEARISH_WORDS = [
  "crash", "dump", "hack", "ban", "bearish", "liquidation", "fear",
  "drop", "fall", "down", "low", "sell", "risk", "warning", "concern",
  "short", "bear", "collapse", "fraud", "scam", "regulation", "fine",
  "investigation", "outflow", "distribution", "resistance",
];

const TIER1_SOURCES = [
  "coindesk", "cointelegraph", "the block", "decrypt", "bloomberg",
  "reuters", "wsj", "financial times", "fortune", "forbes",
  "binance", "coinbase", "kraken", "okx", "bybit",
];

export function detectSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  let bull = 0;
  let bear = 0;

  for (const word of BULLISH_WORDS) {
    if (lower.includes(word)) bull++;
  }
  for (const word of BEARISH_WORDS) {
    if (lower.includes(word)) bear++;
  }

  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

export function detectImpact(
  title: string,
  source?: string,
): "high" | "medium" | "low" {
  const lower = title.toLowerCase();

  const HIGH_KEYWORDS = [
    "breaking", "crash", "hack", "ban", "ath", "record", "etf",
    "approve", "approved", "federal", "sec", "binance", "emergency",
    "exploit", "liquidated",
  ];
  const MEDIUM_KEYWORDS = [
    "report", "analysis", "update", "launch", "launches",
    "partnership", "integrate", "integration", "regulation",
  ];

  for (const kw of HIGH_KEYWORDS) {
    if (lower.includes(kw)) return "high";
  }

  // Tier-1 source boosts to medium minimum
  const sourceLower = (source ?? "").toLowerCase();
  const isTier1 = TIER1_SOURCES.some((s) => sourceLower.includes(s));

  for (const kw of MEDIUM_KEYWORDS) {
    if (lower.includes(kw)) return "medium";
  }

  if (isTier1) return "medium";

  return "low";
}

export function detectBreaking(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.includes("BREAKING") ||
    upper.includes("URGENT") ||
    upper.includes("ALERT") ||
    upper.includes("JUST IN") ||
    upper.includes("EXCLUSIVE")
  );
}

export function extractTickers(text: string): string[] {
  const KNOWN = [
    "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK",
    "ARB", "OP", "NEAR", "INJ", "SUI", "APT", "TIA", "ATOM", "HYPE", "TON",
    "MATIC", "UNI", "AAVE", "CRV", "MKR", "SNX", "COMP", "YFI", "GMX", "PEPE", "WIF",
  ];
  return KNOWN.filter((t) => new RegExp(`\\b${t}\\b`).test(text.toUpperCase()));
}
