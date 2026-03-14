import { createNormalizedTicker, createWebSocketAdapter } from "@/lib/market-data/shared";

export const hyperliquidMarketDataAdapter = createWebSocketAdapter({
  venue: "hyperliquid",
  url: "wss://api.hyperliquid.xyz/ws",
  subscribeMessage: () => ({
    method: "subscribe",
    subscription: { type: "allMids" },
  }),
  normalizeTickerPayload: (raw, symbol, connectionState) => {
    try {
      const payload = JSON.parse(String(raw)) as {
        channel?: string;
        data?: Record<string, string> | { mids?: Record<string, string> };
      };
      const mids =
        payload.channel === "allMids"
          ? "mids" in (payload.data ?? {})
            ? (payload.data as { mids?: Record<string, string> }).mids
            : (payload.data as Record<string, string>)
          : null;
      const mid = Number(mids?.[symbol]);
      if (!Number.isFinite(mid)) return null;
      return createNormalizedTicker(
        "hyperliquid",
        symbol,
        {
          markPrice: mid,
          lastPrice: mid,
          bid: null,
          ask: null,
          timestamp: Date.now(),
        },
        connectionState
      );
    } catch {
      return null;
    }
  },
});
