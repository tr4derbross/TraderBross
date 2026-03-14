import { createNormalizedTicker, createWebSocketAdapter } from "@/lib/market-data/shared";

const PERP_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  ARB: "ARBUSDT",
  OP: "OPUSDT",
  NEAR: "NEARUSDT",
  INJ: "INJUSDT",
  DOT: "DOTUSDT",
};

export const bybitMarketDataAdapter = createWebSocketAdapter({
  venue: "bybit",
  url: "wss://stream.bybit.com/v5/public/linear",
  subscribeMessage: (symbol) => ({
    op: "subscribe",
    args: [`tickers.${PERP_MAP[symbol]}`],
  }),
  unsubscribeMessage: (symbol) => ({
    op: "unsubscribe",
    args: [`tickers.${PERP_MAP[symbol]}`],
  }),
  normalizeTickerPayload: (raw, symbol, connectionState) => {
    try {
      const payload = JSON.parse(String(raw)) as {
        topic?: string;
        data?: {
          symbol?: string;
          lastPrice?: string;
          markPrice?: string;
          bid1Price?: string;
          ask1Price?: string;
          time?: number;
        };
      };
      if (payload.topic && payload.topic !== `tickers.${PERP_MAP[symbol]}`) return null;
      const frame = payload.data;
      if (!frame) return null;
      const lastPrice = Number(frame.lastPrice);
      const markPrice = Number(frame.markPrice);
      if (!Number.isFinite(lastPrice) && !Number.isFinite(markPrice)) return null;
      return createNormalizedTicker(
        "bybit",
        symbol,
        {
          markPrice: Number.isFinite(markPrice) ? markPrice : lastPrice,
          lastPrice: Number.isFinite(lastPrice) ? lastPrice : markPrice,
          bid: Number(frame.bid1Price) || null,
          ask: Number(frame.ask1Price) || null,
          timestamp: frame.time ?? Date.now(),
        },
        connectionState
      );
    } catch {
      return null;
    }
  },
});
