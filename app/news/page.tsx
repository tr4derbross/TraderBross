"use client";

import { useState, useEffect, useMemo } from "react";
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
  Megaphone,
  Flame,
  BarChart2,
  Calendar,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import { useNews, SourceFilter, SentimentFilter } from "@/hooks/useNews";
import type { NewsItem } from "@/lib/mock-data";
import { getAllTradeLinks } from "@/lib/referral-links";

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

/* ── Ad units ──────────────────────────────────────────────────────────────── */

function AdLeaderboard() {
  return (
    <div className="flex h-[68px] w-full items-center justify-center rounded-xl border border-dashed border-[rgba(212,161,31,0.1)] bg-[rgba(212,161,31,0.02)]">
      <div className="flex items-center gap-2 text-[10px] text-zinc-700">
        <Megaphone className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.18em]">Advertisement · 728×90</span>
      </div>
    </div>
  );
}

function AdMediumRect() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center rounded-xl border border-dashed border-[rgba(212,161,31,0.1)] bg-[rgba(212,161,31,0.02)]">
      <div className="flex flex-col items-center gap-2 text-zinc-700">
        <Megaphone className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-[0.18em]">Advertisement · 300×250</span>
      </div>
    </div>
  );
}

function AdInlineBanner() {
  return (
    <div className="mx-4 my-1 flex h-[56px] items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
      <div className="flex items-center gap-2 text-[9px] text-zinc-800">
        <Megaphone className="h-3 w-3" />
        <span className="uppercase tracking-[0.16em]">Advertisement · 468×60</span>
      </div>
    </div>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────────── */

function Avatar({ item }: { item: NewsItem }) {
  const initials = item.author
    ? item.author.slice(0, 2).toUpperCase()
    : item.source.slice(0, 2).toUpperCase();
  const colors: Record<string, string> = {
    social: "bg-sky-900/50 text-sky-300 border-sky-700/30",
    whale:  "bg-violet-900/50 text-violet-300 border-violet-700/30",
    news:   "bg-amber-900/30 text-amber-300 border-amber-700/20",
  };
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${colors[item.type ?? "news"] ?? colors.news}`}>
      {initials}
    </div>
  );
}

/* ── News card ─────────────────────────────────────────────────────────────── */

function NewsCard({ item, onSelect, selected }: {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  selected: boolean;
}) {
  return (
    <article
      onClick={() => onSelect(item)}
      className={`cursor-pointer border-b border-[rgba(255,255,255,0.04)] px-4 py-3 transition-all hover:bg-[rgba(255,255,255,0.025)] ${
        selected
          ? "border-l-2 border-l-amber-500/50 bg-[rgba(212,161,31,0.04)]"
          : ""
      }`}
    >
      <div className="flex gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-[#e8dfc8]">
              {item.author ?? item.source}
            </span>
            {item.authorHandle && (
              <span className="text-[11px] text-zinc-500">@{item.authorHandle}</span>
            )}
            <span className="ml-auto text-[10px] text-zinc-600">{timeAgo(item.timestamp)}</span>
          </div>

          <p className="text-[12px] leading-[1.55] text-zinc-300">{item.headline}</p>

          {item.type === "news" && item.summary && item.summary !== item.headline && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-zinc-600">
              {item.summary}
            </p>
          )}

          {item.type === "whale" && item.whaleAmountUsd && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-violet-400" />
              <span className="text-[11px] font-bold text-violet-300">
                ${(item.whaleAmountUsd / 1_000_000).toFixed(2)}M
              </span>
              {item.whaleFrom && item.whaleTo && (
                <span className="text-[10px] text-zinc-600">{item.whaleFrom} → {item.whaleTo}</span>
              )}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.sentiment && (
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${sentimentColor(item.sentiment)}`}>
                {item.sentiment === "bullish" ? <TrendingUp className="h-2.5 w-2.5" /> : item.sentiment === "bearish" ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                {item.sentiment}
              </span>
            )}
            <div className="flex flex-wrap gap-1">
              {item.ticker?.slice(0, 3).map((t) => (
                <Link
                  key={t}
                  href={`/terminal?ticker=${t}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)] px-1.5 py-0.5 text-[9px] font-bold text-amber-400 transition hover:bg-[rgba(212,161,31,0.14)]"
                >
                  {t}
                </Link>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-zinc-700">{item.source}</span>
            {item.url && item.url !== "#" && (
              <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-zinc-700 transition hover:text-zinc-400">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── TradingView ───────────────────────────────────────────────────────────── */

function TradingViewChart({ symbol }: { symbol: string }) {
  return (
    <iframe
      key={symbol}
      src={`https://www.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}&interval=60&theme=dark&style=1&locale=en&toolbar_bg=%2307060a&hide_side_toolbar=1&hidetoptoolbar=1&hidevolume=1&allow_symbol_change=0&save_image=0&backgroundColor=07060a&gridColor=rgba(255,255,255,0.03)`}
      className="h-full w-full border-0"
      title="TradingView Chart"
    />
  );
}

/* ── Trending Topics ───────────────────────────────────────────────────────── */

interface TrendingTopic {
  ticker: string;
  count: number;
  sentiment: { bullish: number; bearish: number; neutral: number };
}

function TrendingTopics({ news }: { news: NewsItem[] }) {
  const topics = useMemo<TrendingTopic[]>(() => {
    const map = new Map<string, TrendingTopic>();
    for (const item of news) {
      for (const t of item.ticker ?? []) {
        if (!map.has(t)) {
          map.set(t, { ticker: t, count: 0, sentiment: { bullish: 0, bearish: 0, neutral: 0 } });
        }
        const entry = map.get(t)!;
        entry.count++;
        if (item.sentiment === "bullish") entry.sentiment.bullish++;
        else if (item.sentiment === "bearish") entry.sentiment.bearish++;
        else entry.sentiment.neutral++;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [news]);

  if (topics.length === 0) return null;

  return (
    <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Trending Now</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map(({ ticker, count, sentiment }) => {
          const dom = sentiment.bullish >= sentiment.bearish ? "bullish" : "bearish";
          return (
            <Link
              key={ticker}
              href={`/terminal?ticker=${ticker}`}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition hover:scale-105 ${
                dom === "bullish"
                  ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-300 hover:border-emerald-500/40"
                  : "border-rose-500/20 bg-rose-500/8 text-rose-300 hover:border-rose-500/40"
              }`}
            >
              {ticker}
              <span className="rounded-full bg-white/10 px-1 text-[8px] font-normal opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Market Impact panel ──────────────────────────────────────────────────── */

interface PriceQuote {
  symbol: string;
  price: number;
  changePct: number;
}

function MarketImpact({ item }: { item: NewsItem }) {
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);

  useEffect(() => {
    if (!item.ticker?.length) return;
    fetch("/api/prices?type=quotes")
      .then((r) => r.json())
      .then((data: PriceQuote[]) => {
        const relevant = data.filter((q) => item.ticker?.includes(q.symbol));
        setQuotes(relevant);
      })
      .catch(() => {});
  }, [item]);

  if (!item.ticker?.length || quotes.length === 0) return null;

  return (
    <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <BarChart2 className="h-3 w-3 text-amber-400/80" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Market Prices</span>
        <span className="ml-auto text-[9px] text-zinc-700">24h change</span>
      </div>
      <div className="space-y-1.5">
        {quotes.map((q) => {
          const pos = q.changePct >= 0;
          const fmtPrice = q.price >= 1000
            ? `$${q.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : q.price >= 1
            ? `$${q.price.toFixed(2)}`
            : `$${q.price.toFixed(4)}`;
          return (
            <div key={q.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-300">{q.symbol}</span>
                <span className="text-[11px] tabular-nums text-zinc-300">{fmtPrice}</span>
              </div>
              <span className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${pos ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                {pos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {pos ? "+" : ""}{q.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Exchange trade links */}
      {item.ticker?.[0] && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[rgba(255,255,255,0.05)] pt-2.5">
          {getAllTradeLinks(item.ticker[0]).slice(0, 4).map(({ exchange, label, href, color }) => (
            <a
              key={exchange}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`rounded-md border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[9px] font-bold transition hover:bg-[rgba(255,255,255,0.06)] ${color}`}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

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

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function NewsPage() {
  const [sourceFilter, setSourceFilter]       = useState<SourceFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [search, setSearch]                   = useState("");
  const [selectedItem, setSelectedItem]       = useState<NewsItem | null>(null);
  const [chartSymbol, setChartSymbol]         = useState("BTCUSDT");
  const [now, setNow]                         = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  void now;

  const { news, loading, liveCount, isLive, refreshNews, counts } = useNews({
    sourceFilter,
    sentimentFilter,
    keyword: search.length >= 2 ? search : undefined,
  });

  function handleSelect(item: NewsItem) {
    setSelectedItem(item);
    const t = item.ticker?.[0];
    const candidate = t ? `${t}USDT` : null;
    if (candidate && CHART_SYMBOLS.includes(candidate)) setChartSymbol(candidate);
  }

  /* Interleave inline ads every 8 cards */
  const feedItems: React.ReactNode[] = [];
  news.forEach((item, i) => {
    feedItems.push(
      <NewsCard key={item.id} item={item} onSelect={handleSelect} selected={selectedItem?.id === item.id} />
    );
    if ((i + 1) % 8 === 0 && i < news.length - 1) {
      feedItems.push(<AdInlineBanner key={`ad-inline-${i}`} />);
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#07060a] text-[var(--text-primary)]">
      <SiteNav />

      {/* Leaderboard banner */}
      <div className="border-b border-[rgba(255,255,255,0.04)] px-4 py-2 sm:px-6 lg:px-8">
        <AdLeaderboard />
      </div>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left: news feed */}
        <div className="flex w-full flex-col border-r border-[rgba(255,255,255,0.05)] lg:w-[520px] xl:w-[560px]">
          {/* Feed header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-bold tracking-[-0.01em] text-[#e8dfc8]">News &amp; Tweets</h1>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${isLive ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border border-zinc-700/40 bg-zinc-800/40 text-zinc-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`} />
                {isLive ? "Live" : "Loading"}
              </span>
              {liveCount > 0 && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">+{liveCount}</span>
              )}
            </div>
            <button
              onClick={refreshNews}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1.5 text-[10px] text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="shrink-0 space-y-2 border-b border-[rgba(255,255,255,0.05)] px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines, symbols…"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.025)] py-1.5 pl-7 pr-3 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-[rgba(212,161,31,0.2)] transition"
              />
            </div>
            <div className="flex gap-1">
              {SOURCE_TABS.map(({ label, value, icon }) => (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                    sourceFilter === value
                      ? "bg-[rgba(212,161,31,0.14)] text-amber-200"
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
                {SENTIMENT_TABS.filter((t) => t.value !== "all").map(({ label, value }) => (
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

          {/* Feed */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && news.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="border-b border-[rgba(255,255,255,0.04)] px-4 py-4">
                    <div className="flex gap-3">
                      <div className="skeleton-shimmer h-8 w-8 rounded-full" />
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
              feedItems
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto lg:flex">

          {/* Chart header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={chartSymbol}
                  onChange={(e) => setChartSymbol(e.target.value)}
                  className="appearance-none rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] py-0.5 pl-2 pr-5 text-[11px] font-semibold text-zinc-300 outline-none transition hover:border-[rgba(212,161,31,0.2)]"
                >
                  {CHART_SYMBOLS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-zinc-600" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href="/screener"
                className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 transition hover:text-zinc-300"
              >
                <BarChart2 className="h-2.5 w-2.5" />
                Screener
              </Link>
              <Link
                href="/calendar"
                className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 transition hover:text-zinc-300"
              >
                <Calendar className="h-2.5 w-2.5" />
                Events
              </Link>
              <Link
                href={`/terminal?ticker=${chartSymbol.replace("USDT", "")}`}
                className="flex items-center gap-1 rounded-md border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-400 transition hover:bg-[rgba(212,161,31,0.12)]"
              >
                <LayoutDashboard className="h-2.5 w-2.5" />
                Trade
              </Link>
            </div>
          </div>

          {/* Chart — minimal rounded */}
          <div className="h-[300px] shrink-0 overflow-hidden">
            <TradingViewChart symbol={chartSymbol} />
          </div>

          {/* Trending Topics */}
          <TrendingTopics news={news} />

          {/* Selected item detail + market impact */}
          {selectedItem && (
            <>
              <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400/80">{selectedItem.source}</span>
                    <span className="text-[10px] text-zinc-600">{timeAgo(selectedItem.timestamp)}</span>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-[10px] text-zinc-600 hover:text-zinc-400">✕</button>
                </div>
                <p className="text-[12px] font-semibold leading-[1.5] text-[#e8dfc8]">{selectedItem.headline}</p>
                {selectedItem.summary && selectedItem.summary !== selectedItem.headline && (
                  <p className="mt-1 line-clamp-3 text-[11px] leading-[1.6] text-zinc-500">{selectedItem.summary}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedItem.ticker?.map((t) => (
                    <Link key={t} href={`/terminal?ticker=${t}`} className="rounded border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.06)] px-2 py-0.5 text-[9px] font-bold text-amber-400 hover:bg-[rgba(212,161,31,0.14)]">
                      {t}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Market impact */}
              <MarketImpact item={selectedItem} />
            </>
          )}

          {/* Ad units */}
          <div className="mx-3 mb-3 shrink-0">
            <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-zinc-800">Sponsorlu</p>
            <AdMediumRect />
          </div>

          <div className="mx-3 mb-3 shrink-0">
            <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-zinc-800">Sponsorlu</p>
            <div className="flex h-[80px] w-full items-center justify-center rounded-xl border border-dashed border-[rgba(212,161,31,0.08)] bg-[rgba(212,161,31,0.015)]">
              <div className="flex items-center gap-2 text-[9px] text-zinc-800">
                <Megaphone className="h-3 w-3" />
                <span className="uppercase tracking-[0.16em]">Advertisement · 300×90</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
