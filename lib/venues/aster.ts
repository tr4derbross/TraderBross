import type { VenueAdapter } from "@/lib/venues/types";
import {
  createPollingSubscribe,
  disconnectedResult,
  fetchJson,
  normalizeQuoteTicker,
  notEnabledAction,
} from "@/lib/venues/shared";

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const market = await fetchJson<{ assets: Array<{ name: string; markPx: number }> }>(
    "/api/aster?type=markets"
  );
  const asset = market.assets.find((item) => item.name === symbol);
  return asset ? normalizeQuoteTicker(symbol, asset.markPx, "Aster DEX") : null;
};

export const asterAdapter: VenueAdapter = {
  id: "aster",
  venueType: "wallet",
  marketDataLabel: "Aster DEX",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 5000),
  getBalance: async () => null,
  getPositions: async () => [],
  placeOrder: notEnabledAction("Aster execution will be enabled in the next phase."),
  cancelOrder: notEnabledAction("Aster execution will be enabled in the next phase."),
  setLeverage: notEnabledAction("Aster leverage configuration will be enabled in the next phase."),
  setMarginMode: notEnabledAction("Aster margin mode configuration will be enabled in the next phase."),
  testConnection: async (connection) => {
    if (!connection?.walletAddress) {
      return disconnectedResult("Connect a wallet before testing Aster.");
    }

    try {
      await fetchJson("/api/aster?type=markets");
      return {
        ok: true,
        message: "Aster market endpoint is reachable.",
        detail: "Wallet is connected and Aster market data is available.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Aster connection test failed.",
      };
    }
  },
};
