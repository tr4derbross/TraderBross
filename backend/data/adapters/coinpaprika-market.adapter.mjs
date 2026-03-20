import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS, providerSymbol } from "../core/symbol-map.mjs";
import { normalizeMarketTick } from "../core/normalize.mjs";

export async function fetchCoinpaprikaMarketData({ symbols = CORE_SYMBOLS } = {}) {
  const mapped = symbols
    .map((symbol) => ({ symbol, id: providerSymbol("coinpaprika", symbol) }))
    .filter((item) => Boolean(item.id));
  if (mapped.length === 0) return { ticks: [], marketStats: null };

  const [tickersPayload, globalPayload] = await Promise.all([
    fetchJson("https://api.coinpaprika.com/v1/tickers?quotes=USD", { timeoutMs: 9000 }),
    fetchJson("https://api.coinpaprika.com/v1/global", { timeoutMs: 6000 }),
  ]);

  const idToSymbol = new Map(mapped.map((item) => [item.id, item.symbol]));
  const neededIds = new Set(mapped.map((item) => item.id));
  const ticks = (Array.isArray(tickersPayload) ? tickersPayload : [])
    .filter((item) => neededIds.has(item.id))
    .map((item) => {
      const symbol = idToSymbol.get(item.id);
      if (!symbol) return null;
      const usdQuote = item?.quotes?.USD || {};
      return normalizeMarketTick({
        symbol,
        priceUsd: Number(usdQuote.price || 0),
        change24hPct: Number(usdQuote.percent_change_24h || 0),
        change24hUsd: Number(usdQuote.price || 0) * (Number(usdQuote.percent_change_24h || 0) / 100),
        provider: "coinpaprika",
        timestamp: new Date().toISOString(),
      });
    })
    .filter(Boolean);

  const marketStats = globalPayload
    ? {
        marketCapUsd: globalPayload.market_cap_usd ?? null,
        btcDominance: globalPayload.bitcoin_dominance_percentage ?? null,
        ethDominance: null,
        marketCapChange24h: globalPayload.market_cap_change_24h ?? null,
        total24hVolume: globalPayload.volume_24h_usd ?? null,
        defiMarketCap: null,
        activeCryptos: globalPayload.cryptocurrencies_number ?? null,
      }
    : null;

  return { ticks, marketStats };
}

