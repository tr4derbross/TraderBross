"use client";

import { useMemo, useRef } from "react";
import { NewsItem } from "@/lib/mock-data";
import { refreshRealtimeSnapshot, useRealtimeSelector } from "@/lib/realtime-client";

export type SourceFilter = "all" | "news" | "social" | "whale" | "liquidation";
export type ImportanceFilter = "all" | "breaking" | "market-moving" | "watch" | "noise";
export type SentimentFilter = "all" | "bullish" | "bearish" | "neutral";

interface UseNewsOptions {
  sector?: string;
  ticker?: string;
  keyword?: string;
  sourceFilter?: SourceFilter;
  importanceFilter?: ImportanceFilter;
  sentimentFilter?: SentimentFilter;
}

function matchesKeyword(item: NewsItem, keyword: string) {
  const query = keyword.toLowerCase();
  return (
    item.headline.toLowerCase().includes(query) ||
    item.summary.toLowerCase().includes(query) ||
    (item.authorHandle?.toLowerCase().includes(query) ?? false) ||
    (item.author?.toLowerCase().includes(query) ?? false)
  );
}

function sortByLatest(items: NewsItem[]) {
  return [...items].sort((a, b) => {
    const tsDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (tsDiff !== 0) return tsDiff;
    return b.id.localeCompare(a.id);
  });
}

export function useNews({
  sector,
  ticker,
  keyword,
  sourceFilter = "all",
  importanceFilter = "all",
  sentimentFilter = "all",
}: UseNewsOptions) {
  const newsItems = useRealtimeSelector((state) => state.news);
  const whaleItems = useRealtimeSelector((state) => state.whales);
  const socialItems = useRealtimeSelector((state) => state.social);
  const liquidationCount = useRealtimeSelector((state) => state.liquidations?.length ?? 0);
  const connectionStatus = useRealtimeSelector((state) => state.connectionStatus);

  const loading = (connectionStatus === "connecting" || connectionStatus === "reconnecting") && newsItems.length === 0;
  const previousHeadlines = useRef<Set<string>>(new Set());

  // Keep "All" focused on general news/social flow.
  // Whale and liquidation have their own dedicated tabs/feeds.
  const allItems = useMemo(
    () => [...newsItems, ...socialItems],
    [newsItems, socialItems],
  );

  const filtered = useMemo(() => {
    let items: NewsItem[];
    switch (sourceFilter) {
      case "news":
        items = newsItems;
        break;
      case "whale":
        items = whaleItems;
        break;
      case "social":
        items = socialItems;
        break;
      default:
        items = allItems;
    }

    if (keyword) items = items.filter((item) => matchesKeyword(item, keyword));
    if (ticker) items = items.filter((item) => item.ticker.includes(ticker.toUpperCase()));
    if (sector && sector !== "All") items = items.filter((item) => item.sector.includes(sector));
    if (importanceFilter !== "all") items = items.filter((item) => item.importance === importanceFilter);
    if (sentimentFilter !== "all") items = items.filter((item) => item.sentiment === sentimentFilter);

    return sortByLatest(items);
  }, [allItems, importanceFilter, keyword, newsItems, sector, sentimentFilter, socialItems, sourceFilter, ticker, whaleItems]);

  const liveCount = useMemo(() => {
    let nextCount = 0;
    const nextHeadlines = new Set<string>();
    newsItems.forEach((item) => {
      nextHeadlines.add(item.id);
      if (!previousHeadlines.current.has(item.id)) nextCount += 1;
    });
    previousHeadlines.current = nextHeadlines;
    return Math.max(0, nextCount - 1);
  }, [newsItems]);

  return {
    news: filtered,
    loading,
    liveCount,
    isLive: newsItems.some((item) => item.url && item.url !== "#" && !item.id.startsWith("mock-")),
    refreshNews: refreshRealtimeSnapshot,
    counts: {
      news: newsItems.length,
      whale: whaleItems.length,
      social: socialItems.length,
      liquidation: liquidationCount,
      all: allItems.length,
    },
  };
}
