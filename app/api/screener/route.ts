import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";

const BASE = "https://data-api.binance.vision";

interface BinanceTicker {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  count: string;
}

export interface ScreenerCoin {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  trades24h: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "volume";

  try {
    const data = await withCache(`screener:${sort}`, 45_000, async () => {
      const res = await fetch(`${BASE}/api/v3/ticker/24hr`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Binance ${res.status}`);

      const raw: BinanceTicker[] = await res.json();

      const coins: ScreenerCoin[] = raw
        .filter(
          (t) =>
            t.symbol.endsWith("USDT") &&
            !/UP|DOWN|BEAR|BULL/.test(t.symbol)
        )
        .map((t) => ({
          symbol: t.symbol.replace("USDT", ""),
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          volume24h: parseFloat(t.quoteVolume),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          trades24h: parseInt(t.count, 10) || 0,
        }))
        .filter((t) => t.volume24h > 500_000 && t.price > 0);

      const sorted = [...coins].sort((a, b) => {
        if (sort === "gainers") return b.change24h - a.change24h;
        if (sort === "losers") return a.change24h - b.change24h;
        return b.volume24h - a.volume24h;
      });

      return sorted.slice(0, 100);
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Screener error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
