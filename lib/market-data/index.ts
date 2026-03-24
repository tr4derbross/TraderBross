import type { TradingVenueId } from "@/lib/active-venue";
import type { MarketDataAdapter } from "@/lib/market-data/types";
import { binanceMarketDataAdapter } from "@/lib/market-data/binance";
import { okxMarketDataAdapter } from "@/lib/market-data/okx";
import { bybitMarketDataAdapter } from "@/lib/market-data/bybit";
import { hyperliquidMarketDataAdapter } from "@/lib/market-data/hyperliquid";
import { asterMarketDataAdapter } from "@/lib/market-data/aster";

export const marketDataAdapters: Record<TradingVenueId, MarketDataAdapter> = {
  binance: binanceMarketDataAdapter,
  okx: okxMarketDataAdapter,
  bybit: bybitMarketDataAdapter,
  hyperliquid: hyperliquidMarketDataAdapter,
  aster: asterMarketDataAdapter,
};

export function getMarketDataAdapter(venue: TradingVenueId) {
  return marketDataAdapters[venue];
}
