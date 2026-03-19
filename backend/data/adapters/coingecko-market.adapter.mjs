import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS, providerSymbol } from "../core/symbol-map.mjs";
import { normalizeMarketTick } from "../core/normalize.mjs";

export async function fetchCoingeckoMarketData({ symbols = CORE_SYMBOLS } = {}) {
  const symbolIds = symbols
    .map((symbol) => ({ symbol, id: providerSymbol("coingecko", symbol) }))
    .filter((item) => Boolean(item.id));

  if (symbolIds.length === 0) {
    return { ticks: [], marketStats: null };
  }

  const idsParam = symbolIds.map((item) => item.id).join(",");
  const [marketsPayload, globalPayload] = await Promise.all([
    fetchJson(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsParam)}&price_change_percentage=24h`,
      { timeoutMs: 6000 },
    ),
    fetchJson("https://api.coingecko.com/api/v3/global", { timeoutMs: 5000 }),
  ]);

  const idToSymbol = new Map(symbolIds.map((item) => [item.id, item.symbol]));
  const ticks = (Array.isArray(marketsPayload) ? marketsPayload : [])
    .map((item) =>
      normalizeMarketTick({
        symbol: idToSymbol.get(item.id) || item.symbol,
        priceUsd: item.current_price,
        change24hPct: item.price_change_percentage_24h_in_currency ?? item.price_change_percentage_24h,
        change24hUsd: item.price_change_24h,
        provider: "coingecko",
        timestamp: new Date().toISOString(),
      }),
    )
    .filter(Boolean);

  const data = globalPayload?.data;
  const marketStats = data
    ? {
        marketCapUsd: data.total_market_cap?.usd ?? null,
        btcDominance: data.market_cap_percentage?.btc ?? null,
        ethDominance: data.market_cap_percentage?.eth ?? null,
        marketCapChange24h: data.market_cap_change_percentage_24h_usd ?? null,
        total24hVolume: data.total_volume?.usd ?? null,
        defiMarketCap: data.defi_market_cap ?? null,
        activeCryptos: data.active_cryptocurrencies ?? null,
      }
    : null;

  return { ticks, marketStats };
}

