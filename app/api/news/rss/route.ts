import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/news-service";

export async function GET() {
  const news = await getNewsItems({ limit: 60 });
  return NextResponse.json(news);
}
