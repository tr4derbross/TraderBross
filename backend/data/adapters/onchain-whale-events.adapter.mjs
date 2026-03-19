import WebSocket from "ws";
import { fetchJson } from "../../services/http.mjs";
import { mapWhaleAlertEvmEvents } from "./onchain-evm.adapter.mjs";
import { mapWhaleAlertSolanaEvents } from "./onchain-solana.adapter.mjs";

export async function fetchOnchainWhaleEvents({ whaleAlertKey = "" } = {}) {
  if (!whaleAlertKey) {
    return [];
  }

  const payload = await fetchJson(
    `https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=5000000`,
    { timeoutMs: 7000 },
  );

  const rows = Array.isArray(payload?.transactions) ? payload.transactions.slice(0, 60) : [];
  return [...mapWhaleAlertEvmEvents(rows), ...mapWhaleAlertSolanaEvents(rows)];
}

export function createLiquidationEventStream({ logger, onEvent }) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const WS_URL = "wss://fstream.binance.com/ws/!forceOrder@arr";

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(WS_URL);

    socket.on("open", () => logger?.info?.("data.adapter.liquidations.connected"));
    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const order = payload?.o;
        if (!order) return;
        const amount = Number(order.q || 0);
        const price = Number(order.ap || order.p || 0);
        const amountUsd = amount * price;
        if (!Number.isFinite(amountUsd) || amountUsd < 10_000) return;

        const side = order.S === "SELL" ? "bearish" : "bullish";
        const normalized = {
          id: `liq-${order.T}-${order.s}`,
          token: String(order.s || "").replace("USDT", ""),
          amount: amount,
          usdValue: amountUsd,
          fromLabel: "Futures Position",
          fromOwnerType: "derivatives",
          toLabel: "Liquidated",
          toOwnerType: "derivatives",
          txHash: null,
          chain: "binance_futures",
          eventType: "liquidation",
          sentiment: side,
          timestamp: new Date(Number(order.T || Date.now())).toISOString(),
          provider: "binance_liquidations",
          rawText: `${order.s} liquidation @ ${price}`,
          price,
        };
        onEvent(normalized);
      } catch (error) {
        logger?.warn?.("data.adapter.liquidations.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.liquidations.error", { error: String(error) });
      socket?.close();
    });

    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.liquidations.disconnected");
      reconnectTimer = setTimeout(connect, 3000);
    });
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) socket.terminate();
  };
}
