import { MemoryCache } from "./cache.mjs";

const cache = new MemoryCache();

const MOCK_TRENDING = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", rank: 1, thumb: "", priceChangePercent24h: 2.4, priceBtc: 1 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", rank: 2, thumb: "", priceChangePercent24h: -1.1, priceBtc: 0.054 },
  { id: "solana", symbol: "SOL", name: "Solana", rank: 5, thumb: "", priceChangePercent24h: 5.7, priceBtc: 0.0023 },
  { id: "pepe", symbol: "PEPE", name: "Pepe", rank: 42, thumb: "", priceChangePercent24h: 12.3, priceBtc: 0.0000001 },
  { id: "injective-protocol", symbol: "INJ", name: "Injective", rank: 31, thumb: "", priceChangePercent24h: -3.2, priceBtc: 0.00021 },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", rank: 22, thumb: "", priceChangePercent24h: 4.1, priceBtc: 0.00008 },
  { id: "sui", symbol: "SUI", name: "Sui", rank: 19, thumb: "", priceChangePercent24h: 8.9, priceBtc: 0.00012 },
];

const MOCK_GLOBAL = {
  totalMarketCapUsd: 2_350_000_000_000,
  totalVolume24hUsd: 98_500_000_000,
  btcDominance: 54.2,
  ethDominance: 17.1,
  activeCurrencies: 13420,
  marketCapChangePercent24h: 1.8,
  updatedAt: new Date().toISOString(),
};

async function fetchGlobal() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko global ${res.status}`);

    const json = await res.json();
    const data = json?.data;
    return {
      totalMarketCapUsd: data?.total_market_cap?.usd ?? 0,
      totalVolume24hUsd: data?.total_volume?.usd ?? 0,
      btcDominance: data?.market_cap_percentage?.btc ?? 0,
      ethDominance: data?.market_cap_percentage?.eth ?? 0,
      activeCurrencies: data?.active_cryptocurrencies ?? 0,
      marketCapChangePercent24h: data?.market_cap_change_percentage_24h_usd ?? 0,
      updatedAt: data?.updated_at ? new Date(data.updated_at * 1000).toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchTrending() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko trending ${res.status}`);

    const json = await res.json();
    const coins = Array.isArray(json?.coins) ? json.coins : [];
    return coins.slice(0, 7).map(({ item }) => ({
      id: item.id,
      symbol: String(item.symbol || "").toUpperCase(),
      name: item.name,
      rank: item.market_cap_rank,
      thumb: item.thumb,
      priceChangePercent24h: item?.data?.price_change_percentage_24h?.usd ?? null,
      priceBtc: item?.data?.price_btc ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getTrendingData() {
  return cache.remember("trending:v1", 5 * 60 * 1000, async () => {
    const [trending, global] = await Promise.all([fetchTrending(), fetchGlobal()]);
    return {
      trending: trending.length > 0 ? trending : MOCK_TRENDING,
      global: global ?? MOCK_GLOBAL,
    };
  });
}
