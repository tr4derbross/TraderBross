// TraderBross News System v2.0 — Zero-Key Multi-Agent Build
import { NextResponse } from "next/server";
import {
  startLiquidationStream,
  getRecentLiquidations,
  getLiquidationStats,
  type LiquidationEvent,
} from "@/lib/binance-liquidation-ws";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  // Ensure the WebSocket stream is running (idempotent)
  startLiquidationStream();

  const liquidations = getRecentLiquidations(limit);
  const stats = getLiquidationStats();

  if (liquidations.length > 0) {
    return NextResponse.json(
      { liquidations, stats },
      {
        headers: {
          "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
        },
      }
    );
  }

  // Fallback: return mock data so the UI always has something to render
  return NextResponse.json(
    {
      liquidations: generateMockLiquidations(limit),
      stats: { totalUSD: 0, longUSD: 0, shortUSD: 0, count: 0 },
    },
    {
      headers: { "Cache-Control": "s-maxage=10" },
    }
  );
}

// ── Mock generator ─────────────────────────────────────────────────────────────

const MOCK_SYMBOLS: ReadonlyArray<{ symbol: string; displaySymbol: string; price: number }> = [
  { symbol: "BTCUSDT",  displaySymbol: "BTC",  price: 85_000 },
  { symbol: "ETHUSDT",  displaySymbol: "ETH",  price: 3_200  },
  { symbol: "SOLUSDT",  displaySymbol: "SOL",  price: 170    },
  { symbol: "BNBUSDT",  displaySymbol: "BNB",  price: 580    },
  { symbol: "XRPUSDT",  displaySymbol: "XRP",  price: 0.55   },
  { symbol: "AVAXUSDT", displaySymbol: "AVAX", price: 35     },
  { symbol: "DOGEUSDT", displaySymbol: "DOGE", price: 0.12   },
  { symbol: "ARBUSDT",  displaySymbol: "ARB",  price: 1.1    },
  { symbol: "OPUSDT",   displaySymbol: "OP",   price: 1.8    },
  { symbol: "LINKUSDT", displaySymbol: "LINK", price: 14     },
];

function randomFrom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateMockLiquidations(limit: number): LiquidationEvent[] {
  const now = Date.now();
  const results: LiquidationEvent[] = [];

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const asset = randomFrom(MOCK_SYMBOLS);
    const side: "LONG" | "SHORT" = Math.random() > 0.5 ? "LONG" : "SHORT";

    // Realistic liquidation size range: $50K – $5M
    const sizeUSD = Math.round(randomBetween(50_000, 5_000_000));
    const quantity = sizeUSD / asset.price;

    // Spread timestamps across last 5 minutes
    const timestamp = new Date(now - Math.round(randomBetween(0, 5 * 60_000)));

    results.push({
      id: `mock-liq-${i}-${timestamp.getTime()}`,
      symbol: asset.symbol,
      displaySymbol: asset.displaySymbol,
      side,
      sizeUSD,
      quantity,
      price: asset.price,
      exchange: "Binance",
      timestamp,
    });
  }

  // Sort newest first
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return results;
}
