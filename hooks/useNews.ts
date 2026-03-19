"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_NEWS, NewsItem } from "@/lib/mock-data";
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

// Map /api/news response (types/news.ts shape) → NewsItem (mock-data.ts shape)
function mapApiNewsItem(raw: Record<string, unknown>): NewsItem {
  const tickers = Array.isArray(raw.tickers) ? (raw.tickers as string[]) : [];
  const impact = (raw.impact as string) ?? "low";
  const importance =
    (raw.isBreaking as boolean) ? "breaking"
    : impact === "high" ? "market-moving"
    : impact === "medium" ? "watch"
    : "noise";

  return {
    id: String(raw.id ?? Math.random()),
    headline: String(raw.title ?? raw.headline ?? ""),
    summary: String(raw.summary ?? ""),
    source: String(raw.sourceLabel ?? raw.source ?? ""),
    ticker: tickers,
    sector: tickers[0] ?? "Crypto",
    timestamp: new Date(raw.timestamp as string),
    url: String(raw.url ?? "#"),
    sentiment: (raw.sentiment as NewsItem["sentiment"]) ?? "neutral",
    importance,
    type: (raw.category as NewsItem["type"]) ?? "news",
    author: raw.author as string | undefined,
    authorHandle: raw.authorHandle as string | undefined,
  };
}

// Map /api/whales response (WhaleMessage shape) → NewsItem
function mapApiWhaleItem(raw: Record<string, unknown>): NewsItem {
  const amountUSD = Number(raw.amountUSD ?? 0);
  const asset = String(raw.asset ?? "BTC");
  const from = String(raw.from ?? "Unknown");
  const to = String(raw.to ?? "Unknown");
  const type = String(raw.type ?? "transfer");

  const emoji =
    type === "liquidation" ? "💥"
    : type === "exchange_inflow" ? "🔴"
    : type === "exchange_outflow" ? "🟢"
    : "🐋";

  const usdLabel =
    amountUSD >= 1e9 ? `$${(amountUSD / 1e9).toFixed(1)}B`
    : amountUSD >= 1e6 ? `$${(amountUSD / 1e6).toFixed(1)}M`
    : amountUSD >= 1e3 ? `$${(amountUSD / 1e3).toFixed(0)}K`
    : `$${amountUSD.toFixed(0)}`;

  const headline =
    type === "liquidation"
      ? `${emoji} ${usdLabel} ${asset} ${raw.side ?? ""} LIQUIDATED`
      : `${emoji} ${usdLabel} ${asset} moved from ${from} to ${to}`;

  return {
    id: String(raw.id ?? Math.random()),
    headline,
    summary: String(raw.rawText ?? ""),
    source: String(raw.channel ?? "Whale Alert"),
    ticker: [asset],
    sector: asset,
    timestamp: new Date(raw.timestamp as string),
    url: String(raw.channelUrl ?? "#"),
    sentiment: type === "exchange_inflow" ? "bearish" : type === "exchange_outflow" ? "bullish" : "neutral",
    importance: amountUSD >= 50_000_000 ? "market-moving" : "watch",
    type: "whale",
    whaleAmountUsd: amountUSD,
    whaleToken: asset,
    whaleFrom: from,
    whaleTo: to,
  };
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

export function useNews({
  sector,
  ticker,
  keyword,
  sourceFilter = "all",
  importanceFilter = "all",
  sentimentFilter = "all",
}: UseNewsOptions) {
  // WebSocket state (Railway backend)
  const wsNewsItems   = useRealtimeSelector((state) => state.news);
  const wsWhaleItems  = useRealtimeSelector((state) => state.whales);
  const wsSocialItems = useRealtimeSelector((state) => state.social);
  const liquidationCount = useRealtimeSelector((state) => (state.liquidations ?? []).length);
  const connectionStatus = useRealtimeSelector((state) => state.connectionStatus);

  // API state (our new endpoints — used when WS is empty)
  const [apiNewsItems,  setApiNewsItems]  = useState<NewsItem[]>([]);
  const [apiWhaleItems, setApiWhaleItems] = useState<NewsItem[]>([]);
  const [apiLoading,    setApiLoading]    = useState(false);
  const fetchingRef = useRef(false);

  const wsHasNews   = wsNewsItems.length > 0;
  const wsHasWhales = wsWhaleItems.length > 0;

  const fetchFromAPI = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setApiLoading(true);
    try {
      const [newsRes, whalesRes] = await Promise.allSettled([
        fetch("/api/news?tab=all&limit=40"),
        fetch("/api/whales?limit=20"),
      ]);

      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        const data = (await newsRes.value.json()) as Record<string, unknown>[];
        if (Array.isArray(data) && data.length > 0) {
          setApiNewsItems(data.map(mapApiNewsItem));
        }
      }

      if (whalesRes.status === "fulfilled" && whalesRes.value.ok) {
        const data = (await whalesRes.value.json()) as Record<string, unknown>[];
        if (Array.isArray(data) && data.length > 0) {
          setApiWhaleItems(data.map(mapApiWhaleItem));
        }
      }
    } catch {
      // silent fail — use existing state
    } finally {
      setApiLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Always fetch on mount and poll every 60s
  useEffect(() => {
    void fetchFromAPI();
    const interval = setInterval(() => void fetchFromAPI(), 60_000);
    return () => clearInterval(interval);
  }, [fetchFromAPI]);

  // Merge: prefer WS data when available, otherwise use API data
  const newsItems   = wsHasNews   ? wsNewsItems   : apiNewsItems.filter(i => i.type !== "whale" && i.type !== "social");
  const whaleItems  = wsHasWhales ? wsWhaleItems  : apiWhaleItems;
  const socialItems = wsSocialItems.length > 0 ? wsSocialItems : apiNewsItems.filter(i => i.type === "social");

  const loading = !wsHasNews && apiLoading && apiNewsItems.length === 0;
  const previousHeadlines = useRef<Set<string>>(new Set());

  const allItems = useMemo(
    () => [...newsItems, ...whaleItems, ...socialItems],
    [newsItems, whaleItems, socialItems],
  );

  const filtered = useMemo(() => {
    let items: NewsItem[];
    switch (sourceFilter) {
      case "news":    items = newsItems;   break;
      case "whale":   items = whaleItems;  break;
      case "social":  items = socialItems; break;
      default:
        items = [...allItems].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() ||
            a.id.localeCompare(b.id),
        );
    }

    if (keyword)  items = items.filter((item) => matchesKeyword(item, keyword));
    if (ticker)   items = items.filter((item) => item.ticker.includes(ticker.toUpperCase()));
    if (sector && sector !== "All") items = items.filter((item) => item.sector.includes(sector));
    if (importanceFilter !== "all") items = items.filter((item) => item.importance === importanceFilter);
    if (sentimentFilter  !== "all") items = items.filter((item) => item.sentiment  === sentimentFilter);

    return items.length > 0 ? items : sourceFilter === "news" ? MOCK_NEWS : items;
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
    isLive:
      newsItems.some((item) => item.url && item.url !== "#" && !item.id.startsWith("mock-")) ||
      apiNewsItems.length > 0,
    refreshNews: () => { void fetchFromAPI(); refreshRealtimeSnapshot(); },
    counts: {
      news:        newsItems.length,
      whale:       whaleItems.length,
      social:      socialItems.length,
      liquidation: liquidationCount,
      all:         allItems.length,
    },
  };
}
