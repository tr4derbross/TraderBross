import { NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  thumb: string;
  priceChangePercent24h: number | null;
  priceBtc: number | null;
}

export interface GlobalMarketStats {
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  btcDominance: number;
  ethDominance: number;
  activeCurrencies: number;
  marketCapChangePercent24h: number;
  updatedAt: string;
}

export interface TrendingResponse {
  trending: TrendingCoin[];
  global: GlobalMarketStats | null;
}

const MOCK_TRENDING: TrendingCoin[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", rank: 1, thumb: "", priceChangePercent24h: 2.4, priceBtc: 1 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", rank: 2, thumb: "", priceChangePercent24h: -1.1, priceBtc: 0.054 },
  { id: "solana", symbol: "SOL", name: "Solana", rank: 5, thumb: "", priceChangePercent24h: 5.7, priceBtc: 0.0023 },
  { id: "pepe", symbol: "PEPE", name: "Pepe", rank: 42, thumb: "", priceChangePercent24h: 12.3, priceBtc: 0.0000001 },
  { id: "injective-protocol", symbol: "INJ", name: "Injective", rank: 31, thumb: "", priceChangePercent24h: -3.2, priceBtc: 0.00021 },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", rank: 22, thumb: "", priceChangePercent24h: 4.1, priceBtc: 0.00008 },
  { id: "sui", symbol: "SUI", name: "Sui", rank: 19, thumb: "", priceChangePercent24h: 8.9, priceBtc: 0.00012 },
];

const MOCK_GLOBAL: GlobalMarketStats = {
  totalMarketCapUsd: 2_350_000_000_000,
  totalVolume24hUsd: 98_500_000_000,
  btcDominance: 54.2,
  ethDominance: 17.1,
  activeCurrencies: 13420,
  marketCapChangePercent24h: 1.8,
  updatedAt: new Date().toISOString(),
};

async function fetchGlobal(): Promise<GlobalMarketStats | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", {
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko global ${res.status}`);

    const json = await res.json() as {
      data: {
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        market_cap_percentage: Record<string, number>;
        active_cryptocurrencies: number;
        market_cap_change_percentage_24h_usd: number;
        updated_at: number;
      };
    };

    const d = json.data;
    return {
      totalMarketCapUsd: d.total_market_cap.usd ?? 0,
      totalVolume24hUsd: d.total_volume.usd ?? 0,
      btcDominance: d.market_cap_percentage.btc ?? 0,
      ethDominance: d.market_cap_percentage.eth ?? 0,
      activeCurrencies: d.active_cryptocurrencies,
      marketCapChangePercent24h: d.market_cap_change_percentage_24h_usd,
      updatedAt: new Date(d.updated_at * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchTrending(): Promise<TrendingCoin[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko trending ${res.status}`);

    const json = await res.json() as {
      coins: Array<{
        item: {
          id: string;
          symbol: string;
          name: string;
          market_cap_rank: number;
          thumb: string;
          data?: { price_change_percentage_24h?: { usd?: number }; price_btc?: number };
        };
      }>;
    };

    return json.coins.slice(0, 7).map(({ item }) => ({
      id: item.id,
      symbol: item.symbol.toUpperCase(),
      name: item.name,
      rank: item.market_cap_rank,
      thumb: item.thumb,
      priceChangePercent24h: item.data?.price_change_percentage_24h?.usd ?? null,
      priceBtc: item.data?.price_btc ?? null,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const result = await withCache("coingecko:trending:v2", 300_000, async () => {
    const [trending, global] = await Promise.all([fetchTrending(), fetchGlobal()]);

    return {
      trending: trending.length > 0 ? trending : MOCK_TRENDING,
      global: global ?? MOCK_GLOBAL,
    } satisfies TrendingResponse;
  });

  return NextResponse.json(result);
}
