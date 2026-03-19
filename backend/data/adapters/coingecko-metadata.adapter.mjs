import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS, providerSymbol } from "../core/symbol-map.mjs";

export async function fetchCoingeckoCoinMetadata({ symbols = CORE_SYMBOLS } = {}) {
  const symbolIds = symbols
    .map((symbol) => ({ symbol, id: providerSymbol("coingecko", symbol) }))
    .filter((item) => Boolean(item.id));

  if (symbolIds.length === 0) return {};

  const idsParam = symbolIds.map((item) => item.id).join(",");
  const payload = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsParam)}&sparkline=false`,
    { timeoutMs: 6000 },
  );

  const idToSymbol = new Map(symbolIds.map((item) => [item.id, item.symbol]));
  const result = {};
  (Array.isArray(payload) ? payload : []).forEach((item) => {
    const symbol = idToSymbol.get(item.id);
    if (!symbol) return;
    result[symbol] = {
      symbol,
      id: item.id,
      name: item.name || symbol,
      image: item.image || "",
      marketCapRank: item.market_cap_rank || null,
      circulatingSupply: item.circulating_supply || null,
      totalSupply: item.total_supply || null,
      maxSupply: item.max_supply || null,
      lastUpdated: item.last_updated || new Date().toISOString(),
      provider: "coingecko",
    };
  });
  return result;
}

