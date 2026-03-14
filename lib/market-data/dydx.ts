import { createNormalizedTicker, createPollingMarketDataAdapter } from "@/lib/market-data/shared";

export const dydxMarketDataAdapter = createPollingMarketDataAdapter(
  "dydx",
  (symbol, connectionState, price, timestamp) =>
    createNormalizedTicker(
      "dydx",
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
