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
    "/api/hyperliquid?type=market"
  );
  const asset = market.assets.find((item) => item.name === symbol);
  return asset ? normalizeQuoteTicker(symbol, asset.markPx, "Hyperliquid Mark Price") : null;
};

export const hyperliquidAdapter: VenueAdapter = {
  id: "hyperliquid",
  venueType: "wallet",
  marketDataLabel: "Hyperliquid Mark Price",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 5000),
  getBalance: async (connection) => {
    if (!connection?.walletAddress) return null;
    const account = await fetchJson<{ balance: number; withdrawable?: number }>(
      `/api/hyperliquid?type=account&address=${connection.walletAddress}`
    );
    return {
      total: account.balance,
      available: account.withdrawable,
      currency: "USDC",
    };
  },
  getPositions: async (connection) => {
    if (!connection?.walletAddress) return [];
    const account = await fetchJson<{
      positions: Array<{
        coin: string;
        side: "long" | "short";
        size: number;
        entryPx: number;
        pnl: number;
        liquidationPx: number | null;
      }>;
    }>(`/api/hyperliquid?type=account&address=${connection.walletAddress}`);
    return account.positions.map((position) => ({
      symbol: position.coin,
      side: position.side,
      size: position.size,
      entryPrice: position.entryPx,
      pnl: position.pnl,
      liquidationPrice: position.liquidationPx,
    }));
  },
  placeOrder: notEnabledAction("Hyperliquid execution is not enabled yet."),
  cancelOrder: notEnabledAction("Hyperliquid execution is not enabled yet."),
  setLeverage: notEnabledAction("Hyperliquid leverage configuration is not enabled yet."),
  setMarginMode: notEnabledAction("Hyperliquid margin mode configuration is not enabled yet."),
  testConnection: async (connection) => {
    if (!connection?.walletAddress) {
      return disconnectedResult("Connect a wallet before testing Hyperliquid.");
    }

    try {
      await fetchJson(`/api/hyperliquid?type=account&address=${connection.walletAddress}`);
      return {
        ok: true,
        message: "Hyperliquid wallet connection is ready.",
        detail: "Account endpoint responded for the connected wallet.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Hyperliquid connection test failed.",
      };
    }
  },
};
