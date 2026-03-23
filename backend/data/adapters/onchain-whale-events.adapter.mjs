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

export function createBinanceLargeTradeStream({
  logger,
  onEvent,
  symbols = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "dogeusdt"],
  minUsd = 250_000,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const safeSymbols = (Array.isArray(symbols) ? symbols : [])
    .map((s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 12);
  if (safeSymbols.length === 0) return () => {};
  const streamPath = safeSymbols.map((s) => `${s}@aggTrade`).join("/");
  const WS_URL = `wss://fstream.binance.com/stream?streams=${streamPath}`;

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(WS_URL);

    socket.on("open", () => logger?.info?.("data.adapter.whale_tape.connected", { streams: safeSymbols.length }));
    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const trade = payload?.data || payload;
        const symbol = String(trade?.s || "").toUpperCase();
        const price = Number(trade?.p || 0);
        const qty = Number(trade?.q || 0);
        const usdValue = price * qty;
        if (!symbol || !Number.isFinite(usdValue) || usdValue < Number(minUsd || 0)) return;
        const token = symbol.replace(/USDT$|USDC$/i, "");
        onEvent?.({
          id: `binance-ws-trade-${symbol}-${trade?.a ?? trade?.T ?? Date.now()}`,
          chain: "binance_futures",
          txHash: null,
          token,
          amount: qty,
          usdValue,
          fromLabel: trade?.m ? "Aggressive Seller" : "Aggressive Buyer",
          fromOwnerType: "smart_money",
          toLabel: "Perp Tape",
          toOwnerType: "derivatives",
          eventType: "smart_money_watch",
          timestamp: new Date(Number(trade?.T || Date.now())).toISOString(),
          relatedAssets: [token],
          provider: "binance_ws_large_trades",
          rawText: `${symbol} large aggTrade @ ${price}`,
          price,
        });
      } catch (error) {
        logger?.warn?.("data.adapter.whale_tape.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.whale_tape.error", { error: String(error) });
      socket?.close();
    });
    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.whale_tape.disconnected");
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

export function createBybitLargeTradeStream({
  logger,
  onEvent,
  symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"],
  minUsd = 250_000,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const topics = (Array.isArray(symbols) ? symbols : [])
    .map((s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((symbol) => `publicTrade.${symbol}`);
  if (topics.length === 0) return () => {};

  const connect = () => {
    if (closed) return;
    socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

    socket.on("open", () => {
      logger?.info?.("data.adapter.bybit_whale_tape.connected", { topics: topics.length });
      socket?.send(JSON.stringify({ op: "subscribe", args: topics }));
    });
    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        for (const row of rows) {
          const symbol = String(row?.s || row?.symbol || "").toUpperCase();
          const token = symbol.replace(/USDT$|USDC$/i, "");
          const price = Number(row?.p || row?.price || 0);
          const qty = Number(row?.v || row?.q || row?.size || 0);
          const sideRaw = String(row?.S || row?.side || "").toLowerCase();
          const usdValue = price * qty;
          if (!symbol || !Number.isFinite(usdValue) || usdValue < Number(minUsd || 0)) continue;
          onEvent?.({
            id: `bybit-trade-${symbol}-${row?.i || row?.T || Date.now()}`,
            chain: "bybit_futures",
            txHash: null,
            token,
            amount: qty,
            usdValue,
            fromLabel: sideRaw === "sell" ? "Aggressive Seller" : "Aggressive Buyer",
            fromOwnerType: "smart_money",
            toLabel: "Perp Tape",
            toOwnerType: "derivatives",
            eventType: "smart_money_watch",
            timestamp: new Date(Number(row?.T || Date.now())).toISOString(),
            relatedAssets: [token],
            provider: "bybit_ws_large_trades",
            rawText: `${symbol} large trade @ ${price}`,
            price,
          });
        }
      } catch (error) {
        logger?.warn?.("data.adapter.bybit_whale_tape.parse_error", { error: String(error) });
      }
    });
    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.bybit_whale_tape.error", { error: String(error) });
      socket?.close();
    });
    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.bybit_whale_tape.disconnected");
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

export function createOkxLargeTradeStream({
  logger,
  onEvent,
  symbols = ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP", "BNB-USDT-SWAP", "XRP-USDT-SWAP"],
  minUsd = 250_000,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const args = (Array.isArray(symbols) ? symbols : [])
    .map((instId) => String(instId || "").toUpperCase().replace(/[^A-Z0-9-]/g, ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((instId) => ({ channel: "trades", instId }));
  if (args.length === 0) return () => {};

  const connect = () => {
    if (closed) return;
    socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

    socket.on("open", () => {
      logger?.info?.("data.adapter.okx_whale_tape.connected", { args: args.length });
      socket?.send(JSON.stringify({ op: "subscribe", args }));
    });
    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        for (const row of rows) {
          const instId = String(row?.instId || "");
          const token = instId.split("-")[0] || "";
          const price = Number(row?.px || row?.price || 0);
          const qty = Number(row?.sz || row?.size || 0);
          const sideRaw = String(row?.side || "").toLowerCase();
          const usdValue = price * qty;
          if (!token || !Number.isFinite(usdValue) || usdValue < Number(minUsd || 0)) continue;
          onEvent?.({
            id: `okx-trade-${instId}-${row?.tradeId || row?.ts || Date.now()}`,
            chain: "okx_futures",
            txHash: null,
            token,
            amount: qty,
            usdValue,
            fromLabel: sideRaw === "sell" ? "Aggressive Seller" : "Aggressive Buyer",
            fromOwnerType: "smart_money",
            toLabel: "Perp Tape",
            toOwnerType: "derivatives",
            eventType: "smart_money_watch",
            timestamp: new Date(Number(row?.ts || Date.now())).toISOString(),
            relatedAssets: [token],
            provider: "okx_ws_large_trades",
            rawText: `${instId} large trade @ ${price}`,
            price,
          });
        }
      } catch (error) {
        logger?.warn?.("data.adapter.okx_whale_tape.parse_error", { error: String(error) });
      }
    });
    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.okx_whale_tape.error", { error: String(error) });
      socket?.close();
    });
    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.okx_whale_tape.disconnected");
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

export function createBybitLiquidationEventStream({
  logger,
  onEvent,
  symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"],
  minUsd = 10_000,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const topics = (Array.isArray(symbols) ? symbols : [])
    .map((s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((symbol) => `allLiquidation.${symbol}`);
  if (topics.length === 0) return () => {};

  const connect = () => {
    if (closed) return;
    socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

    socket.on("open", () => {
      logger?.info?.("data.adapter.bybit_liquidations.connected", { topics: topics.length });
      socket?.send(JSON.stringify({ op: "subscribe", args: topics }));
    });

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        for (const row of rows) {
          const symbol = String(row?.symbol || "").toUpperCase();
          const token = symbol.replace(/USDT$|USDC$/i, "");
          const sideRaw = String(row?.side || "").toLowerCase();
          const side = sideRaw === "buy" ? "bullish" : "bearish";
          const qty = Number(row?.size || row?.qty || 0);
          const price = Number(row?.price || row?.execPrice || 0);
          const usdValue = qty * price;
          if (!symbol || !Number.isFinite(usdValue) || usdValue < Number(minUsd || 0)) continue;
          onEvent?.({
            id: `bybit-liq-${symbol}-${row?.updatedTime || row?.T || Date.now()}`,
            token,
            amount: qty,
            usdValue,
            fromLabel: "Bybit Perp Position",
            fromOwnerType: "derivatives",
            toLabel: "Liquidated",
            toOwnerType: "derivatives",
            txHash: null,
            chain: "bybit_futures",
            eventType: "liquidation",
            sentiment: side,
            timestamp: new Date(Number(row?.updatedTime || row?.time || Date.now())).toISOString(),
            provider: "bybit_liquidations",
            rawText: `${symbol} liquidation @ ${price}`,
            price,
          });
        }
      } catch (error) {
        logger?.warn?.("data.adapter.bybit_liquidations.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.bybit_liquidations.error", { error: String(error) });
      socket?.close();
    });
    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.bybit_liquidations.disconnected");
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

export function createOkxLiquidationEventStream({
  logger,
  onEvent,
  minUsd = 10_000,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;

  const connect = () => {
    if (closed) return;
    socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

    socket.on("open", () => {
      logger?.info?.("data.adapter.okx_liquidations.connected");
      socket?.send(
        JSON.stringify({
          op: "subscribe",
          args: [{ channel: "liquidation-orders", instType: "SWAP" }],
        }),
      );
    });

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        for (const row of rows) {
          const instId = String(row?.instId || row?.instFamily || "");
          const symbol = instId.split("-")[0] || "";
          if (!symbol) continue;
          const sideRaw = String(row?.side || "").toLowerCase();
          const side = sideRaw === "buy" ? "bullish" : "bearish";
          const qty = Number(row?.sz || row?.size || 0);
          const price = Number(row?.bkPx || row?.px || row?.price || 0);
          const usdValue = qty * price;
          if (!Number.isFinite(usdValue) || usdValue < Number(minUsd || 0)) continue;
          onEvent?.({
            id: `okx-liq-${instId}-${row?.ts || Date.now()}`,
            token: symbol,
            amount: qty,
            usdValue,
            fromLabel: "OKX Perp Position",
            fromOwnerType: "derivatives",
            toLabel: "Liquidated",
            toOwnerType: "derivatives",
            txHash: null,
            chain: "okx_futures",
            eventType: "liquidation",
            sentiment: side,
            timestamp: new Date(Number(row?.ts || Date.now())).toISOString(),
            provider: "okx_liquidations",
            rawText: `${instId} liquidation @ ${price}`,
            price,
          });
        }
      } catch (error) {
        logger?.warn?.("data.adapter.okx_liquidations.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.okx_liquidations.error", { error: String(error) });
      socket?.close();
    });
    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.okx_liquidations.disconnected");
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
