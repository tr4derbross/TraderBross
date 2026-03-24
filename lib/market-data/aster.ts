import { createNormalizedTicker, createPollingMarketDataAdapter } from "@/lib/market-data/shared";

export const asterMarketDataAdapter = createPollingMarketDataAdapter(
  "aster",
  (symbol, connectionState, price, timestamp) =>
    createNormalizedTicker(
      "aster",
      symbol,
      {
        markPrice: price,
        lastPrice: price,
        bid: null,
        ask: null,
        timestamp,
      },
      connectionState
    )
);
