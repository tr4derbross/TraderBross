import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS, providerSymbol } from "../core/symbol-map.mjs";

export async function fetchCoinpaprikaCoinMetadata({ symbols = CORE_SYMBOLS } = {}) {
  const mapped = symbols
    .map((symbol) => ({ symbol, id: providerSymbol("coinpaprika", symbol) }))
    .filter((item) => Boolean(item.id));
  if (mapped.length === 0) return {};

  const rows = await Promise.all(
    mapped.map(async ({ symbol, id }) => {
      try {
        const payload = await fetchJson(`https://api.coinpaprika.com/v1/coins/${encodeURIComponent(id)}`, {
          timeoutMs: 5000,
        });
        return {
          symbol,
          value: {
            symbol,
            id: payload?.id || id,
            name: payload?.name || symbol,
            image: "",
            marketCapRank: payload?.rank ?? null,
            circulatingSupply: null,
            totalSupply: null,
            maxSupply: null,
            lastUpdated: new Date().toISOString(),
            provider: "coinpaprika",
          },
        };
      } catch {
        return null;
      }
    }),
  );

  const out = {};
  rows.filter(Boolean).forEach((row) => {
    out[row.symbol] = row.value;
  });
  return out;
}

