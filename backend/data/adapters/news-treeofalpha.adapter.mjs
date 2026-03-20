import { fetchJson } from "../../services/http.mjs";
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

export async function fetchTreeOfAlphaNews({ limit = 300 } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || 300, 20), 3000);
  const payload = await fetchJson(`https://news.treeofalpha.com/api/news?limit=${cappedLimit}`, { timeoutMs: 9000 });
  const rows = Array.isArray(payload) ? payload : [];
  return rows.slice(0, cappedLimit).map((row, index) =>
    normalizeNewsEvent({
      id: String(row._id || `toa-${index}-${row.time || Date.now()}`),
      title: row.title || row.en || row.body || "",
      summary: String(row.body || row.text || row.title || "").slice(0, 420),
      source: row.sourceName || row.source || "Tree News",
      sourceType: inferSourceType(row),
      sentiment: "neutral",
      importance: "watch",
      tickers: extractTickers(row),
      url: row.url || "#",
      timestamp: row.time ? new Date(Number(row.time)).toISOString() : new Date().toISOString(),
      provider: "treeofalpha",
    }),
  );
}

