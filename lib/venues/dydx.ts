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
    "/api/dydx?type=markets"
  );
  const asset = market.assets.find((item) => item.name === symbol);
  return asset ? normalizeQuoteTicker(symbol, asset.markPx, "dYdX Indexer") : null;
};

export const dydxAdapter: VenueAdapter = {
  id: "dydx",
  venueType: "wallet",
  marketDataLabel: "dYdX Indexer",
  supportsOrderPlacement: false,
  getTicker,
  subscribeTicker: createPollingSubscribe(getTicker, 5000),
  getBalance: async (connection) => {
    if (!connection?.walletAddress) return null;
    const account = await fetchJson<{ balance: number; freeCollateral?: number }>(
      `/api/dydx?type=account&address=${connection.walletAddress}`
    );
    return {
      total: account.balance,
      available: account.freeCollateral,
      currency: "USDC",
    };
  },
  getPositions: async (connection) => {
    if (!connection?.walletAddress) return [];
    const [account, market] = await Promise.all([
      fetchJson<{
        positions: Array<{
          coin: string;
          side: "long" | "short";
          size: number;
          entryPx: number;
          pnl: number;
          margin?: number;
        }>;
      }>(`/api/dydx?type=account&address=${connection.walletAddress}`),
      fetchJson<{
        assets: Array<{ name: string; markPx: number; fundingRate?: number }>;
      }>("/api/dydx?type=markets").catch(() => ({ assets: [] })),
    ]);

    const marketByCoin = new Map(
      (Array.isArray(market?.assets) ? market.assets : []).map((asset) => [
        String(asset?.name || "").toUpperCase(),
        asset,
      ])
    );

    return account.positions.map((position) => {
      const asset = marketByCoin.get(String(position.coin || "").toUpperCase());
      const markPrice = Number(asset?.markPx || 0) || undefined;
      const notional =
        Number.isFinite(Number(markPrice)) && Number.isFinite(Number(position.size))
          ? Number(markPrice) * Number(position.size)
          : 0;
      const fundingRate = Number(asset?.fundingRate || 0);
      const estimatedFundingFee =
        Number.isFinite(fundingRate) && Number.isFinite(notional)
          ? notional * fundingRate * (position.side === "long" ? -1 : 1)
          : undefined;
      return {
        symbol: position.coin,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPx,
        markPrice,
        pnl: position.pnl,
        liquidationPrice: null,
        margin: Number.isFinite(Number(position.margin))
          ? Number(position.margin)
          : undefined,
        estimatedFundingFee,
      };
    });
  },
  placeOrder: notEnabledAction("dYdX execution is not enabled yet."),
  cancelOrder: notEnabledAction("dYdX execution is not enabled yet."),
  setLeverage: notEnabledAction("dYdX leverage configuration is not enabled yet."),
  setMarginMode: notEnabledAction("dYdX margin mode configuration is not enabled yet."),
  testConnection: async (connection) => {
    if (!connection?.walletAddress) {
      return disconnectedResult("Connect a wallet or address before testing dYdX.");
    }

    try {
      await fetchJson(`/api/dydx?type=account&address=${connection.walletAddress}`);
      return {
        ok: true,
        message: "dYdX wallet connection is ready.",
        detail: "Indexer account endpoint responded for the connected address.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "dYdX connection test failed.",
      };
    }
  },
};
