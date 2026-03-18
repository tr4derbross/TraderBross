// TraderBross News System v2.0 — Zero-Key
// Aggregates live news from cryptocurrency.cv + RSS + social feeds.
// Falls back to MOCK_NEWS if all sources fail.

import { NextResponse } from "next/server";
import { aggregateNews } from "@/lib/news-aggregator";
import { MOCK_NEWS } from "@/lib/mock-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") ?? "all") as "all" | "news" | "social";
  const coin = searchParams.get("coin") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 60);

  try {
    const news = await aggregateNews({ tab, coin, limit });
    return NextResponse.json(news, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    // All sources failed — serve mock data so the UI is never empty
    return NextResponse.json(MOCK_NEWS, {
      headers: {
        "Cache-Control": "s-maxage=60",
      },
    });
  }
}
