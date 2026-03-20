import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS, providerSymbol } from "../core/symbol-map.mjs";
import { normalizeMarketTick } from "../core/normalize.mjs";

export async function fetchCoincapMarketData({ symbols = CORE_SYMBOLS } = {}) {
  const mapped = symbols
    .map((symbol) => ({ symbol, id: providerSymbol("coincap", symbol) }))
    .filter((item) => Boolean(item.id));
  if (mapped.length === 0) return { ticks: [], marketStats: null };

  const idsParam = mapped.map((item) => item.id).join(",");
  const payload = await fetchJson(`https://api.coincap.io/v2/assets?ids=${encodeURIComponent(idsParam)}`, {
    timeoutMs: 7000,
  });

  const idToSymbol = new Map(mapped.map((item) => [item.id, item.symbol]));
  const ticks = (Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => {
      const symbol = idToSymbol.get(item.id);
      if (!symbol) return null;
      const price = Number(item.priceUsd || 0);
      const changePct = Number(item.changePercent24Hr || 0);
      const changeUsd = Number.isFinite(price) && Number.isFinite(changePct) ? (price * changePct) / 100 : 0;
      return normalizeMarketTick({
        symbol,
        priceUsd: price,
        change24hPct: changePct,
        change24hUsd: changeUsd,
        provider: "coincap",
        timestamp: new Date().toISOString(),
      });
    })
    .filter(Boolean);

  return { ticks, marketStats: null };
}

