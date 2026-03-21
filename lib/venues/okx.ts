import type { VenueAdapter } from "@/lib/venues/types";
import { buildApiUrl } from "@/lib/runtime-env";
import {
  createPollingSubscribe,
  fetchJson,
  normalizeQuoteTicker,
} from "@/lib/venues/shared";

const PERP_MAP: Record<string, string> = {
  BTC: "BTC-USDT-SWAP",
  ETH: "ETH-USDT-SWAP",
  SOL: "SOL-USDT-SWAP",
  BNB: "BNB-USDT-SWAP",
  XRP: "XRP-USDT-SWAP",
  DOGE: "DOGE-USDT-SWAP",
  AVAX: "AVAX-USDT-SWAP",
  LINK: "LINK-USDT-SWAP",
  ARB: "ARB-USDT-SWAP",
  OP: "OP-USDT-SWAP",
  NEAR: "NEAR-USDT-SWAP",
  INJ: "INJ-USDT-SWAP",
  DOT: "DOT-USDT-SWAP",
};

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/okx?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "OKX Perpetuals") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const instId = PERP_MAP[symbol];
  const fallback = createPollingSubscribe(getTicker, 5000);
  if (!instId || typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        op: "subscribe",
        args: [{ channel: "tickers", instId }],
      })
    );
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { data?: Array<{ last?: string }> };
      const price = Number(payload.data?.[0]?.last);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "OKX Perpetuals"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    socket.close();
  };

  return () => socket.close();
};

export const okxAdapter: VenueAdapter = {
  id: "okx",
  venueType: "cex",
  marketDataLabel: "OKX Perpetuals",
  supportsOrderPlacement: true,
  getTicker,
  subscribeTicker,
  getBalance: async (connection) => {
    const token = connection?.sessionToken;
    if (!token) return null;
    try {
      const data = await fetchJson<{ total: number; available: number; currency: string }>("/api/okx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "balance", sessionToken: token }),
      });
      return { total: data.total, available: data.available, currency: data.currency };
    } catch {
      return null;
    }
  },
  getPositions: async (connection) => {
    const token = connection?.sessionToken;
    if (!token) return [];
    try {
      const data = await fetchJson<{
        positions: Array<{
          coin: string;
          side: "long" | "short";
          size: number;
          entryPx: number;
          pnl: number;
          liquidationPx: number | null;
          leverage: number;
          marginMode: "isolated" | "cross";
        }>;
      }>("/api/okx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "positions", sessionToken: token }),
      });
      return data.positions.map((p) => ({
        symbol: p.coin,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPx,
        pnl: p.pnl,
        liquidationPrice: p.liquidationPx,
        leverage: p.leverage,
        marginMode: p.marginMode,
      }));
    } catch {
      return [];
    }
  },
  placeOrder: async (input, connection) => {
    const res = await fetch(buildApiUrl("/api/okx/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "order",
        symbol: input.symbol,
        side: input.side,
        orderType: input.type,
        marginAmount: input.marginAmount,
        leverage: input.leverage,
        marginMode: input.marginMode,
        limitPrice: input.limitPrice,
        sessionToken: connection?.sessionToken,
      }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "Order submitted to OKX." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  cancelOrder: async (orderId, connection) => {
    const [symbol, oid] = orderId.split(":");
    const res = await fetch(buildApiUrl("/api/okx/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "cancel", symbol, orderId: oid, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "Order cancelled on OKX." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  setLeverage: async (input, connection) => {
    const res = await fetch(buildApiUrl("/api/okx/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "leverage", symbol: input.symbol, leverage: input.leverage, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "OKX leverage updated." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  setMarginMode: async (input, connection) => {
    const res = await fetch(buildApiUrl("/api/okx/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "marginType", symbol: input.symbol, marginMode: input.marginMode, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "OKX margin mode updated." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  testConnection: async (connection) =>
    fetchJson("/api/venues/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        connection?.sessionToken ? { venueId: "okx", sessionToken: connection.sessionToken } : {}
      ),
    }),
};
