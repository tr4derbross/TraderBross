"use client";

import { useEffect, useState } from "react";
import type { TradingVenueId } from "@/lib/active-venue";
import { getMarketDataAdapter } from "@/lib/market-data";
import type { MarketDataConnectionState, NormalizedTicker } from "@/lib/market-data/types";

type StreamState = {
  ticker: NormalizedTicker | null;
  connectionState: MarketDataConnectionState;
};

export function useVenueMarketData(venueId: TradingVenueId, symbol: string) {
  const [state, setState] = useState<StreamState>({
    ticker: null,
    connectionState: "idle",
  });

  useEffect(() => {
    let active = true;
    const adapter = getMarketDataAdapter(venueId);
    let cleanup: (() => void) | undefined;

    setState({ ticker: null, connectionState: "connecting" });

    adapter
      .connect((connectionState) => {
        if (!active) return;
        setState((prev) => ({ ...prev, connectionState }));
      })
      .then(async (connection) => {
        if (!active) {
          await adapter.disconnect(connection);
          return;
        }

        const handler = (ticker: NormalizedTicker) => {
          if (!active) return;
          setState({
            ticker,
            connectionState: ticker.connectionState,
          });
        };

        await adapter.subscribeTicker(connection, symbol, handler);
        cleanup = () => {
          void adapter.unsubscribeTicker(connection, symbol, handler);
          void adapter.disconnect(connection);
        };
      })
      .catch(() => {
        if (active) {
          setState({ ticker: null, connectionState: "error" });
        }
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [symbol, venueId]);

  return state;
}
