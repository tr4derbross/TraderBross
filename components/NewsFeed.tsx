"use client";

import { useEffect, useRef, useState } from "react";
import { NewsItem } from "@/lib/mock-data";
import { useNews, SourceFilter } from "@/hooks/useNews";
import NewsCard from "./NewsCard";
import FilterBar from "./FilterBar";
import { Activity, RefreshCw } from "lucide-react";

type Props = {
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onNewItem?: (item: NewsItem) => void;
  onTickerSelect?: (ticker: string, item: NewsItem) => void;
};

export default function NewsFeed({ onSelectItem, selectedItem, onNewItem, onTickerSelect }: Props) {
  const [sector, setSector] = useState("All");
  const [ticker, setTicker] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevLengthRef = useRef(0);

  const { news, loading, liveCount, counts, refreshNews } = useNews({
    sector,
    ticker,
    keyword,
    sourceFilter,
  });

  useEffect(() => {
    if (news.length > prevLengthRef.current && prevLengthRef.current > 0) {
      const latestId = news[0]?.id;
      if (latestId) {
        setNewIds((prev) => new Set([...prev, latestId]));
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            next.delete(latestId);
            return next;
          });
        }, 5000);
        onNewItem?.(news[0]);
      }
    }
    prevLengthRef.current = news.length;
  }, [news.length]);

  const sourceLabel: Record<SourceFilter, string> = {
    all: "News Feed",
    news: "News",
    social: "Social / X",
    whale: "Whale Alerts",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[rgba(212,161,31,0.12)] bg-[linear-gradient(180deg,rgba(21,18,14,0.96),rgba(10,10,10,0.94))] px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs font-bold tracking-wider uppercase">
            {sourceLabel[sourceFilter]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          {liveCount > 0 && (
            <span className="text-amber-200 animate-pulse">+{liveCount} live</span>
          )}
          <button
            type="button"
            onClick={refreshNews}
            className="brand-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition hover:border-[rgba(212,161,31,0.24)] hover:text-amber-100"
            title="Refresh feed"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span>{news.length} items</span>
        </div>
      </div>

      <FilterBar
        sector={sector}
        ticker={ticker}
        keyword={keyword}
        sourceFilter={sourceFilter}
        onSector={setSector}
        onTicker={setTicker}
        onKeyword={setKeyword}
        onSource={setSourceFilter}
        counts={counts}
      />

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-xs">
            Loading...
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 text-xs">
            <span>No items matching filters</span>
            {sourceFilter === "social" && (
              <span className="text-[10px] text-zinc-700 text-center px-4">
                Configure NITTER_BASE_URL or SOCIAL_RSS_URLS in .env.local for live tweets
              </span>
            )}
            {sourceFilter === "whale" && (
              <span className="text-[10px] text-zinc-700 text-center px-4">
                Configure WHALE_ALERT_KEY in .env.local for live whale alerts
              </span>
            )}
          </div>
        ) : (
          news.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              isNew={newIds.has(item.id)}
              onSelect={onSelectItem}
              onTickerSelect={onTickerSelect}
              selected={selectedItem?.id === item.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
