import type { VenueAdapter } from "@/lib/venues/types";
import { buildApiUrl } from "@/lib/runtime-env";
import {
  createPollingSubscribe,
  fetchJson,
  normalizeQuoteTicker,
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

async function binanceOrderPost(body: Record<string, unknown>) {
  const res = await fetch(buildApiUrl("/api/binance/order"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok?: boolean; error?: string; data?: unknown };
  if (!res.ok || !data.ok) {
    return { ok: false as const, message: data.error ?? `HTTP ${res.status}` };
  }
  return { ok: true as const, message: "Order submitted to Binance Futures." };
}

async function binanceDataPost<T>(type: string, sessionToken: string): Promise<T> {
  const res = await fetch(buildApiUrl("/api/binance"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, sessionToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Binance data error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const binanceAdapter: VenueAdapter = {
  id: "binance",
  venueType: "cex",
  marketDataLabel: "Binance Futures",
  supportsOrderPlacement: true,

  getTicker,
  subscribeTicker,

  getBalance: async (connection) => {
    const token = connection?.sessionToken;
    if (!token) return null;
    try {
      const data = await binanceDataPost<{ total: number; available: number; currency: string }>(
        "balance",
        token
      );
      return { total: data.total, available: data.available, currency: data.currency };
    } catch {
      return null;
    }
  },

  getPositions: async (connection) => {
    const token = connection?.sessionToken;
    if (!token) return [];
    try {
      const data = await binanceDataPost<{
        positions: Array<{
          coin: string;
          side: "long" | "short";
          size: number;
          entryPx: number;
          pnl: number;
          liquidationPx: number | null;
        }>;
      }>("positions", token);
      return data.positions.map((p) => ({
        symbol: p.coin,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPx,
        pnl: p.pnl,
        liquidationPrice: p.liquidationPx,
      }));
    } catch {
      return [];
    }
  },

  placeOrder: async (input, connection) => {
    return binanceOrderPost({
      type: "order",
      symbol: input.symbol,
      side: input.side,
      orderType: input.type,
      marginAmount: input.marginAmount,
      leverage: input.leverage,
      limitPrice: input.limitPrice,
      sessionToken: connection?.sessionToken,
    });
  },

  cancelOrder: async (orderId, connection) => {
    // orderId format: "SYMBOL:orderId"
    const [symbol, oid] = orderId.split(":");
    return binanceOrderPost({
      type: "cancel",
      symbol,
      orderId: oid,
      sessionToken: connection?.sessionToken,
    });
  },

  setLeverage: async (input, connection) => {
    return binanceOrderPost({
      type: "leverage",
      symbol: input.symbol,
      leverage: input.leverage,
      sessionToken: connection?.sessionToken,
    });
  },

  setMarginMode: async (input, connection) => {
    return binanceOrderPost({
      type: "marginType",
      symbol: input.symbol,
      marginMode: input.marginMode,
      sessionToken: connection?.sessionToken,
    });
  },

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
