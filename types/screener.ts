export interface ScreenerCoin {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  trades24h: number;
  rsi14?: number | null;
  openInterestUsd?: number | null;
  longShortRatio?: number | null;
}
