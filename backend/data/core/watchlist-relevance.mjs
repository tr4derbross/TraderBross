import { canonicalSymbol } from "./symbol-map.mjs";

const DEFAULT_WATCHLIST = ["BTC", "ETH", "SOL", "BNB", "XRP"];

function clip(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createWatchlistRelevance({ watchlistTickers = DEFAULT_WATCHLIST } = {}) {
  const watchlist = new Set((Array.isArray(watchlistTickers) ? watchlistTickers : DEFAULT_WATCHLIST).map((item) => canonicalSymbol(item)).filter(Boolean));

  function score(assets = [], options = {}) {
    const normalized = Array.from(new Set((Array.isArray(assets) ? assets : []).map((item) => canonicalSymbol(item)).filter(Boolean)));
    const hits = normalized.filter((asset) => watchlist.has(asset));
    const directHit = hits.length > 0;
    const sectorRelated = !directHit && normalized.length > 0;
    const base = directHit ? 70 : sectorRelated ? 35 : 8;
    const priorityBoost = Number(options.priorityScore || 0) >= 70 ? 10 : Number(options.priorityScore || 0) >= 45 ? 5 : 0;
    const scoreValue = clip(base + priorityBoost + hits.length * 8, 0, 100);

    const labels = [];
    if (directHit) labels.push("watchlist_hit", "direct_exposure");
    if (scoreValue >= 75) labels.push("high_priority");
    if (sectorRelated) labels.push("sector_related");
    if (!directHit && !sectorRelated) labels.push("low_relevance");

    return {
      score: scoreValue,
      hits,
      labels,
      priorityLabel: scoreValue >= 75 ? "high priority" : scoreValue >= 45 ? "watchlist hit" : scoreValue >= 20 ? "sector-related" : "low relevance",
    };
  }

  return {
    watchlist,
    score,
  };
}
