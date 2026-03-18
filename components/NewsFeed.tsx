"use client";

import { useEffect, useRef, useState } from "react";
import { NewsItem } from "@/lib/mock-data";
import type { NewsTradePreset } from "@/lib/news-trade";
import { useNews, SourceFilter, ImportanceFilter, SentimentFilter } from "@/hooks/useNews";
import NewsCard from "./NewsCard";
import FilterBar from "./FilterBar";
import WhaleFeed from "./WhaleFeed";
import LiquidationFeed from "./LiquidationFeed";
import { Activity, RefreshCw, Radio, Database } from "lucide-react";
import { NewsFeedSkeleton } from "@/components/Skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";

type Props = {
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onNewItem?: (item: NewsItem) => void;
  onTickerSelect?: (ticker: string, item: NewsItem) => void;
  onQuickTrade?: (preset: NewsTradePreset, item: NewsItem) => void;
  onAskAI?: (item: NewsItem) => void;
};

export default function NewsFeed({
  onSelectItem,
  selectedItem,
  onNewItem,
  onTickerSelect,
  onQuickTrade,
  onAskAI,
}: Props) {
  const [sector, setSector] = useState("All");
  const [ticker, setTicker] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevLengthRef = useRef(0);

  // Pulsing dot state for special tabs
  const [whalePulse, setWhalePulse] = useState(false);
  const [liqdPulse, setLiqdPulse] = useState(false);

  const { news, loading, liveCount, counts, refreshNews, isLive } = useNews({
    sector,
    ticker,
    keyword,
    sourceFilter,
    importanceFilter,
    sentimentFilter,
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

  // Handle whale pulse — auto-clear after 3s
  const handleWhalePulse = () => {
    setWhalePulse(true);
    setTimeout(() => setWhalePulse(false), 3000);
  };

  // Handle liquidation pulse — auto-clear after 3s
  const handleLiqdPulse = () => {
    setLiqdPulse(true);
    setTimeout(() => setLiqdPulse(false), 3000);
  };

  const sourceLabel: Record<SourceFilter, string> = {
    all: "News Feed",
    news: "News",
    social: "Social / X",
    whale: "Whale Alerts",
    liquidation: "Liquidations",
  };

  const isSpecialFeed = sourceFilter === "whale" || sourceFilter === "liquidation";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Panel header */}
      <div className="panel-header soft-divider flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs font-bold tracking-wider uppercase">
            {sourceLabel[sourceFilter]}
          </span>
          {/* Pulsing dot for whale/liquidation tabs */}
          {sourceFilter === "whale" && (
            <span
              className={`h-2 w-2 rounded-full ${whalePulse ? "animate-ping bg-amber-400" : "bg-amber-600"}`}
              title="Live whale data"
            />
          )}
          {sourceFilter === "liquidation" && (
            <span
              className={`h-2 w-2 rounded-full ${liqdPulse ? "animate-ping bg-rose-400" : "bg-rose-700"}`}
              title="Live liquidation data"
            />
          )}
          {/* Live / Mock badge */}
          {!isSpecialFeed && (
            isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LIVE
              </span>
            ) : (
              <span className="mock-badge inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                <Database className="h-2.5 w-2.5" />
                DEMO
              </span>
            )
          )}
          {isSpecialFeed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
              SIM
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-zinc-500">
          {liveCount > 0 && !isSpecialFeed && (
            <span className="inline-flex items-center gap-1 text-amber-200">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              +{liveCount}
            </span>
          )}
          {!isSpecialFeed && (
            <button
              type="button"
              onClick={refreshNews}
              className="brand-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition hover:border-[rgba(212,161,31,0.24)] hover:text-amber-100"
              title="Refresh feed"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
          {!isSpecialFeed && <span>{news.length} items</span>}
        </div>
      </div>

      <FilterBar
        sector={sector}
        ticker={ticker}
        keyword={keyword}
        sourceFilter={sourceFilter}
        importanceFilter={importanceFilter}
        sentimentFilter={sentimentFilter}
        onSector={setSector}
        onTicker={setTicker}
        onKeyword={setKeyword}
        onSource={(f) => {
          setSourceFilter(f);
          // Clear pulse when switching to that tab
          if (f === "whale") setWhalePulse(false);
          if (f === "liquidation") setLiqdPulse(false);
        }}
        onImportance={setImportanceFilter}
        onSentiment={setSentimentFilter}
        counts={counts}
      />

      {/* Specialized feeds */}
      {sourceFilter === "whale" ? (
        <WhaleFeed onPulse={handleWhalePulse} />
      ) : sourceFilter === "liquidation" ? (
        <LiquidationFeed onPulse={handleLiqdPulse} />
      ) : (
        /* Standard news feed */
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.18) transparent" }}>
          {loading ? (
            <NewsFeedSkeleton />
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 text-xs">
              <span>No items matching filters</span>
              {sourceFilter === "social" && (
                <span className="text-[10px] text-zinc-700 text-center px-4">
                  Configure NITTER_BASE_URL or SOCIAL_RSS_URLS in .env.local for live tweets
                </span>
              )}
            </div>
          ) : (
            <ErrorBoundary label="News Feed" fullHeight={false}>
              <div className="panel-fade-in" suppressHydrationWarning>
                {news.map((item) => (
                  <NewsCard
                    key={item.id}
                    item={item}
                    isNew={newIds.has(item.id)}
                    onSelect={onSelectItem}
                    onTickerSelect={onTickerSelect}
                    onQuickTrade={onQuickTrade}
                    onAskAI={onAskAI}
                    selected={selectedItem?.id === item.id}
                  />
                ))}
              </div>
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}
