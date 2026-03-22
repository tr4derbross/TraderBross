"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Flame,
  BarChart2,
  Calendar,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useNews, SourceFilter, SentimentFilter } from "@/hooks/useNews";
import type { NewsItem, TickerQuote } from "@/lib/mock-data";
import { getAllTradeLinks } from "@/lib/referral-links";
import { useRealtimeSelector } from "@/lib/realtime-client";
import { apiFetch } from "@/lib/api-client";

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentimentColor(s?: string) {
  if (s === "bullish") return "text-[#4CAF50]";
  if (s === "bearish") return "text-[#FF4D4D]";
  return "text-[#6B6B6B]";
}

/* ── Avatar ────────────────────────────────────────────────────────────────── */

function Avatar({ item }: { item: NewsItem }) {
  const initials = item.author
    ? item.author.slice(0, 2).toUpperCase()
    : item.source.slice(0, 2).toUpperCase();
  const colors: Record<string, string> = {
    social: "bg-[rgba(242,183,5,0.1)] text-[#F2B705] border-[rgba(242,183,5,0.2)]",
    whale:  "bg-[rgba(255,255,255,0.05)] text-[#A0A0A0] border-[rgba(255,255,255,0.1)]",
    news:   "bg-[rgba(242,183,5,0.08)] text-[#F2B705] border-[rgba(242,183,5,0.15)]",
  };
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
        colors[item.type ?? "news"] ?? colors.news
      }`}
    >
      {initials}
    </div>
  );
}

/* ── Skeleton card ─────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="border-b border-[rgba(242,183,5,0.06)] px-4 py-4">
      <div className="flex gap-3">
        <div className="h-8 w-8 rounded-full skeleton shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3 w-1/3 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ── News card ─────────────────────────────────────────────────────────────── */

function NewsCard({
  item,
  onSelect,
  selected,
}: {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  selected: boolean;
}) {
  return (
    <article
      onClick={() => onSelect(item)}
      className={`cursor-pointer border-b border-[rgba(242,183,5,0.06)] px-4 py-3 transition-all hover:bg-[rgba(242,183,5,0.03)] ${
        selected
          ? "border-l-2 border-l-[#F2B705]/50 bg-[rgba(242,183,5,0.05)]"
          : ""
      }`}
    >
      <div className="flex gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-[#FFFFFF]">
              {item.author ?? item.source}
            </span>
            {item.authorHandle && (
              <span className="text-[11px] text-[#6B6B6B]">
                @{item.authorHandle}
              </span>
            )}
            {item.importance === "breaking" && (
              <span className="rounded-sm bg-[#FF4D4D] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                BREAKING
              </span>
            )}
            <span className="ml-auto text-[10px] text-[#3A3A3A]">
              {timeAgo(item.timestamp)}
            </span>
          </div>

          <p className="text-[12px] leading-[1.55] text-[#A0A0A0]">
            {item.headline}
          </p>

          {item.type === "news" &&
            item.summary &&
            item.summary !== item.headline && (
              <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-[#6B6B6B]">
                {item.summary}
              </p>
            )}

          {item.type === "whale" && item.whaleAmountUsd && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-[#F2B705]" />
              <span className="text-[11px] font-bold text-[#F2B705]">
                ${(item.whaleAmountUsd / 1_000_000).toFixed(2)}M
              </span>
              {item.whaleFrom && item.whaleTo && (
                <span className="text-[10px] text-[#6B6B6B]">
                  {item.whaleFrom} → {item.whaleTo}
                </span>
              )}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.sentiment && (
              <span
                className={`flex items-center gap-0.5 text-[10px] font-semibold ${sentimentColor(item.sentiment)}`}
              >
                {item.sentiment === "bullish" ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : item.sentiment === "bearish" ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <Minus className="h-2.5 w-2.5" />
                )}
                {item.sentiment}
              </span>
            )}

            <div className="flex flex-wrap gap-1">
              {item.ticker?.slice(0, 3).map((t) => (
                <Link
                  key={t}
                  href={`/terminal?ticker=${t}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-1.5 py-0.5 text-[9px] font-bold text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
                >
                  {t}
                </Link>
              ))}
            </div>

            <span className="ml-auto text-[10px] text-[#3A3A3A]">
              {item.source}
            </span>
            {item.url && item.url !== "#" && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#3A3A3A] transition hover:text-[#A0A0A0]"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Action row */}
          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/terminal${item.ticker?.[0] ? `?ticker=${item.ticker[0]}` : ""}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-0.5 text-[9px] font-bold text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
            >
              <Zap className="h-2.5 w-2.5" />
              Trade →
            </Link>
            <Link
              href={`/terminal${item.ticker?.[0] ? `?ticker=${item.ticker[0]}&ai=1` : "?ai=1"}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded border border-[rgba(242,183,5,0.15)] bg-[rgba(242,183,5,0.06)] px-2 py-0.5 text-[9px] font-bold text-[#A0A0A0] transition hover:bg-[rgba(242,183,5,0.12)] hover:text-[#F2B705]"
            >
              Analyze
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── TradingView ───────────────────────────────────────────────────────────── */

type MiniBar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

function NewsMiniChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<unknown>(null);
  const seriesRef = useRef<unknown>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const init = async () => {
      if (!containerRef.current) return;
      const lwc = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;
      const chart = lwc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth || 640,
        height: containerRef.current.clientHeight || 300,
        layout: { background: { color: "#0B0B0B" }, textColor: "#6B6B6B", fontSize: 11 },
        grid: {
          vertLines: { color: "rgba(242,183,5,0.05)" },
          horzLines: { color: "rgba(242,183,5,0.05)" },
        },
        rightPriceScale: { borderColor: "rgba(242,183,5,0.1)" },
        timeScale: { borderColor: "rgba(242,183,5,0.1)", timeVisible: true },
      });
      const series = chart.addSeries(lwc.CandlestickSeries, {
        upColor: "#0ecb81",
        downColor: "#f6465d",
        borderUpColor: "#0ecb81",
        borderDownColor: "#f6465d",
        wickUpColor: "#0ecb81",
        wickDownColor: "#f6465d",
      });
      chartRef.current = chart;
      seriesRef.current = series;
      resizeRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          (chartRef.current as { applyOptions: (o: { width: number; height: number }) => void })?.applyOptions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      resizeRef.current.observe(containerRef.current);
    };
    init().catch(() => setError("Chart init failed"));
    return () => {
      disposed = true;
      resizeRef.current?.disconnect();
      resizeRef.current = null;
      try {
        (chartRef.current as { remove: () => void })?.remove();
      } catch {
        // ignore
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const ticker = symbol.replace("USDT", "");
    const endpoint = `/api/prices?ticker=${ticker}&quote=USDT&interval=15m&limit=200`;
    const load = async () => {
      try {
        const data = await apiFetch<MiniBar[]>(endpoint);
        if (!active) return;
        if (!Array.isArray(data) || data.length === 0) {
          setError("No chart data");
          return;
        }
        setError(null);
        (seriesRef.current as { setData: (rows: unknown[]) => void })?.setData(
          data.map((d) => ({
            time: d.time as never,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          })),
        );
        (chartRef.current as { timeScale: () => { fitContent: () => void } })?.timeScale().fitContent();
      } catch {
        if (active) setError("Chart data unavailable");
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [symbol]);

  return (
    <div className="h-full w-full">
      {error ? (
        <div className="flex h-full items-center justify-center text-[11px] text-[#6B6B6B]">{error}</div>
      ) : null}
      <div ref={containerRef} className={`h-full w-full ${error ? "hidden" : ""}`} />
    </div>
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
          map.set(t, {
            ticker: t,
            count: 0,
            sentiment: { bullish: 0, bearish: 0, neutral: 0 },
          });
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
    <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A0A0A0]">
          Trending Now
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map(({ ticker, count, sentiment }) => {
          const dom =
            sentiment.bullish >= sentiment.bearish ? "bullish" : "bearish";
          return (
            <Link
              key={ticker}
              href={`/terminal?ticker=${ticker}`}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition hover:scale-105 ${
                dom === "bullish"
                  ? "border-[#4CAF50]/20 bg-[#4CAF50]/8 text-[#4CAF50] hover:border-[#4CAF50]/40"
                  : "border-[#FF4D4D]/20 bg-[#FF4D4D]/8 text-[#FF4D4D] hover:border-[#FF4D4D]/40"
              }`}
            >
              {ticker}
              <span className="rounded-full bg-white/10 px-1 text-[8px] font-normal opacity-70">
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Market Impact panel ──────────────────────────────────────────────────── */

function MarketImpact({ item, quotes }: { item: NewsItem; quotes: TickerQuote[] }) {
  const relevantQuotes = useMemo(
    () => quotes.filter((quote) => item.ticker?.includes(quote.symbol)),
    [item.ticker, quotes]
  );

  if (!item.ticker?.length || relevantQuotes.length === 0) return null;

  return (
    <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <BarChart2 className="h-3 w-3 text-[#F2B705]/80" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">
          Market Prices
        </span>
        <span className="ml-auto text-[9px] text-[#3A3A3A]">24h change</span>
      </div>
      <div className="space-y-1.5">
        {relevantQuotes.map((q) => {
          const pos = q.changePct >= 0;
          const fmtPrice =
            q.price >= 1000
              ? `$${q.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : q.price >= 1
              ? `$${q.price.toFixed(2)}`
              : `$${q.price.toFixed(4)}`;
          return (
            <div key={q.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#F2B705]">
                  {q.symbol}
                </span>
                <span className="text-[11px] tabular-nums text-[#A0A0A0]">
                  {fmtPrice}
                </span>
              </div>
              <span
                className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  pos
                    ? "bg-[#4CAF50]/10 text-[#4CAF50]"
                    : "bg-[#FF4D4D]/10 text-[#FF4D4D]"
                }`}
              >
                {pos ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {pos ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Exchange trade links */}
      {item.ticker?.[0] && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[rgba(242,183,5,0.08)] pt-2.5">
          {getAllTradeLinks(item.ticker[0])
            .slice(0, 4)
            .map(({ exchange, label, href, color }) => (
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

const SOURCE_TABS: {
  label: string;
  value: SourceFilter;
  icon?: React.ReactNode;
}[] = [
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
  const quotes = useRealtimeSelector((state) => state.quotes);

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

  const feedItems: React.ReactNode[] = news.map((item) => (
    <NewsCard
      key={item.id}
      item={item}
      onSelect={handleSelect}
      selected={selectedItem?.id === item.id}
    />
  ));

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0B0B0B] text-[#FFFFFF]">
      {/* Background watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden">
        <img
          src="/Brand/logo.png"
          alt=""
          aria-hidden="true"
          style={{ opacity: 0.04, width: "50%", maxWidth: 600, objectFit: "contain" }}
        />
      </div>

      <Navbar />

      {/* Main layout */}
      <div className="news-grid relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {/* Left: news feed */}
        <div className="flex w-full flex-col border-r border-[rgba(242,183,5,0.08)] lg:w-[520px] xl:w-[560px]">
          {/* Feed header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(242,183,5,0.08)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-bold tracking-[-0.01em] text-[#FFFFFF]">
                News &amp; Tweets
              </h1>
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                  isLive
                    ? "border border-[#4CAF50]/25 bg-[#4CAF50]/10 text-[#4CAF50]"
                    : "border border-[rgba(242,183,5,0.15)] bg-[rgba(242,183,5,0.06)] text-[#6B6B6B]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isLive ? "animate-pulse bg-[#4CAF50]" : "bg-[#6B6B6B]"
                  }`}
                />
                {isLive ? "Live" : "Loading"}
              </span>
              {liveCount > 0 && (
                <span className="rounded-full border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-0.5 text-[9px] font-bold text-[#F2B705]">
                  +{liveCount}
                </span>
              )}
            </div>
            <button
              onClick={refreshNews}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(242,183,5,0.12)] bg-[rgba(242,183,5,0.04)] px-2.5 py-1.5 text-[10px] text-[#A0A0A0] transition hover:text-[#FFFFFF] disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Sticky filter bar */}
          <div className="news-filter-row shrink-0 space-y-2 border-b border-[rgba(242,183,5,0.08)] bg-[#0B0B0B]/95 px-4 py-2.5 backdrop-blur-sm">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6B6B6B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines, symbols…"
                className="w-full rounded-lg border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] py-1.5 pl-7 pr-3 text-[11px] text-[#A0A0A0] outline-none placeholder:text-[#6B6B6B] focus:border-[rgba(242,183,5,0.3)] transition"
              />
            </div>

            {/* Source + sentiment tabs */}
            <div className="ticker-filter-bar flex gap-1">
              {SOURCE_TABS.map(({ label, value, icon }) => (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                    sourceFilter === value
                      ? "bg-[rgba(242,183,5,0.14)] text-[#F2B705]"
                      : "text-[#6B6B6B] hover:text-[#A0A0A0]"
                  }`}
                >
                  {icon}
                  {label}
                  {value !== "all" && (
                    <span className="opacity-50">
                      {value === "news"
                        ? counts.news
                        : value === "social"
                        ? counts.social
                        : counts.whale}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto flex gap-1">
                {SENTIMENT_TABS.filter((t) => t.value !== "all").map(
                  ({ label, value }) => (
                    <button
                      key={value}
                      onClick={() =>
                        setSentimentFilter(
                          sentimentFilter === value ? "all" : value
                        )
                      }
                      className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                        sentimentFilter === value
                          ? value === "bullish"
                            ? "bg-[#4CAF50]/15 text-[#4CAF50]"
                            : value === "bearish"
                            ? "bg-[#FF4D4D]/15 text-[#FF4D4D]"
                            : "bg-[rgba(255,255,255,0.06)] text-[#A0A0A0]"
                          : "text-[#3A3A3A] hover:text-[#6B6B6B]"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Feed */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && news.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : news.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-[#6B6B6B]">
                <Newspaper className="h-7 w-7 opacity-30" />
                <p className="text-sm">No items match your filters.</p>
              </div>
            ) : (
              feedItems
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="news-right-panel hidden min-h-0 flex-1 flex-col overflow-y-auto lg:flex">
          {/* Chart header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[rgba(242,183,5,0.08)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={chartSymbol}
                  onChange={(e) => setChartSymbol(e.target.value)}
                  className="appearance-none rounded-lg border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] py-0.5 pl-2 pr-5 text-[11px] font-semibold text-[#A0A0A0] outline-none transition hover:border-[rgba(242,183,5,0.25)]"
                >
                  {CHART_SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[#6B6B6B]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href="/screener"
                className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] transition hover:text-[#A0A0A0]"
              >
                <BarChart2 className="h-2.5 w-2.5" />
                Screener
              </Link>
              <Link
                href="/calendar"
                className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] transition hover:text-[#A0A0A0]"
              >
                <Calendar className="h-2.5 w-2.5" />
                Events
              </Link>
              <Link
                href={`/terminal?ticker=${chartSymbol.replace("USDT", "")}`}
                className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
              >
                <LayoutDashboard className="h-2.5 w-2.5" />
                Trade
              </Link>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[300px] shrink-0 overflow-hidden">
            <NewsMiniChart symbol={chartSymbol} />
          </div>

          {/* Trending Topics */}
          <TrendingTopics news={news} />

          {/* Selected item detail + market impact */}
          {selectedItem && (
            <>
              <div className="mx-3 mb-3 shrink-0 rounded-xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F2B705]/80">
                      {selectedItem.source}
                    </span>
                    <span className="text-[10px] text-[#6B6B6B]">
                      {timeAgo(selectedItem.timestamp)}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-[10px] text-[#6B6B6B] hover:text-[#A0A0A0]"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[12px] font-semibold leading-[1.5] text-[#FFFFFF]">
                  {selectedItem.headline}
                </p>
                {selectedItem.summary &&
                  selectedItem.summary !== selectedItem.headline && (
                    <p className="mt-1 line-clamp-3 text-[11px] leading-[1.6] text-[#6B6B6B]">
                      {selectedItem.summary}
                    </p>
                  )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedItem.ticker?.map((t) => (
                    <Link
                      key={t}
                      href={`/terminal?ticker=${t}`}
                      className="rounded border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.06)] px-2 py-0.5 text-[9px] font-bold text-[#F2B705] hover:bg-[rgba(242,183,5,0.14)]"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Market impact */}
              <MarketImpact item={selectedItem} quotes={quotes} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
