import { fetchJson } from "../../services/http.mjs";
import { CORE_SYMBOLS } from "../core/symbol-map.mjs";
import { normalizeTokenPair } from "../core/normalize.mjs";

export async function fetchDexScreenerDiscovery({ symbols = CORE_SYMBOLS.slice(0, 12) } = {}) {
  const queries = symbols.slice(0, 10);

  const settled = await Promise.allSettled(
    queries.map((symbol) =>
      fetchJson(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(symbol)}`, { timeoutMs: 6000 }),
    ),
  );

  const rows = [];
  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const pairs = Array.isArray(result.value?.pairs) ? result.value.pairs : [];
    pairs.slice(0, 4).forEach((pair) => {
      const normalized = normalizeTokenPair({
        baseSymbol: pair.baseToken?.symbol,
        quoteSymbol: pair.quoteToken?.symbol,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        chainId: pair.chainId,
        liquidityUsd: pair.liquidity?.usd,
        volume24hUsd: pair.volume?.h24,
        priceUsd: pair.priceUsd,
        url: pair.url,
        provider: "dexscreener",
        timestamp: new Date().toISOString(),
      });
      if (normalized) rows.push(normalized);
    });
  });

  const deduped = new Map();
  rows.forEach((row) => {
    const key = `${row.baseSymbol}:${row.chainId}:${row.dexId}`;
    const existing = deduped.get(key);
    if (!existing || row.liquidityUsd > existing.liquidityUsd) {
      deduped.set(key, row);
    }
  });

  return Array.from(deduped.values())
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
    .slice(0, 80);
}

