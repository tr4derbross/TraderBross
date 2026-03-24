import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";
import { generateMockCandles } from "./mock-data.mjs";

const cache = new MemoryCache();
const REST_BASE = "https://fapi.asterdex.com";

function toAsterSymbol(symbol) {
  const base = String(symbol || "BTC").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/USDT$/, "");
  return `${base || "BTC"}USDT`;
}

export async function getAsterMarkets() {
  return cache.remember("aster:markets", 30_000, async () => {
    try {
      const payload = await fetchJson(`${REST_BASE}/fapi/v1/ticker/24hr`, { timeoutMs: 6000 });
      const rows = Array.isArray(payload) ? payload : [];
      const filtered = rows
        .filter((row) => String(row?.symbol || "").endsWith("USDT"))
        .slice(0, 60);
      return {
        assets: filtered.map((row) => {
          const symbol = String(row?.symbol || "BTCUSDT");
          const name = symbol.replace(/USDT$/i, "");
          const last = Number(row?.lastPrice || row?.markPrice || row?.closePrice || 0);
          const open = Number(row?.openPrice || 0);
          const change24h = Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : Number(row?.priceChangePercent || 0);
          return {
            name,
            ticker: symbol,
            markPx: last,
            fundingRate: Number(row?.lastFundingRate || 0),
            openInterest: Number(row?.openInterest || 0),
            volume24h: Number(row?.quoteVolume || row?.volume || 0),
            change24h: Number.isFinite(change24h) ? change24h : 0,
            maxLeverage: 20,
          };
        }),
      };
    } catch {
      return {
        assets: [
          { name: "BTC", ticker: "BTCUSDT", markPx: 92000, fundingRate: 0.00008, openInterest: 0, volume24h: 850000000, change24h: 1.8, maxLeverage: 20 },
          { name: "ETH", ticker: "ETHUSDT", markPx: 3200, fundingRate: 0.00006, openInterest: 0, volume24h: 430000000, change24h: 1.2, maxLeverage: 20 },
        ],
      };
    }
  });
}

export async function getAsterAccount(address) {
  if (!address) {
    return { error: "Address is required." };
  }

  return {
    error: "Aster private account endpoint is not enabled yet.",
  };
}

export async function getAsterCandles(symbol, interval, limit) {
  const safeSymbol = toAsterSymbol(symbol);
  const safeInterval = String(interval || "1h");
  const safeLimit = Math.min(Math.max(Number(limit || 120) || 120, 20), 500);

  return cache.remember(`aster:candles:${safeSymbol}:${safeInterval}:${safeLimit}`, 12_000, async () => {
    try {
      const payload = await fetchJson(
        `${REST_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(safeSymbol)}&interval=${encodeURIComponent(
          safeInterval
        )}&limit=${safeLimit}`,
        { timeoutMs: 6000 },
      );
      const rows = Array.isArray(payload) ? payload : [];
      return rows
        .map((row) => ({
          time: Math.floor(Number(row?.[0] || 0) / 1000),
          open: Number(row?.[1] || 0),
          high: Number(row?.[2] || 0),
          low: Number(row?.[3] || 0),
          close: Number(row?.[4] || 0),
          volume: Number(row?.[5] || 0),
        }))
        .filter((row) => Number.isFinite(row.time) && row.time > 0);
    } catch {
      return generateMockCandles(String(symbol || "BTC").toUpperCase(), safeInterval, safeLimit);
    }
  });
}
