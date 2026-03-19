const SYMBOL_ALIASES = {
  BTC: ["BTC", "XBT", "WBTC"],
  ETH: ["ETH", "WETH", "STETH"],
  SOL: ["SOL", "WSOL"],
  BNB: ["BNB"],
  XRP: ["XRP"],
  DOGE: ["DOGE"],
  AVAX: ["AVAX", "WAVAX"],
  LINK: ["LINK"],
  ARB: ["ARB"],
  OP: ["OP"],
  NEAR: ["NEAR", "WNEAR"],
  INJ: ["INJ"],
  DOT: ["DOT"],
  APT: ["APT"],
  SUI: ["SUI"],
  TIA: ["TIA"],
  ATOM: ["ATOM"],
  AAVE: ["AAVE"],
  LTC: ["LTC"],
  UNI: ["UNI"],
  ADA: ["ADA"],
  TRX: ["TRX"],
  FIL: ["FIL"],
  WIF: ["WIF"],
  PEPE: ["PEPE"],
  USDT: ["USDT"],
  USDC: ["USDC"],
};

const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  ARB: "arbitrum",
  OP: "optimism",
  NEAR: "near",
  INJ: "injective-protocol",
  DOT: "polkadot",
  APT: "aptos",
  SUI: "sui",
  TIA: "celestia",
  ATOM: "cosmos",
  AAVE: "aave",
  LTC: "litecoin",
  UNI: "uniswap",
  ADA: "cardano",
  TRX: "tron",
  FIL: "filecoin",
  WIF: "dogwifcoin",
  PEPE: "pepe",
};

const HYPERLIQUID_SYMBOLS = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "DOGE",
  AVAX: "AVAX",
  LINK: "LINK",
  ARB: "ARB",
  OP: "OP",
  NEAR: "NEAR",
  INJ: "INJ",
  DOT: "DOT",
  APT: "APT",
  SUI: "SUI",
  TIA: "TIA",
  ATOM: "ATOM",
  AAVE: "AAVE",
};

const LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
  aliases.forEach((alias) => LOOKUP.set(alias.toUpperCase(), canonical));
}

export const CORE_SYMBOLS = Object.freeze(Object.keys(SYMBOL_ALIASES));

export function canonicalSymbol(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return LOOKUP.get(normalized) || normalized || null;
}

export function symbolAliases(value) {
  const canonical = canonicalSymbol(value);
  if (!canonical) return [];
  return SYMBOL_ALIASES[canonical] ? [...SYMBOL_ALIASES[canonical]] : [canonical];
}

export function providerSymbol(provider, value) {
  const canonical = canonicalSymbol(value);
  if (!canonical) return null;

  if (provider === "coingecko") {
    return COINGECKO_IDS[canonical] || null;
  }
  if (provider === "hyperliquid") {
    return HYPERLIQUID_SYMBOLS[canonical] || canonical;
  }
  return canonical;
}

export function toCanonicalSymbols(values) {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const canonical = canonicalSymbol(value);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    out.push(canonical);
  });
  return out;
}

