import type { VenueAdapter } from "@/lib/venues/types";
import {
  createPollingSubscribe,
  emptyBalance,
  emptyPositions,
  fetchJson,
  normalizeQuoteTicker,
  notEnabledAction,
} from "@/lib/venues/shared";

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/prices?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "Binance Futures") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const pair = `${symbol}USDT`.toLowerCase();
  const fallback = createPollingSubscribe(getTicker, 3000);

  if (typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket(`wss://fstream.binance.com/ws/${pair}@markPrice@1s`);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { p?: string; s?: string };
      const price = Number(payload.p);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "Binance Futures"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    socket.close();
  };

  return () => socket.close();
};

export const binanceAdapter: VenueAdapter = {
  id: "binance",
  venueType: "cex",
  marketDataLabel: "Binance Futures",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker,
  getBalance: emptyBalance,
  getPositions: emptyPositions,
  placeOrder: notEnabledAction("Binance execution is not enabled yet."),
  cancelOrder: notEnabledAction("Binance execution is not enabled yet."),
  setLeverage: notEnabledAction("Binance leverage configuration is not enabled yet."),
  setMarginMode: notEnabledAction("Binance margin mode configuration is not enabled yet."),
  testConnection: async (connection) =>
    fetchJson("/api/venues/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        connection?.sessionToken
          ? { venueId: "binance", sessionToken: connection.sessionToken }
          : { venueId: "binance", apiKey: connection?.apiKey, apiSecret: connection?.apiSecret }
      ),
    }),
};
