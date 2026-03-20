import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";
import { generateMockCandles } from "./mock-data.mjs";

const cache = new MemoryCache();
const INDEXER = "https://indexer.dydx.trade/v4";

const DYDX_INTERVAL_RESOLUTIONS = {
  "1m": ["1MIN", "1MINUTE", "1M"],
  "5m": ["5MINS", "5MIN", "5M"],
  "15m": ["15MINS", "15MIN", "15M"],
  "30m": ["30MINS", "30MIN", "30M"],
  "1h": ["1HOUR", "1H", "60M"],
  "4h": ["4HOURS", "4H", "240M"],
  "1d": ["1DAY", "1D"],
  "1w": ["1WEEK", "1W"],
};

function toDydxMarket(symbol) {
  const base = String(symbol || "BTC").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/USDT$/, "");
  return `${base || "BTC"}-USD`;
}

function parseDydxCandleRows(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.candles)
      ? raw.candles
      : Array.isArray(raw?.data?.candles)
        ? raw.data.candles
        : [];

  return rows
    .map((row) => {
      const startedAt = row.startedAt || row.startTime || row.started_at || row.time || row.t || null;
      const timeMs = startedAt ? Date.parse(startedAt) : Number(row.time || row.t || 0);
      if (!Number.isFinite(timeMs) || timeMs <= 0) return null;
      const open = Number(row.open || row.o || 0);
      const high = Number(row.high || row.h || 0);
      const low = Number(row.low || row.l || 0);
      const close = Number(row.close || row.c || 0);
      const volume = Number(row.baseTokenVolume || row.volume || row.v || 0);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      return {
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

export async function getDydxMarkets() {
  return cache.remember("dydx:markets", 30000, async () => {
    try {
      const payload = await fetchJson(`${INDEXER}/perpetualMarkets`, { timeoutMs: 5000 });
      const markets = Object.values(payload?.markets || {}).slice(0, 30);
      return {
        assets: markets.map((market) => ({
          name: market.ticker?.replace("-USD", "") || market.market,
          ticker: market.ticker || market.market,
          markPx: Number(market.oraclePrice || market.price || 0),
          fundingRate: Number(market.nextFundingRate || 0),
          openInterest: Number(market.openInterest || 0),
          volume24h: Number(market.volume24H || 0),
          change24h: Number(market.priceChange24H || 0),
          maxLeverage: Number(market.initialMarginFraction ? Math.round(1 / Number(market.initialMarginFraction)) : 20),
        })),
      };
    } catch {
      return {
        assets: [
          { name: "BTC", ticker: "BTC-USD", markPx: 92000, fundingRate: 0.00008, openInterest: 200000000, volume24h: 850000000, change24h: 1.8, maxLeverage: 20 },
          { name: "ETH", ticker: "ETH-USD", markPx: 3200, fundingRate: 0.00006, openInterest: 120000000, volume24h: 430000000, change24h: 1.2, maxLeverage: 20 },
        ],
      };
    }
  });
}

export async function getDydxAccount(address) {
  if (!address) {
    return { error: "Address is required." };
  }

  return cache.remember(`dydx:account:${address}`, 12000, async () => {
    try {
      const payload = await fetchJson(`${INDEXER}/addresses/${address}/subaccounts`, { timeoutMs: 5000 });
      const account = payload?.subaccounts?.[0];
      if (!account) {
        return { error: "No dYdX subaccount found for this address." };
      }

      const positions = (account.openPerpetualPositions || []).map((position) => ({
        coin: position.market?.replace("-USD", "") || "UNKNOWN",
        side: Number(position.size || 0) >= 0 ? "long" : "short",
        size: Math.abs(Number(position.size || 0)),
        entryPx: Number(position.entryPrice || 0),
        pnl: Number(position.unrealizedPnl || 0),
        roe: Number(position.returnOnEquity || 0) * 100,
        margin: Number(position.sumOpen || 0),
      }));

      return {
        balance: Number(account.equity || 0),
        freeCollateral: Number(account.freeCollateral || 0),
        positions,
      };
    } catch {
      return { error: "Failed to load dYdX account." };
    }
  });
}

export async function getDydxCandles(symbol, interval, limit) {
  const market = toDydxMarket(symbol);
  const safeInterval = String(interval || "1h").toLowerCase();
  const safeLimit = Math.min(Math.max(Number(limit || 120) || 120, 20), 500);
  const resolutionCandidates = DYDX_INTERVAL_RESOLUTIONS[safeInterval] || DYDX_INTERVAL_RESOLUTIONS["1h"];

  return cache.remember(`dydx:candles:${market}:${safeInterval}:${safeLimit}`, 12_000, async () => {
    for (const resolution of resolutionCandidates) {
      try {
        const payload = await fetchJson(
          `${INDEXER}/candles/perpetualMarkets/${encodeURIComponent(market)}?resolution=${encodeURIComponent(
            resolution,
          )}&limit=${safeLimit}`,
          { timeoutMs: 6000 },
        );
        const rows = parseDydxCandleRows(payload);
        if (rows.length > 0) return rows;
      } catch {
        // try next resolution variant
      }
    }

    return generateMockCandles(String(symbol || "BTC").toUpperCase(), safeInterval, safeLimit);
  });
}
