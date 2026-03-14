import { createNormalizedTicker, createWebSocketAdapter } from "@/lib/market-data/shared";

const PERP_MAP: Record<string, string> = {
  BTC: "BTC-USDT-SWAP",
  ETH: "ETH-USDT-SWAP",
  SOL: "SOL-USDT-SWAP",
  BNB: "BNB-USDT-SWAP",
  XRP: "XRP-USDT-SWAP",
  DOGE: "DOGE-USDT-SWAP",
  AVAX: "AVAX-USDT-SWAP",
  LINK: "LINK-USDT-SWAP",
  ARB: "ARB-USDT-SWAP",
  OP: "OP-USDT-SWAP",
  NEAR: "NEAR-USDT-SWAP",
  INJ: "INJ-USDT-SWAP",
  DOT: "DOT-USDT-SWAP",
};

export const okxMarketDataAdapter = createWebSocketAdapter({
  venue: "okx",
  url: "wss://ws.okx.com:8443/ws/v5/public",
  subscribeMessage: (symbol) => ({
    op: "subscribe",
    args: [{ channel: "tickers", instId: PERP_MAP[symbol] }],
  }),
  unsubscribeMessage: (symbol) => ({
    op: "unsubscribe",
    args: [{ channel: "tickers", instId: PERP_MAP[symbol] }],
  }),
  normalizeTickerPayload: (raw, symbol, connectionState) => {
    try {
      const payload = JSON.parse(String(raw)) as {
        arg?: { instId?: string };
        data?: Array<{ last?: string; bidPx?: string; askPx?: string; ts?: string }>;
      };
      if (payload.arg?.instId && payload.arg.instId !== PERP_MAP[symbol]) return null;
      const frame = payload.data?.[0];
      if (!frame) return null;
      const lastPrice = Number(frame.last);
      if (!Number.isFinite(lastPrice)) return null;
      return createNormalizedTicker(
        "okx",
        symbol,
        {
          markPrice: lastPrice,
          lastPrice,
          bid: Number(frame.bidPx) || null,
          ask: Number(frame.askPx) || null,
          timestamp: Number(frame.ts) || Date.now(),
        },
        connectionState
      );
    } catch {
      return null;
    }
  },
});
