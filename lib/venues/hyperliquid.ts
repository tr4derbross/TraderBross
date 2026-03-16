import type { VenueAdapter, VenueActionResult } from "@/lib/venues/types";
import {
  createPollingSubscribe,
  disconnectedResult,
  fetchJson,
  normalizeQuoteTicker,
} from "@/lib/venues/shared";

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const market = await fetchJson<{ assets: Array<{ name: string; markPx: number }> }>(
    "/api/hyperliquid?type=market"
  );
  const asset = market.assets.find((item) => item.name === symbol);
  return asset ? normalizeQuoteTicker(symbol, asset.markPx, "Hyperliquid Mark Price") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const fallback = createPollingSubscribe(getTicker, 5000);
  if (typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket("wss://api.hyperliquid.xyz/ws");

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        method: "subscribe",
        subscription: { type: "allMids" },
      })
    );
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as {
        channel?: string;
        data?: Record<string, string> | { mids?: Record<string, string> };
      };
      const mids =
        payload.channel === "allMids"
          ? ("mids" in (payload.data ?? {}) ? (payload.data as { mids?: Record<string, string> }).mids : (payload.data as Record<string, string>))
          : null;
      const price = Number(mids?.[symbol]);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "Hyperliquid Mark Price"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => { socket.close(); };
  return () => socket.close();
};

async function hlOrderPost(body: Record<string, unknown>): Promise<VenueActionResult> {
  try {
    const res = await fetch("/api/hyperliquid/order", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json() as { ok?: boolean; error?: string; data?: unknown };
    if (!res.ok || data.error) {
      return { ok: false, message: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, message: "Order submitted to Hyperliquid." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed" };
  }
}

export const hyperliquidAdapter: VenueAdapter = {
  id:                    "hyperliquid",
  venueType:             "wallet",
  marketDataLabel:       "Hyperliquid Mark Price",
  supportsOrderPlacement: true,

  getTicker,
  subscribeTicker,

  getBalance: async (connection) => {
    if (!connection?.walletAddress) return null;
    const account = await fetchJson<{ balance: number; withdrawable?: number }>(
      `/api/hyperliquid?type=account&address=${connection.walletAddress}`
    );
    return { total: account.balance, available: account.withdrawable, currency: "USDC" };
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
    return account.positions.map((p) => ({
      symbol:           p.coin,
      side:             p.side,
      size:             p.size,
      entryPrice:       p.entryPx,
      pnl:              p.pnl,
      liquidationPrice: p.liquidationPx,
    }));
  },

  placeOrder: async (input, _connection) => {
    return hlOrderPost({
      type:         "order",
      symbol:       input.symbol,
      side:         input.side,
      orderType:    input.type,
      marginAmount: input.marginAmount,
      leverage:     input.leverage,
      limitPrice:   input.limitPrice,
    });
  },

  cancelOrder: async (orderId, _connection) => {
    // orderId format: "SYMBOL:oid"
    const [symbol, oidStr] = orderId.split(":");
    return hlOrderPost({ type: "cancel", symbol, orderId: parseInt(oidStr, 10) });
  },

  setLeverage: async (input, _connection) => {
    return hlOrderPost({ type: "leverage", symbol: input.symbol, leverage: input.leverage });
  },

  setMarginMode: async (input, _connection) => {
    return hlOrderPost({
      type:    "marginMode",
      symbol:  input.symbol,
      isCross: input.marginMode === "cross",
    });
  },

  testConnection: async (connection) => {
    if (!connection?.walletAddress) {
      return disconnectedResult("Connect a wallet before testing Hyperliquid.");
    }
    try {
      await fetchJson(`/api/hyperliquid?type=account&address=${connection.walletAddress}`);
      return {
        ok:     true,
        message: "Hyperliquid wallet connection is ready.",
        detail:  "Account endpoint responded for the connected wallet.",
      };
    } catch (error) {
      return {
        ok:      false,
        message: error instanceof Error ? error.message : "Hyperliquid connection test failed.",
      };
    }
  },
};
