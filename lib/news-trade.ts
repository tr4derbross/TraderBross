import type { NewsItem } from "@/lib/mock-data";
import type { OrderType, Side } from "@/hooks/useTradingState";

export type NewsTradePreset = {
  symbol: string;
  side: Side;
  orderType: OrderType;
  tpPercent?: number;
  slPercent?: number;
  label: string;
  rationale: string;
};

export function getPrimaryNewsSymbol(item: NewsItem): string | null {
  return item.ticker?.[0] ?? null;
}

function resolveBias(item: NewsItem): Side | null {
  if (item.sentiment === "bullish") return "long";
  if (item.sentiment === "bearish") return "short";

  switch (item.importance) {
    case "breaking":
    case "market-moving":
      return "long";
    default:
      return null;
  }
}

export function buildNewsTradePresets(item: NewsItem): NewsTradePreset[] {
  const symbol = getPrimaryNewsSymbol(item);
  if (!symbol) return [];

  const bias = resolveBias(item);
  const basePresets: NewsTradePreset[] = [];

  if (bias) {
    basePresets.push({
      symbol,
      side: bias,
      orderType: "market",
      tpPercent: item.importance === "breaking" ? 2.5 : 2,
      slPercent: item.importance === "breaking" ? 1 : 0.8,
      label: bias === "long" ? `Quick Long ${symbol}` : `Quick Short ${symbol}`,
      rationale: item.importance === "breaking" ? "Breaking headline momentum setup." : "News bias setup.",
    });
  }

  basePresets.push({
    symbol,
    side: "long",
    orderType: "market",
    tpPercent: 2,
    slPercent: 1,
    label: `Long ${symbol}`,
    rationale: "Fast bullish reaction preset.",
  });

  basePresets.push({
    symbol,
    side: "short",
    orderType: "market",
    tpPercent: 2,
    slPercent: 1,
    label: `Short ${symbol}`,
    rationale: "Fast bearish reaction preset.",
  });

  return basePresets.slice(0, 2);
}
