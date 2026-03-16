"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Twitter,
  Waves,
  Newspaper,
  LayoutDashboard,
  ChevronRight,
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
  return `${Math.floor(diff / 86400)}d ago`;
}

function sentimentColor(s?: string) {
  if (s === "bullish")  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400";
  if (s === "bearish")  return "border-rose-500/25 bg-rose-500/10 text-rose-400";
  return "border-zinc-600/25 bg-zinc-600/10 text-zinc-400";
}

function SentimentIcon({ s }: { s?: string }) {
  if (s === "bullish") return <TrendingUp  className="h-3 w-3" />;
  if (s === "bearish") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function TypeIcon({ type }: { type?: string }) {
  if (type === "social") return <Twitter className="h-3 w-3 text-sky-400" />;
  if (type === "whale")  return <Waves   className="h-3 w-3 text-violet-400" />;
  return <Newspaper className="h-3 w-3 text-amber-400" />;
}

function typeBadge(type?: string) {
  if (type === "social") return "border-sky-500/20 bg-sky-500/8 text-sky-400";
  if (type === "whale")  return "border-violet-500/20 bg-violet-500/8 text-violet-400";
  return "border-amber-500/20 bg-amber-500/8 text-amber-300";
}

function typeLabel(type?: string) {
  if (type === "social") return "Social";
  if (type === "whale")  return "Whale";
  return "News";
}

/* ── News card ─────────────────────────────────────────────────────────────── */

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="group rounded-2xl border border-[rgba(212,161,31,0.08)] bg-[rgba(255,255,255,0.02)] p-4 transition-all hover:border-[rgba(212,161,31,0.18)] hover:bg-[rgba(255,255,255,0.04)]">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {/* Type badge */}
        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${typeBadge(item.type)}`}>
          <TypeIcon type={item.type} />
          {typeLabel(item.type)}
        </span>

        {/* Sentiment */}
        {item.sentiment && (
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${sentimentColor(item.sentiment)}`}>
            <SentimentIcon s={item.sentiment} />
            {item.sentiment}
          </span>
        )}

        {/* Tickers */}
        {item.ticker?.slice(0, 4).map((t) => (
          <span key={t} className="rounded-full border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.07)] px-2 py-0.5 text-[9px] font-bold text-amber-300">
            {t}
          </span>
        ))}

        {/* Time */}
        <span className="ml-auto text-[10px] text-zinc-600">
          {timeAgo(item.timestamp)}
        </span>
      </div>

      {/* Headline */}
      <p className="text-[0.88rem] font-semibold leading-[1.55] text-[#f0e8d3]">
        {item.headline}
      </p>

      {/* Summary */}
      {item.summary && item.summary !== item.headline && (
        <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-[1.6] text-zinc-500">
          {item.summary}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600">{item.source}</span>
          {item.authorHandle && (
            <span className="text-[10px] text-zinc-600">@{item.authorHandle}</span>
          )}
          {item.whaleAmountUsd && item.whaleAmountUsd > 0 && (
            <span className="rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 text-[9px] font-bold text-violet-400">
              ${(item.whaleAmountUsd / 1_000_000).toFixed(1)}M
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/terminal?ticker=${item.ticker?.[0] ?? "BTC"}`}
            className="flex items-center gap-1 rounded-full border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.06)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-[rgba(212,161,31,0.12)]"
          >
            <LayoutDashboard className="h-2.5 w-2.5" />
            Trade
          </Link>
          {item.url && item.url !== "#" && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Filter pill ───────────────────────────────────────────────────────────── */

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${
        active
          ? "bg-[rgba(212,161,31,0.18)] text-amber-200"
          : "border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

const SOURCE_TABS: { label: string; value: SourceFilter }[] = [
  { label: "All",    value: "all" },
  { label: "News",   value: "news" },
  { label: "Social", value: "social" },
  { label: "Whales", value: "whale" },
];

const SENTIMENT_TABS: { label: string; value: SentimentFilter }[] = [
  { label: "All",     value: "all" },
  { label: "Bullish", value: "bullish" },
  { label: "Bearish", value: "bearish" },
  { label: "Neutral", value: "neutral" },
];

export default function NewsPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [search, setSearch] = useState("");

  const { news, loading, liveCount, isLive, refreshNews, counts } = useNews({
    sourceFilter,
    sentimentFilter,
    keyword: search.length >= 2 ? search : undefined,
  });

  return (
    <div className="min-h-screen bg-[#07060a] text-[var(--text-primary)]">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="hero-orb hero-orb-1" style={{ opacity: 0.3 }} />
        <div className="hero-orb hero-orb-2" style={{ opacity: 0.2 }} />
      </div>

      <SiteNav />

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-400">
                TraderBross
              </div>
              {isLive && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
              {liveCount > 0 && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                  +{liveCount} new
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#f8f3e5] sm:text-3xl">
              Crypto News Feed
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshNews}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/terminal"
              className="flex items-center gap-1.5 rounded-full bg-[rgba(212,161,31,0.9)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c0a04] shadow-[0_0_16px_rgba(212,161,31,0.3)] transition-all hover:bg-[rgba(212,161,31,1)]"
            >
              <LayoutDashboard className="h-3 w-3" />
              Terminal
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search headlines, symbols, sources…"
              className="w-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] py-2.5 pl-9 pr-4 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-[rgba(212,161,31,0.25)]"
            />
          </div>

          {/* Source + sentiment row */}
          <div className="flex flex-wrap gap-2">
            {SOURCE_TABS.map(({ label, value }) => (
              <FilterPill
                key={value}
                active={sourceFilter === value}
                onClick={() => setSourceFilter(value)}
              >
                {label}
                {value !== "all" && (
                  <span className="ml-1.5 opacity-60">
                    {value === "news" ? counts.news : value === "social" ? counts.social : counts.whale}
                  </span>
                )}
              </FilterPill>
            ))}

            <div className="my-0.5 w-px bg-[rgba(255,255,255,0.06)]" />

            {SENTIMENT_TABS.map(({ label, value }) => (
              <FilterPill
                key={value}
                active={sentimentFilter === value}
                onClick={() => setSentimentFilter(value)}
              >
                {label}
              </FilterPill>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="mb-4 text-[10px] text-zinc-600">
          {loading ? "Loading…" : `${news.length} items`}
        </div>

        {/* News list */}
        {loading && news.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-28 rounded-2xl" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
            <Newspaper className="h-8 w-8 opacity-30" />
            <p className="text-sm">No items match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
