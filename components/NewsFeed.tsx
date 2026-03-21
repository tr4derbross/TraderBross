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
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  // Liquidation stats for dynamic tab label
  const [liqStats, setLiqStats] = useState<{ totalUSD: number; longUSD: number; shortUSD: number; count: number } | null>(null);

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
    if (news.length > 0) setLastRefreshAt(new Date());
  }, [news.length]);

  const handleRefresh = () => {
    refreshNews();
    setLastRefreshAt(new Date());
  };

  const resetNewsFilters = () => {
    setSector("All");
    setTicker("");
    setKeyword("");
    setImportanceFilter("all");
    setSentimentFilter("all");
  };

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

  // Handle liquidation stats update from LiquidationFeed
  const handleLiqdStatsUpdate = (stats: { totalUSD: number; longUSD: number; shortUSD: number; count: number }) => {
    setLiqStats(stats);
  };

  // Compute dynamic liquidation tab label
  const liqLabel: string | undefined = (() => {
    if (!liqStats || liqStats.totalUSD <= 0) return undefined;
    const usd = liqStats.totalUSD;
    if (usd >= 1_000_000_000) return `Liq $${(usd / 1_000_000_000).toFixed(1)}B`;
    if (usd >= 1_000_000) return `Liq $${(usd / 1_000_000).toFixed(1)}M`;
    if (usd >= 1_000) return `Liq $${(usd / 1_000).toFixed(0)}K`;
    return `Liq $${usd.toFixed(0)}`;
  })();

  const sourceLabel: Record<SourceFilter, string> = {
    all: "News Feed",
    news: "News",
    social: "Social / X",
    whale: "Whale Alerts",
    liquidation: "Liquidations",
  };

  const isSpecialFeed = sourceFilter === "whale" || sourceFilter === "liquidation";
  const devSimEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_SIM_FEEDS === "true";
  const hasSpecialLiveData = sourceFilter === "whale" ? counts.whale > 0 : sourceFilter === "liquidation" ? counts.liquidation > 0 : false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Panel header */}
      <div className="panel-header soft-divider flex items-center justify-between border-b px-2 py-1.5 sm:px-3 sm:py-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-200" />
          <span className="brand-section-title text-[10px] sm:text-xs font-bold tracking-wider uppercase">
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
          {isSpecialFeed && hasSpecialLiveData && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE
            </span>
          )}
          {isSpecialFeed && !hasSpecialLiveData && devSimEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
              DEV SIM
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-[10px] text-zinc-500">
          {!isSpecialFeed && (
            <span className="hidden md:inline rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] text-zinc-500">
              informational only
            </span>
          )}
          {liveCount > 0 && !isSpecialFeed && (
            <span className="inline-flex items-center gap-1 text-amber-200">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              +{liveCount}
            </span>
          )}
          {!isSpecialFeed && (
            <button
              type="button"
              onClick={handleRefresh}
              className="brand-badge inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] sm:px-2 sm:text-[10px] transition hover:border-[rgba(212,161,31,0.24)] hover:text-amber-100"
              title="Refresh feed"
            >
              <RefreshCw className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          {!isSpecialFeed && lastRefreshAt && (
            <span className="hidden lg:inline text-[9px] text-zinc-600">
              updated {lastRefreshAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          {!isSpecialFeed && <span className="hidden sm:inline">{news.length} items</span>}
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
        liqLabel={liqLabel}
      />

      {/* Specialized feeds */}
      {sourceFilter === "whale" ? (
        <WhaleFeed onPulse={handleWhalePulse} />
      ) : sourceFilter === "liquidation" ? (
        <LiquidationFeed onPulse={handleLiqdPulse} onStatsUpdate={handleLiqdStatsUpdate} />
      ) : (
        /* Standard news feed */
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.18) transparent" }}>
          {loading ? (
            <NewsFeedSkeleton />
          ) : news.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-zinc-600">
              <span>No items matching current filters</span>
              {sourceFilter === "social" && (
                <span className="text-[10px] text-zinc-700 text-center px-4">
                  Configure NITTER_BASE_URL or SOCIAL_RSS_URLS in .env.local for live tweets
                </span>
              )}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetNewsFilters}
                  className="rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-300 transition hover:border-amber-500/30 hover:text-amber-100"
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-300 transition hover:border-amber-500/30 hover:text-amber-100"
                >
                  Refresh
                </button>
              </div>
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
