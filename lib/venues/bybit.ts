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

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/bybit?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "Bybit Linear") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const market = PERP_MAP[symbol];
  const fallback = createPollingSubscribe(getTicker, 5000);
  if (!market || typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        op: "subscribe",
        args: [`tickers.${market}`],
      })
    );
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { data?: { lastPrice?: string } };
      const price = Number(payload.data?.lastPrice);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "Bybit Linear"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    socket.close();
  };

  return () => socket.close();
};

export const bybitAdapter: VenueAdapter = {
  id: "bybit",
  venueType: "cex",
  marketDataLabel: "Bybit Linear",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker,
  getBalance: emptyBalance,
  getPositions: emptyPositions,
  placeOrder: notEnabledAction("Bybit execution is not enabled yet."),
  cancelOrder: notEnabledAction("Bybit execution is not enabled yet."),
  setLeverage: notEnabledAction("Bybit leverage configuration is not enabled yet."),
  setMarginMode: notEnabledAction("Bybit margin mode configuration is not enabled yet."),
  testConnection: async (connection) =>
    fetchJson("/api/venues/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: "bybit",
        apiKey: connection?.apiKey,
        apiSecret: connection?.apiSecret,
      }),
    }),
};
