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
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/okx?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "OKX Perpetuals") : null;
};

export const okxAdapter: VenueAdapter = {
  id: "okx",
  venueType: "cex",
  marketDataLabel: "OKX Perpetuals",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 5000),
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
