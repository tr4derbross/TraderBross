import type { VenueAdapter } from "@/lib/venues/types";
import {
  createPollingSubscribe,
  emptyBalance,
  emptyPositions,
  fetchJson,
  normalizeQuoteTicker,
  notEnabledAction,
} from "@/lib/venues/shared";

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

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/okx?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "OKX Perpetuals") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const instId = PERP_MAP[symbol];
  const fallback = createPollingSubscribe(getTicker, 5000);
  if (!instId || typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        op: "subscribe",
        args: [{ channel: "tickers", instId }],
      })
    );
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { data?: Array<{ last?: string }> };
      const price = Number(payload.data?.[0]?.last);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "OKX Perpetuals"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    socket.close();
  };

  return () => socket.close();
};

export const okxAdapter: VenueAdapter = {
  id: "okx",
  venueType: "cex",
  marketDataLabel: "OKX Perpetuals",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker,
  getBalance: emptyBalance,
  getPositions: emptyPositions,
  placeOrder: notEnabledAction("OKX execution is not enabled yet."),
  cancelOrder: notEnabledAction("OKX execution is not enabled yet."),
  setLeverage: notEnabledAction("OKX leverage configuration is not enabled yet."),
  setMarginMode: notEnabledAction("OKX margin mode configuration is not enabled yet."),
  testConnection: async (connection) =>
    fetchJson("/api/venues/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: "okx",
        apiKey: connection?.apiKey,
        apiSecret: connection?.apiSecret,
        passphrase: connection?.passphrase,
      }),
    }),
};
