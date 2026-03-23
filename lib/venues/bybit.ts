import type { VenueAdapter } from "@/lib/venues/types";
import { buildApiUrl } from "@/lib/runtime-env";
import {
  createPollingSubscribe,
  fetchJson,
  normalizeQuoteTicker,
} from "@/lib/venues/shared";

const PERP_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  ARB: "ARBUSDT",
  OP: "OPUSDT",
  NEAR: "NEARUSDT",
  INJ: "INJUSDT",
  DOT: "DOTUSDT",
};

const getTicker: VenueAdapter["getTicker"] = async (symbol) => {
  const quotes = await fetchJson<Array<{ symbol: string; price: number }>>("/api/bybit?type=quotes");
  const quote = quotes.find((item) => item.symbol === symbol);
  return quote ? normalizeQuoteTicker(symbol, quote.price, "Bybit Linear") : null;
};

const subscribeTicker: VenueAdapter["subscribeTicker"] = (symbol, onTick) => {
  const market = PERP_MAP[symbol];
  const fallback = createPollingSubscribe(getTicker, 5000);
  if (!market || typeof WebSocket === "undefined") {
    return fallback(symbol, onTick);
  }

  const socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        op: "subscribe",
        args: [`tickers.${market}`],
      })
    );
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { data?: { lastPrice?: string } };
      const price = Number(payload.data?.lastPrice);
      if (!Number.isFinite(price)) return;
      onTick(normalizeQuoteTicker(symbol, price, "Bybit Linear"));
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    socket.close();
  };

  return () => socket.close();
};

export const bybitAdapter: VenueAdapter = {
  id: "bybit",
  venueType: "cex",
  marketDataLabel: "Bybit Linear",
  supportsOrderPlacement: true,
  getTicker,
  subscribeTicker,
  getBalance: async (connection) => {
    const token = connection?.sessionToken;
    if (!token) return null;
    try {
      const data = await fetchJson<{ total: number; available: number; currency: string }>("/api/bybit", {
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
          tpPrice?: number;
          slPrice?: number;
        }>;
      }>("/api/bybit", {
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
        tpPrice: p.tpPrice,
        slPrice: p.slPrice,
      }));
    } catch {
      return [];
    }
  },
  placeOrder: async (input, connection) => {
    try {
      const res = await fetch(buildApiUrl("/api/bybit/order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          type: "order",
          symbol: input.symbol,
          side: input.side,
          orderType: input.type,
          marginAmount: input.marginAmount,
          leverage: input.leverage,
          marginMode: input.marginMode,
          limitPrice: input.limitPrice,
          tpPrice: input.tpPrice,
          slPrice: input.slPrice,
          sessionToken: connection?.sessionToken,
        }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      return data.ok ? { ok: true, message: "Order submitted to Bybit." } : { ok: false, message: data.error || `HTTP ${res.status}` };
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.message === "signal timed out");
      return { ok: false, message: isTimeout ? "Connection timeout — please retry." : (error instanceof Error ? error.message : "Request failed.") };
    }
  },
  cancelOrder: async (orderId, connection) => {
    const [symbol, oid] = orderId.split(":");
    const res = await fetch(buildApiUrl("/api/bybit/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ type: "cancel", symbol, orderId: oid, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "Order cancelled on Bybit." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  setLeverage: async (input, connection) => {
    const res = await fetch(buildApiUrl("/api/bybit/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ type: "leverage", symbol: input.symbol, leverage: input.leverage, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "Bybit leverage updated." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  setMarginMode: async (input, connection) => {
    const res = await fetch(buildApiUrl("/api/bybit/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ type: "marginType", symbol: input.symbol, marginMode: input.marginMode, sessionToken: connection?.sessionToken }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true, message: "Bybit margin mode updated." } : { ok: false, message: data.error || `HTTP ${res.status}` };
  },
  testConnection: async (connection) =>
    fetchJson("/api/venues/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        connection?.sessionToken ? { venueId: "bybit", sessionToken: connection.sessionToken } : {}
      ),
    }),
};
