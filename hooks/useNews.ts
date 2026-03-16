"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MOCK_NEWS, MOCK_SOCIAL, MOCK_WHALES, NewsItem } from "@/lib/mock-data";

export type SourceFilter = "all" | "news" | "social" | "whale";
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

export function useNews({ sector, ticker, keyword, sourceFilter = "all", importanceFilter = "all", sentimentFilter = "all" }: UseNewsOptions) {
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => MOCK_NEWS);
  const [whaleItems, setWhaleItems] = useState<NewsItem[]>(() => MOCK_WHALES);
  const [socialItems, setSocialItems] = useState<NewsItem[]>(() => MOCK_SOCIAL);
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchInitialNews = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sector && sector !== "All") params.set("sector", sector);
    if (ticker) params.set("ticker", ticker);
    if (keyword) params.set("keyword", keyword);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    fetch(`/api/news?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
        const mapped = data.map((n) => ({ ...n, timestamp: new Date(n.timestamp), type: n.type || "news" }));
        setNewsItems(mapped);
        // Heuristic: if data contains non-mock IDs or has > 3 items with real URLs, it's live
        const hasRealData = mapped.some((n) => n.url && n.url !== "#" && !n.id.startsWith("mock-"));
        setIsLive(hasRealData);
        setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [sector, ticker, keyword]);

  useEffect(() => {
    return fetchInitialNews();
  }, [fetchInitialNews, refreshNonce]);

  // Fetch whale alerts (poll every 60s)
  const fetchWhales = useCallback(async () => {
    try {
      const res = await fetch("/api/whale", { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return;
      const data: NewsItem[] = await res.json();
      setWhaleItems(data.map((n) => ({ ...n, timestamp: new Date(n.timestamp), type: "whale" })));
    } catch { /* ignore */ }
  }, []);

  // Fetch social/Twitter feed (poll every 5min)
  const fetchSocial = useCallback(async () => {
    try {
      const res = await fetch("/api/social", { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return;
      const data: NewsItem[] = await res.json();
      setSocialItems(data.map((n) => ({ ...n, timestamp: new Date(n.timestamp), type: "social" })));
    } catch { /* ignore */ }
  }, []);

  const refreshNews = useCallback(() => {
    setLiveCount(0);
    void fetchWhales();
    void fetchSocial();
    setRefreshNonce((n) => n + 1);
  }, [fetchWhales, fetchSocial]);

  useEffect(() => {
    fetchWhales();
    fetchSocial();

    const whaleInterval = setInterval(fetchWhales, 30_000);
    const socialInterval = setInterval(fetchSocial, 120_000);

    return () => {
      clearInterval(whaleInterval);
      clearInterval(socialInterval);
    };
  }, [fetchWhales, fetchSocial]);

  // SSE stream for live news
  useEffect(() => {
    const es = new EventSource("/api/news/stream");
    eventSourceRef.current = es;
    let counter = 0;

    es.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === "news") {
        const item: NewsItem = {
          ...payload.item,
          timestamp: new Date(payload.item.timestamp),
          id: `live-${Date.now()}-${++counter}`,
          type: "news",
        };
        setNewsItems((prev) => {
          const key = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70);
          if (prev.some((n) => n.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70) === key)) return prev;
          return [item, ...prev.slice(0, 49)];
        });
        setLiveCount((c) => c + 1);
      }
    };

    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, []);

  // Merge + filter by source
  const allItems = [...newsItems, ...whaleItems, ...socialItems];

  let filtered: NewsItem[];
  switch (sourceFilter) {
    case "news":
      filtered = newsItems;
      break;
    case "whale":
      filtered = whaleItems;
      break;
    case "social":
      filtered = socialItems;
      break;
    default:
      filtered = [...allItems].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() ||
          a.id.localeCompare(b.id)
      );
  }

  // Apply keyword/ticker/sector filters across all types
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(
      (n) => n.headline.toLowerCase().includes(kw) ||
             n.summary.toLowerCase().includes(kw) ||
             (n.authorHandle?.toLowerCase().includes(kw)) ||
             (n.author?.toLowerCase().includes(kw))
    );
  }
  if (ticker) {
    filtered = filtered.filter((n) => n.ticker.includes(ticker.toUpperCase()));
  }
  if (sector && sector !== "All") {
    filtered = filtered.filter((n) => n.sector.includes(sector));
  }
  if (importanceFilter && importanceFilter !== "all") {
    filtered = filtered.filter((n) => n.importance === importanceFilter);
  }
  if (sentimentFilter && sentimentFilter !== "all") {
    filtered = filtered.filter((n) => n.sentiment === sentimentFilter);
  }

  return {
    news: filtered,
    loading,
    liveCount,
    isLive,
    refreshNews,
    counts: {
      news: newsItems.length,
      whale: whaleItems.length,
      social: socialItems.length,
      all: allItems.length,
    },
  };
}
