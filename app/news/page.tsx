"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Waves,
  Newspaper,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import { useNews, SourceFilter, SentimentFilter } from "@/hooks/useNews";
import type { NewsItem } from "@/lib/mock-data";

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentimentColor(s?: string) {
  if (s === "bullish") return "text-emerald-400";
  if (s === "bearish") return "text-rose-400";
  return "text-zinc-500";
}

/* ── Avatar ─────────────────────────────────────────────────────────────────── */
function Avatar({ item }: { item: NewsItem }) {
  const initials = item.author
    ? item.author.slice(0, 2).toUpperCase()
    : item.source.slice(0, 2).toUpperCase();

  const colors: Record<string, string> = {
    social: "bg-sky-900/60 text-sky-300 border-sky-700/40",
    whale: "bg-violet-900/60 text-violet-300 border-violet-700/40",
    news: "bg-amber-900/40 text-amber-300 border-amber-700/30",
  };
  const cls = colors[item.type ?? "news"] ?? colors.news;

  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${cls}`}>
      {initials}
    </div>
  );
}

/* ── News card ─────────────────────────────────────────────────────────────── */
function NewsCard({ item, onSelect, selected }: { item: NewsItem; onSelect: (item: NewsItem) => void; selected: boolean }) {
  return (
    <article
      onClick={() => onSelect(item)}
      className={`cursor-pointer border-b border-[rgba(255,255,255,0.05)] px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)] ${selected ? "bg-[rgba(212,161,31,0.05)]" : ""}`}
    >
      <div className="flex gap-3">
        <Avatar item={item} />

        <div className="min-w-0 flex-1">
          {/* Author / source row */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-[#e8dfc8]">
              {item.author ?? item.source}
            </span>
            {item.authorHandle && (
              <span className="text-[11px] text-zinc-500">@{item.authorHandle}</span>
            )}
            <span className="ml-auto text-[10px] text-zinc-600">{timeAgo(item.timestamp)}</span>
          </div>

          {/* Headline */}
          <p className="text-[12px] leading-[1.55] text-zinc-300">{item.headline}</p>

          {/* Summary (for news only) */}
          {item.type === "news" && item.summary && item.summary !== item.headline && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-zinc-600">
              {item.summary}
            </p>
          )}

          {/* Whale amount */}
          {item.type === "whale" && item.whaleAmountUsd && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-violet-400" />
              <span className="text-[11px] font-bold text-violet-300">
                ${(item.whaleAmountUsd / 1_000_000).toFixed(2)}M
              </span>
              {item.whaleFrom && item.whaleTo && (
                <span className="text-[10px] text-zinc-600">
                  {item.whaleFrom} → {item.whaleTo}
                </span>
              )}
            </div>
          )}

          {/* Footer row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Sentiment */}
            {item.sentiment && (
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${sentimentColor(item.sentiment)}`}>
                {item.sentiment === "bullish" ? <TrendingUp className="h-2.5 w-2.5" /> : item.sentiment === "bearish" ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                {item.sentiment}
              </span>
            )}

            {/* Tickers */}
            <div className="flex flex-wrap gap-1">
              {item.ticker?.slice(0, 3).map((t) => (
                <Link
                  key={t}
                  href={`/terminal?ticker=${t}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.06)] px-1.5 py-0.5 text-[9px] font-bold text-amber-400 hover:bg-[rgba(212,161,31,0.14)]"
                >
                  {t}
                </Link>
              ))}
            </div>

            {/* Source */}
            <span className="ml-auto text-[10px] text-zinc-700">{item.source}</span>

            {/* External link */}
            {item.url && item.url !== "#" && (
              <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-zinc-700 hover:text-zinc-400">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── TradingView widget ─────────────────────────────────────────────────────── */
function TradingViewChart({ symbol }: { symbol: string }) {
  const tvSymbol = `BINANCE:${symbol.replace("/", "").replace("USDT", "USDT").toUpperCase()}`;

  return (
    <iframe
      key={symbol}
      src={`https://www.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=60&theme=dark&style=1&locale=en&toolbar_bg=%230d0d0f&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&hidevolume=0&hidetoptoolbar=0`}
      className="h-full w-full rounded-xl border-0"
      allow="clipboard-write"
      title="TradingView Chart"
    />
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

const SOURCE_TABS: { label: string; value: SourceFilter; icon?: React.ReactNode }[] = [
  { label: "All",    value: "all" },
  { label: "News",   value: "news",   icon: <Newspaper className="h-3 w-3" /> },
  { label: "Social", value: "social", icon: <span className="text-[10px]">𝕏</span> },
  { label: "Whales", value: "whale",  icon: <Waves className="h-3 w-3" /> },
];

const SENTIMENT_TABS: { label: string; value: SentimentFilter }[] = [
  { label: "All",     value: "all" },
  { label: "Bullish", value: "bullish" },
  { label: "Bearish", value: "bearish" },
  { label: "Neutral", value: "neutral" },
];

const CHART_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

export default function NewsPage() {
  const [sourceFilter, setSourceFilter]       = useState<SourceFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [search, setSearch]                   = useState("");
  const [selectedItem, setSelectedItem]       = useState<NewsItem | null>(null);
  const [chartSymbol, setChartSymbol]         = useState("BTCUSDT");
  const [now, setNow]                         = useState(Date.now());

  // Tick every 30 s to keep timestamps fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  void now; // used to trigger re-render

  const { news, loading, liveCount, isLive, refreshNews, counts } = useNews({
    sourceFilter,
    sentimentFilter,
    keyword: search.length >= 2 ? search : undefined,
  });

  // When user clicks a card, sync chart to first ticker
  function handleSelect(item: NewsItem) {
    setSelectedItem(item);
    const t = item.ticker?.[0];
    if (t && CHART_SYMBOLS.includes(`${t}USDT`)) setChartSymbol(`${t}USDT`);
    else if (t && CHART_SYMBOLS.includes(t)) setChartSymbol(t);
  }

  return (
    <div className="flex h-screen flex-col bg-[#09080c] text-[var(--text-primary)]">
      <SiteNav />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left: news feed ──────────────────────────────────────────────── */}
        <div className="flex w-full flex-col border-r border-[rgba(255,255,255,0.06)] lg:w-[520px] xl:w-[580px]">
          {/* Feed header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-bold tracking-[-0.01em] text-[#e8dfc8]">
                News &amp; Tweets
              </h1>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${isLive ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border border-zinc-700/40 bg-zinc-800/40 text-zinc-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`} />
                {isLive ? "Live" : "Loading"}
              </span>
              {liveCount > 0 && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                  +{liveCount}
                </span>
              )}
            </div>
            <button
              onClick={refreshNews}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 text-[10px] text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines, symbols…"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] py-1.5 pl-7 pr-3 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-[rgba(212,161,31,0.2)]"
              />
            </div>

            {/* Source tabs */}
            <div className="flex gap-1">
              {SOURCE_TABS.map(({ label, value, icon }) => (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
                    sourceFilter === value
                      ? "bg-[rgba(212,161,31,0.16)] text-amber-200"
                      : "text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  {icon}
                  {label}
                  {value !== "all" && (
                    <span className="opacity-50">
                      {value === "news" ? counts.news : value === "social" ? counts.social : counts.whale}
                    </span>
                  )}
                </button>
              ))}

              <div className="ml-auto flex gap-1">
                {SENTIMENT_TABS.filter(t => t.value !== "all").map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setSentimentFilter(sentimentFilter === value ? "all" : value)}
                    className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                      sentimentFilter === value
                        ? value === "bullish" ? "bg-emerald-500/15 text-emerald-400" : value === "bearish" ? "bg-rose-500/15 text-rose-400" : "bg-zinc-700/40 text-zinc-300"
                        : "text-zinc-700 hover:text-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feed list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && news.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="border-b border-[rgba(255,255,255,0.05)] px-4 py-4">
                    <div className="flex gap-3">
                      <div className="skeleton-shimmer h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="skeleton-shimmer h-3 w-1/3 rounded" />
                        <div className="skeleton-shimmer h-3 w-full rounded" />
                        <div className="skeleton-shimmer h-3 w-4/5 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : news.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-zinc-600">
                <Newspaper className="h-7 w-7 opacity-30" />
                <p className="text-sm">No items match your filters.</p>
              </div>
            ) : (
              news.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onSelect={handleSelect}
                  selected={selectedItem?.id === item.id}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: chart + detail ────────────────────────────────────────── */}
        <div className="hidden min-h-0 flex-1 flex-col lg:flex">
          {/* Chart header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#e8dfc8]">TradingView</span>
              <span className="text-[11px] text-zinc-600">{chartSymbol}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Symbol selector */}
              <div className="relative">
                <select
                  value={chartSymbol}
                  onChange={(e) => setChartSymbol(e.target.value)}
                  className="appearance-none rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] py-1 pl-2.5 pr-6 text-[10px] text-zinc-300 outline-none"
                >
                  {CHART_SYMBOLS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
              </div>

              <Link
                href={`/terminal?ticker=${chartSymbol.replace("USDT", "")}`}
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.07)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300 transition hover:bg-[rgba(212,161,31,0.14)]"
              >
                <LayoutDashboard className="h-3 w-3" />
                Trade
              </Link>
            </div>
          </div>

          {/* TradingView chart */}
          <div className="min-h-0 flex-1 p-3">
            <TradingViewChart symbol={chartSymbol} />
          </div>

          {/* Selected item detail */}
          {selectedItem && (
            <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-[0.14em]">{selectedItem.source}</span>
                  <span className="text-[10px] text-zinc-600">{timeAgo(selectedItem.timestamp)}</span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400"
                >
                  ✕
                </button>
              </div>
              <p className="text-[12px] font-semibold leading-[1.5] text-[#e8dfc8]">
                {selectedItem.headline}
              </p>
              {selectedItem.summary && selectedItem.summary !== selectedItem.headline && (
                <p className="mt-1 line-clamp-3 text-[11px] leading-[1.6] text-zinc-500">
                  {selectedItem.summary}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedItem.ticker?.map((t) => (
                  <Link
                    key={t}
                    href={`/terminal?ticker=${t}`}
                    className="rounded border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.06)] px-2 py-0.5 text-[9px] font-bold text-amber-400 hover:bg-[rgba(212,161,31,0.14)]"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
