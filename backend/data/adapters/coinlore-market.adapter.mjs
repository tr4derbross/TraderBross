import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS } from "../core/symbol-map.mjs";
import { normalizeMarketTick } from "../core/normalize.mjs";

const COINLORE_SYMBOLS = new Set(CORE_SYMBOLS.map((s) => String(s).toUpperCase()));

export async function fetchCoinloreMarketData({ symbols = CORE_SYMBOLS } = {}) {
  const allow = new Set((Array.isArray(symbols) ? symbols : CORE_SYMBOLS).map((s) => String(s).toUpperCase()));
  const payload = await fetchJson("https://api.coinlore.net/api/tickers/?start=0&limit=100", {
    timeoutMs: 7000,
  });

  const ticks = (Array.isArray(payload?.data) ? payload.data : [])
    .map((row) => {
      const symbol = String(row.symbol || "").toUpperCase();
      if (!COINLORE_SYMBOLS.has(symbol) || !allow.has(symbol)) return null;
      const price = Number(row.price_usd || 0);
      const changePct = Number(row.percent_change_24h || 0);
      return normalizeMarketTick({
        symbol,
        priceUsd: price,
        change24hPct: changePct,
        change24hUsd: Number.isFinite(price) && Number.isFinite(changePct) ? (price * changePct) / 100 : 0,
        provider: "coinlore",
        timestamp: new Date().toISOString(),
      });
    })
    .filter(Boolean);

  return { ticks, marketStats: null };
}

