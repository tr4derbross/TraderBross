import WebSocket from "ws";
import { canonicalSymbol, CORE_SYMBOLS } from "../core/symbol-map.mjs";
import { normalizeMarketTick } from "../core/normalize.mjs";

const WS_URL = "wss://api.hyperliquid.xyz/ws";

export function createHyperliquidMarketStream({ logger, symbols = CORE_SYMBOLS, onTicks }) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const interested = new Set(symbols.map((symbol) => canonicalSymbol(symbol)).filter(Boolean));

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(WS_URL);

    socket.on("open", () => {
      logger?.info?.("data.adapter.hyperliquid.connected");
      socket?.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "allMids" },
        }),
      );
    });

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        const mids = message?.data?.mids || message?.mids;
        if (!mids || typeof mids !== "object") return;

        const ticks = Object.entries(mids)
          .map(([rawSymbol, price]) => {
            const symbol = canonicalSymbol(rawSymbol);
            if (!symbol || !interested.has(symbol)) return null;
            return normalizeMarketTick({
              symbol,
              priceUsd: Number(price),
              change24hPct: 0,
              change24hUsd: 0,
              provider: "hyperliquid_ws",
              timestamp: new Date().toISOString(),
            });
          })
          .filter(Boolean);

        if (ticks.length > 0) {
          onTicks(ticks);
        }
      } catch (error) {
        logger?.warn?.("data.adapter.hyperliquid.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.hyperliquid.error", { error: String(error) });
      socket?.close();
    });

    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.hyperliquid.disconnected");
      reconnectTimer = setTimeout(connect, 2500);
    });
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) socket.close();
  };
}

