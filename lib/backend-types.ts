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
  whaleEvents?: Array<{
    id: string;
    chain: string;
    txHash: string | null;
    token: string;
    amount: number;
    usdValue: number;
    fromLabel: string;
    toLabel: string;
    eventType:
      | "large_transfer"
      | "exchange_inflow"
      | "exchange_outflow"
      | "stablecoin_mint"
      | "stablecoin_burn"
      | "treasury_movement"
      | "smart_money_watch"
      | "liquidation";
    timestamp: string;
    confidence: number;
    significance: number;
    relatedAssets: string[];
    watchlistRelevance?: number;
    relevanceLabels?: string[];
    priorityLabel?: string;
  }>;
  social: NewsItem[];
  newsSnapshot?: {
    generatedAt: string;
    count: number;
    items: Array<{
      kind?: "news";
      id: string;
      source: string;
      title: string;
      summary: string;
      url: string;
      publishedAt: string;
      tickers: string[];
      relatedAssets?: string[];
      tags: string[];
      priority: {
        score: number;
        label: "low" | "medium" | "high";
        components: {
          source: number;
          recency: number;
          keyword: number;
          watchlist: number;
        };
      };
      sentiment: "bullish" | "bearish" | "neutral";
      watchlistRelevance?: number;
      relevanceLabels?: string[];
      priorityLabel?: string;
      eventType:
        | "breaking"
        | "regulation"
        | "exchange"
        | "listing"
        | "exploit"
        | "macro"
        | "stablecoin"
        | "onchain"
        | "watchlist"
        | "noise";
    }>;
    clusters: Array<{
      clusterId: string;
      headline: string;
      size: number;
      sources: string[];
      itemIds: string[];
    }>;
    status: "ok" | "empty";
    errors: string[];
  };
  coinMetadata?: Record<string, {
    symbol: string;
    id: string;
    name: string;
    image: string;
    marketCapRank: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
    maxSupply: number | null;
    lastUpdated: string;
    provider: string;
  }>;
  discovery?: Array<{
    baseSymbol: string;
    quoteSymbol: string;
    pairAddress: string;
    dexId: string;
    chainId: string;
    liquidityUsd: number;
    volume24hUsd: number;
    priceUsd: number;
    url: string;
    provider: string;
    timestamp: string;
  }>;
  providerState?: Record<string, string>;
  providerHealth?: Record<string, {
    status: string;
    providerCalls: number;
    cacheHits: number;
    staleServed: number;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  }>;
  connectionState: "connecting" | "connected" | "degraded" | "disconnected";
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
  | { type: "newsRanked"; payload: {
      id: string;
      source: string;
      title: string;
      summary: string;
      url: string;
      publishedAt: string;
      tickers: string[];
      tags: string[];
      priority: {
        score: number;
        label: "low" | "medium" | "high";
      };
      sentiment: "bullish" | "bearish" | "neutral";
      eventType: string;
    }; timestamp: string }
  | { type: "social"; payload: NewsItem[]; timestamp: string }
  | { type: "whales"; payload: NewsItem[]; timestamp: string }
  | { type: "whaleEvents"; payload: NonNullable<BackendSnapshot["whaleEvents"]>; timestamp: string }
  | { type: "heartbeat"; payload: { ok: boolean; ts: number }; timestamp: string };
