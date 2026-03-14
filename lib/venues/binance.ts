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

export const binanceAdapter: VenueAdapter = {
  id: "binance",
  venueType: "cex",
  marketDataLabel: "Binance Futures",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 3000),
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
      body: JSON.stringify({
        venueId: "binance",
        apiKey: connection?.apiKey,
        apiSecret: connection?.apiSecret,
      }),
    }),
};
