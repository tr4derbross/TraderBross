import { NextResponse } from "next/server";
import { MOCK_NEWS } from "@/lib/mock-data";
import { getNewsItems } from "@/lib/news-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sector = searchParams.get("sector");
  const ticker = searchParams.get("ticker");
  const keyword = searchParams.get("keyword");

  const news = await getNewsItems({
    sector,
    ticker,
    keyword,
    limit: 50,
  });

  return NextResponse.json(news.length > 0 ? news : MOCK_NEWS);
}
