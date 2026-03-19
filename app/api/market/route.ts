import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const res = await fetch("https://api.coinpaprika.com/v1/global", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) throw new Error(`Coinpaprika ${res.status}`);

    const data = await res.json() as {
      market_cap_usd: number;
      volume_24h_usd: number;
      bitcoin_dominance_percentage: number;
      ethereum_dominance_percentage: number;
      market_cap_change_24h: number;
      volume_24h_change_24h: number;
      last_updated: number;
    };

    return NextResponse.json({
      marketCapUsd: data.market_cap_usd,
      volume24hUsd: data.volume_24h_usd,
      btcDominance: data.bitcoin_dominance_percentage,
      ethDominance: data.ethereum_dominance_percentage,
      marketCapChange24h: data.market_cap_change_24h,
      volume24hChange24h: data.volume_24h_change_24h,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Market API error:", err);
    return NextResponse.json({
      marketCapUsd: null,
      volume24hUsd: null,
      btcDominance: null,
      ethDominance: null,
      marketCapChange24h: null,
      volume24hChange24h: null,
      updatedAt: new Date().toISOString(),
    });
  }
}
