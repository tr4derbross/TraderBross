import type { TradingVenueId } from "@/lib/active-venue";
import type { VenueAdapter } from "@/lib/venues/types";
import { binanceAdapter } from "@/lib/venues/binance";
import { okxAdapter } from "@/lib/venues/okx";
import { bybitAdapter } from "@/lib/venues/bybit";
import { hyperliquidAdapter } from "@/lib/venues/hyperliquid";
import { asterAdapter } from "@/lib/venues/aster";

export const venueAdapters: Record<TradingVenueId, VenueAdapter> = {
  binance: binanceAdapter,
  okx: okxAdapter,
  bybit: bybitAdapter,
  hyperliquid: hyperliquidAdapter,
  aster: asterAdapter,
};

export function getVenueAdapter(venueId: TradingVenueId) {
  return venueAdapters[venueId];
}
