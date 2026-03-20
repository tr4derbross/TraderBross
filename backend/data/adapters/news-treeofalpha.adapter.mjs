import { fetchJson } from "../../services/http.mjs";
import WebSocket from "ws";
import { canonicalSymbol } from "../core/symbol-map.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanSymbol(raw) {
  const token = String(raw || "").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  if (!token) return null;
  const base = token.includes("_") ? token.split("_")[0] : token.replace(/USDT$|USD$|BTC$|ETH$|BNB$/, "");
  return canonicalSymbol(base);
}

function extractTickers(row) {
  const fromSymbols = (Array.isArray(row.symbols) ? row.symbols : [])
    .map((item) => cleanSymbol(item));
  const fromSuggestions = (Array.isArray(row.suggestions) ? row.suggestions : [])
    .flatMap((entry) => {
      const coin = canonicalSymbol(entry?.coin);
      const nested = Array.isArray(entry?.symbols)
        ? entry.symbols.map((item) => cleanSymbol(item?.symbol))
        : [];
      return [coin, ...nested];
    });
  return unique([...fromSymbols, ...fromSuggestions]).slice(0, 8);
}

function inferSourceType(row) {
  const source = String(row.source || "").toLowerCase();
  if (source.includes("twitter") || source.includes("telegram") || source.includes("social")) return "social";
  return "news";
}

export function normalizeTreeOfAlphaRow(row, index = 0) {
  return normalizeNewsEvent({
    id: String(row?._id || `toa-${index}-${row?.time || Date.now()}`),
    title: row?.title || row?.en || row?.body || "",
    summary: String(row?.body || row?.text || row?.title || "").slice(0, 420),
    source: row?.sourceName || row?.source || "Tree News",
    sourceType: inferSourceType(row),
    sentiment: "neutral",
    importance: "watch",
    tickers: extractTickers(row || {}),
    url: row?.url || "#",
    timestamp: row?.time ? new Date(Number(row.time)).toISOString() : new Date().toISOString(),
    provider: "treeofalpha",
  });
}

export async function fetchTreeOfAlphaNews({ limit = 300 } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || 300, 20), 3000);
  const payload = await fetchJson(`https://news.treeofalpha.com/api/news?limit=${cappedLimit}`, { timeoutMs: 9000 });
  const rows = Array.isArray(payload) ? payload : [];
  return rows.slice(0, cappedLimit).map((row, index) => normalizeTreeOfAlphaRow(row, index));
}

export function createTreeOfAlphaNewsStream({ apiKey = "", logger, onEvent }) {
  if (!apiKey) return () => {};
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  const WS_URL = "wss://news.treeofalpha.com/ws";

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(WS_URL);

    socket.on("open", () => {
      logger?.info?.("data.adapter.tree_ws.connected");
      try {
        socket.send(JSON.stringify({ action: "login", api_key: apiKey }));
      } catch {
        // no-op
      }
    });

    socket.on("message", (raw) => {
      try {
        const text = raw.toString();
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        rows.forEach((row, index) => {
          if (!row || typeof row !== "object") return;
          if (!row.title && !row.body && !row.en) return;
          const normalized = normalizeTreeOfAlphaRow(row, index);
          if (!normalized?.id) return;
          onEvent(normalized);
        });
      } catch (error) {
        logger?.warn?.("data.adapter.tree_ws.parse_error", { error: String(error) });
      }
    });

    socket.on("error", (error) => {
      logger?.warn?.("data.adapter.tree_ws.error", { error: String(error) });
      try {
        socket?.close();
      } catch {
        // no-op
      }
    });

    socket.on("close", () => {
      socket = null;
      if (closed) return;
      logger?.warn?.("data.adapter.tree_ws.disconnected");
      reconnectTimer = setTimeout(connect, 4000);
    });
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) socket.terminate();
  };
}
