// TraderBross News System v2.0 — Zero-Key Multi-Agent Build

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  sourceLabel: string;
  category: "news" | "social" | "whale" | "liquidation";
  sentiment: "bullish" | "bearish" | "neutral";
  tickers: string[];
  timestamp: Date;
  isBreaking: boolean;
  impact: "high" | "medium" | "low";
  whaleData?: {
    type: "transfer" | "exchange_inflow" | "exchange_outflow" | "liquidation";
    asset: string;
    amountUSD: number;
    from: string;
    to: string;
    severity: number;
    side?: "LONG" | "SHORT";
  };
}
