"use client";

import { useMemo } from "react";
import type { TradingVenueId } from "@/lib/active-venue";
import { useRealtimeSelector } from "@/lib/realtime-client";
import type { MarketDataConnectionState, NormalizedTicker } from "@/lib/market-data/types";

export function useVenueMarketData(venueId: TradingVenueId, symbol: string) {
  const venueQuotes = useRealtimeSelector((state) => state.venueQuotes);
  const quotes = useRealtimeSelector((state) => state.quotes);
  const connectionState = useRealtimeSelector<MarketDataConnectionState>((state) =>
    state.connectionStatus === "connected" ? "connected" : state.connectionStatus === "connecting" ? "connecting" : "error",
  );

  const ticker = useMemo<NormalizedTicker | null>(() => {
    const venueMap =
      venueId === "okx"
        ? venueQuotes.OKX
        : venueId === "bybit"
          ? venueQuotes.Bybit
          : venueId === "binance"
            ? quotes
            : quotes;
    const quote = venueMap.find((item) => item.symbol === symbol);
    if (!quote) {
      return null;
    }
    return {
      symbol,
      venue: venueId,
      markPrice: quote.price,
      lastPrice: quote.price,
      bid: quote.price,
      ask: quote.price,
      timestamp: Date.now(),
      connectionState,
    };
  }, [connectionState, quotes, symbol, venueId, venueQuotes.Bybit, venueQuotes.OKX]);

  return {
    ticker,
    connectionState,
  };
}
