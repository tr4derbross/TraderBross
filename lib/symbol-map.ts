"use client";

const SYMBOL_ALIASES: Record<string, string[]> = {
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

const lookup = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
  aliases.forEach((alias) => {
    lookup.set(alias.toUpperCase(), canonical);
  });
}

function cleanSymbol(input: string) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function canonicalSymbol(input: string) {
  const normalized = cleanSymbol(input);
  if (!normalized) return "";
  return lookup.get(normalized) || normalized;
}

export function symbolAliases(input: string) {
  const canonical = canonicalSymbol(input);
  if (!canonical) return [];
  return SYMBOL_ALIASES[canonical] ? [...SYMBOL_ALIASES[canonical]] : [canonical];
}

