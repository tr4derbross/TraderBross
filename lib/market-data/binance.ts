import { createNormalizedTicker, createWebSocketAdapter } from "@/lib/market-data/shared";

export const binanceMarketDataAdapter = createWebSocketAdapter({
  venue: "binance",
  url: "wss://fstream.binance.com/ws",
  subscribeMessage: (symbol) => ({
    method: "SUBSCRIBE",
    params: [`${symbol.toLowerCase()}usdt@markPrice@1s`],
    id: 1,
  }),
  unsubscribeMessage: (symbol) => ({
    method: "UNSUBSCRIBE",
    params: [`${symbol.toLowerCase()}usdt@markPrice@1s`],
    id: 1,
  }),
  normalizeTickerPayload: (raw, symbol, connectionState) => {
    try {
      const payload = JSON.parse(String(raw)) as { p?: string; s?: string; E?: number };
      if (payload.s && payload.s !== `${symbol}USDT`) return null;
      const markPrice = Number(payload.p);
      if (!Number.isFinite(markPrice)) return null;
      return createNormalizedTicker(
        "binance",
        symbol,
        {
          markPrice,
          lastPrice: markPrice,
          bid: null,
          ask: null,
          timestamp: payload.E ?? Date.now(),
        },
        connectionState
      );
    } catch {
      return null;
    }
  },
});
