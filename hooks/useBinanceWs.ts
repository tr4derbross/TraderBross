"use client";

import { useMemo } from "react";
import { useRealtimeSelector } from "@/lib/realtime-client";

export function useBinanceWs() {
  const quotes = useRealtimeSelector((state) => state.quotes);
  const connected = useRealtimeSelector((state) =>
    state.connectionStatus === "live" ||
    state.connectionStatus === "degraded" ||
    state.connectionStatus === "stale",
  );

  const prices = useMemo(
    () =>
      Object.fromEntries(
        quotes.map((quote) => [quote.symbol, quote.price]),
      ),
    [quotes],
  );

  return { prices, quotes, connected };
}
