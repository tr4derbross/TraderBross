export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  thumb: string;
  priceChangePercent24h: number | null;
  priceBtc: number | null;
}

export interface GlobalMarketStats {
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  btcDominance: number;
  ethDominance: number;
  activeCurrencies: number;
  marketCapChangePercent24h: number;
  updatedAt: string;
}

export interface TrendingResponse {
  trending: TrendingCoin[];
  global: GlobalMarketStats | null;
}
