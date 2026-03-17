import type { NewsItem, TickerQuote } from "@/lib/mock-data";

export type FearGreedData = {
  value: number;
  label: string;
  history: Array<{
    value: number;
    label: string;
    timestamp: string;
  }>;
};

export type MarketStats = {
  marketCapUsd: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  marketCapChange24h: number | null;
  /** CoinGecko: total global 24h trading volume in USD */
  total24hVolume: number | null;
  /** CoinGecko: DeFi-specific market cap in USD */
  defiMarketCap: number | null;
  /** CoinGecko: number of tracked cryptocurrencies */
  activeCryptos: number | null;
};

/** Frankfurter (ECB) forex rates — free, no API key required */
export type ForexData = {
  /** EUR/USD – how many USD per 1 EUR, e.g. 1.086 */
  eurUsd: number | null;
  /** GBP/USD – how many USD per 1 GBP, e.g. 1.272 */
  gbpUsd: number | null;
  /** USD/JPY – how many JPY per 1 USD, e.g. 149.2 */
  usdJpy: number | null;
} | null;

export type MempoolStats = {
  fees: { fastestFee: number; halfHourFee: number; hourFee: number } | null;
  blockHeight: number | null;
  mempool: { count: number } | null;
  halving: { remainingBlocks: number } | null;
};

export type VenueQuotes = {
  Binance: TickerQuote[];
  OKX: TickerQuote[];
  Bybit: TickerQuote[];
};

export type EthGasData = {
  safe: number;
  average: number;
  fast: number;
} | null;

export type DefiTvlData = {
  tvl: number | null;
} | null;

export type LiquidationEvent = {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  price: number;
  usdValue: number;
  timestamp: string;
};

export type BackendSnapshot = {
  quotes: TickerQuote[];
  venueQuotes: VenueQuotes;
  marketStats: MarketStats | null;
  mempoolStats: MempoolStats | null;
  fearGreed: FearGreedData | null;
  ethGas: EthGasData;
  defiTvl: DefiTvlData;
  forex: ForexData;
  liquidations: LiquidationEvent[];
  news: NewsItem[];
  whales: NewsItem[];
  social: NewsItem[];
  connectionState: "connecting" | "connected" | "disconnected";
};

export type RealtimeEnvelope =
  | { type: "snapshot"; payload: BackendSnapshot; timestamp: string }
  | { type: "quotes"; payload: TickerQuote[]; timestamp: string }
  | { type: "venueQuotes"; payload: VenueQuotes; timestamp: string }
  | { type: "marketStats"; payload: MarketStats; timestamp: string }
  | { type: "mempoolStats"; payload: MempoolStats; timestamp: string }
  | { type: "fearGreed"; payload: FearGreedData; timestamp: string }
  | { type: "ethGas"; payload: EthGasData; timestamp: string }
  | { type: "defiTvl"; payload: DefiTvlData; timestamp: string }
  | { type: "forex"; payload: ForexData; timestamp: string }
  | { type: "liquidation"; payload: LiquidationEvent; timestamp: string }
  | { type: "news"; payload: NewsItem; timestamp: string }
  | { type: "social"; payload: NewsItem[]; timestamp: string }
  | { type: "whales"; payload: NewsItem[]; timestamp: string }
  | { type: "heartbeat"; payload: { ok: boolean; ts: number }; timestamp: string };
