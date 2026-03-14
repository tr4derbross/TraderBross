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
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/bybit?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "Bybit Linear") : null;
};

export const bybitAdapter: VenueAdapter = {
  id: "bybit",
  venueType: "cex",
  marketDataLabel: "Bybit Linear",
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 5000),
  getBalance: emptyBalance,
  getPositions: emptyPositions,
  placeOrder: notEnabledAction("Bybit execution is not enabled yet."),
  cancelOrder: notEnabledAction("Bybit execution is not enabled yet."),
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
