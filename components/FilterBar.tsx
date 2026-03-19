"use client";

import { SECTORS, AVAILABLE_TICKERS } from "@/lib/mock-data";
import { SourceFilter, ImportanceFilter, SentimentFilter } from "@/hooks/useNews";
import { Search, X, Newspaper, Twitter, Waves, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";

type Props = {
  sector: string;
  ticker: string;
  keyword: string;
  sourceFilter: SourceFilter;
  importanceFilter: ImportanceFilter;
  sentimentFilter: SentimentFilter;
  onSector: (s: string) => void;
  onTicker: (t: string) => void;
  onKeyword: (k: string) => void;
  onSource: (s: SourceFilter) => void;
  onImportance: (i: ImportanceFilter) => void;
  onSentiment: (s: SentimentFilter) => void;
  counts: { news: number; whale: number; social: number; liquidation: number; all: number };
  /** Override label for the liquidation tab (e.g. "Liq $4.2M") */
  liqLabel?: string;
};

const IMPORTANCE_OPTIONS: { key: ImportanceFilter; label: string; style: string }[] = [
  { key: "all", label: "All", style: "text-zinc-400 border-transparent" },
  { key: "breaking", label: "🔴 Breaking", style: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  { key: "market-moving", label: "⚡ Mover", style: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  { key: "watch", label: "👁 Watch", style: "text-zinc-300 border-zinc-600/40 bg-zinc-700/20" },
  { key: "noise", label: "Noise", style: "text-zinc-600 border-transparent" },
];

const SENTIMENT_OPTIONS: { key: SentimentFilter; label: string; icon: React.ReactNode; style: string }[] = [
  { key: "all", label: "All", icon: null, style: "text-zinc-400" },
  { key: "bullish", label: "Bull", icon: <TrendingUp className="h-3 w-3" />, style: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { key: "bearish", label: "Bear", icon: <TrendingDown className="h-3 w-3" />, style: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
  { key: "neutral", label: "Neut", icon: <Minus className="h-3 w-3" />, style: "text-zinc-400 border-zinc-600/30 bg-zinc-700/20" },
];

const SOURCE_TABS: { key: SourceFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "all",         label: "All",      icon: null,                                   color: "text-amber-50"  },
  { key: "news",        label: "News",     icon: <Newspaper className="h-3 w-3" />,      color: "text-amber-100" },
  { key: "social",      label: "Social",   icon: <Twitter className="h-3 w-3" />,        color: "text-zinc-200"  },
  { key: "whale",       label: "Whales",   icon: <Waves className="h-3 w-3" />,          color: "text-amber-300" },
  { key: "liquidation", label: "Liqd.",    icon: <Zap className="h-3 w-3" />,            color: "text-rose-300"  },
];

export default function FilterBar({
  sector,
  ticker,
  keyword,
  sourceFilter,
  importanceFilter,
  sentimentFilter,
  onSector,
  onTicker,
  onKeyword,
  onSource,
  onImportance,
  onSentiment,
  counts,
  liqLabel,
}: Props) {
  return (
    <div className="flex flex-col border-b border-[rgba(212,161,31,0.1)] bg-[linear-gradient(180deg,rgba(20,17,13,0.96),rgba(11,10,10,0.94))]">

      {/* ── Source tabs ── */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-[rgba(212,161,31,0.08)] px-1.5 pb-0 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-2 sm:pt-1.5">
        {SOURCE_TABS.map(({ key, label, icon, color }) => {
          const count = key === "all" ? counts.all : (counts[key as keyof typeof counts] ?? 0);
          const active = sourceFilter === key;
          const displayLabel = key === "liquidation" && liqLabel ? liqLabel : label;

          return (
            <button
              key={key}
              onClick={() => onSource(key)}
              className={`flex shrink-0 items-center gap-0.5 border-b-2 px-1.5 py-1 text-[9px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[11px] ${
                active ? `border-[rgba(212,161,31,0.72)] ${color}` : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="hidden sm:inline">{icon}</span>
              {displayLabel}
              <span
                className={`rounded-full px-0.5 py-px text-[7px] sm:px-1.5 sm:py-0.5 sm:text-[9px] ${
                  active ? "bg-[rgba(212,161,31,0.12)] text-amber-50" : "bg-black/20 text-zinc-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + filters row (kompakt) ── */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 sm:gap-2 sm:px-3 sm:py-2">
        <div className="terminal-input flex min-w-0 flex-1 items-center gap-0.5 rounded px-1 py-px sm:rounded-lg sm:px-2 sm:py-1">
          <Search className="h-2 w-2 shrink-0 text-zinc-500 sm:h-3 sm:w-3" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[8px] text-amber-100 placeholder-zinc-600 outline-none sm:text-[11px]"
            placeholder="Ara..."
            value={keyword}
            onChange={(e) => onKeyword(e.target.value)}
          />
          {keyword && (
            <button onClick={() => onKeyword("")}>
              <X className="h-3 w-3 text-zinc-500 hover:text-red-400" />
            </button>
          )}
        </div>

        {(sourceFilter === "all" || sourceFilter === "news" || sourceFilter === "social") && (
          <>
            <select
              className="terminal-input shrink-0 cursor-pointer rounded px-1 py-px text-[8px] text-zinc-100 outline-none sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs"
              value={sector}
              onChange={(e) => onSector(e.target.value)}
            >
              {SECTORS.map((item) => (
                <option key={item} value={item} className="bg-zinc-900">
                  {item}
                </option>
              ))}
            </select>

            <select
              className="terminal-input hidden shrink-0 cursor-pointer rounded-lg px-1.5 py-1 text-[10px] text-zinc-100 outline-none sm:block sm:px-2 sm:text-xs"
              value={ticker}
              onChange={(e) => onTicker(e.target.value)}
            >
              <option value="" className="bg-zinc-900">All Tickers</option>
              {AVAILABLE_TICKERS.map((item) => (
                <option key={item} value={item} className="bg-zinc-900">{item}</option>
              ))}
            </select>
          </>
        )}

        {/* Active filter badges */}
        {sector !== "All" && (
          <span className="brand-badge cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] text-amber-100" onClick={() => onSector("All")}>
            {sector} ×
          </span>
        )}
        {ticker && (
          <span className="brand-badge brand-badge-gold cursor-pointer rounded-full px-1.5 py-0.5 text-[9px]" onClick={() => onTicker("")}>
            {ticker} ×
          </span>
        )}
      </div>

      {/* ── Impact + Sentiment — masaüstünde göster, mobilde gizle ── */}
      {sourceFilter !== "whale" && sourceFilter !== "liquidation" && (
        <div className="hidden items-center gap-2 overflow-x-auto border-t border-[rgba(212,161,31,0.07)] px-3 py-1.5 sm:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-zinc-600">Impact</span>
          <div className="flex shrink-0 gap-1">
            {IMPORTANCE_OPTIONS.map(({ key, label, style }) => (
              <button
                key={key}
                onClick={() => onImportance(key)}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium transition-all ${
                  importanceFilter === key ? `${style} opacity-100` : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mx-1 h-3 w-px shrink-0 bg-zinc-800" />
          <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-zinc-600">Sent.</span>
          <div className="flex shrink-0 gap-1">
            {SENTIMENT_OPTIONS.map(({ key, label, icon, style }) => (
              <button
                key={key}
                onClick={() => onSentiment(key)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium transition-all ${
                  sentimentFilter === key ? `${style} opacity-100` : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
