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
}: Props) {
  return (
    <div className="flex flex-col border-b border-[rgba(212,161,31,0.1)] bg-[linear-gradient(180deg,rgba(20,17,13,0.96),rgba(11,10,10,0.94))]">
      <div className="flex items-center gap-0 border-b border-[rgba(212,161,31,0.08)] px-3 pb-0 pt-2">
        {SOURCE_TABS.map(({ key, label, icon, color }) => {
          const count = key === "all" ? counts.all : (counts[key as keyof typeof counts] ?? 0);
          const active = sourceFilter === key;

          return (
            <button
              key={key}
              onClick={() => onSource(key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-medium transition-colors ${
                active ? `border-[rgba(212,161,31,0.72)] ${color}` : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {icon}
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  active ? "bg-[rgba(212,161,31,0.12)] text-amber-50" : "bg-black/20 text-zinc-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="terminal-input flex items-center gap-1 rounded-lg px-2 py-1">
          <Search className="h-3 w-3 shrink-0 text-zinc-500" />
          <input
            className="w-28 bg-transparent text-xs text-amber-100 placeholder-zinc-600 outline-none"
            placeholder="Search..."
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
              className="terminal-input cursor-pointer rounded-lg px-2 py-1 text-xs text-zinc-100 outline-none"
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
              className="terminal-input cursor-pointer rounded-lg px-2 py-1 text-xs text-zinc-100 outline-none"
              value={ticker}
              onChange={(e) => onTicker(e.target.value)}
            >
              <option value="" className="bg-zinc-900">
                All Tickers
              </option>
              {AVAILABLE_TICKERS.map((item) => (
                <option key={item} value={item} className="bg-zinc-900">
                  {item}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="ml-auto flex flex-wrap gap-1.5">
          {sector !== "All" && (sourceFilter === "all" || sourceFilter === "news") && (
            <span
              className="brand-badge cursor-pointer rounded-full px-2 py-0.5 text-[10px] text-amber-100"
              onClick={() => onSector("All")}
            >
              {sector} ×
            </span>
          )}
          {ticker && (
            <span
              className="brand-badge brand-badge-gold cursor-pointer rounded-full px-2 py-0.5 text-[10px]"
              onClick={() => onTicker("")}
            >
              {ticker} ×
            </span>
          )}
        </div>
      </div>

      {/* Importance + Sentiment quick filters — hidden for special feeds */}
      {sourceFilter !== "whale" && sourceFilter !== "liquidation" && (
      <div className="flex items-center gap-2 overflow-x-auto border-t border-[rgba(212,161,31,0.07)] px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-zinc-600">Impact</span>
        <div className="flex shrink-0 gap-1">
          {IMPORTANCE_OPTIONS.map(({ key, label, style }) => (
            <button
              key={key}
              onClick={() => onImportance(key)}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium transition-all ${
                importanceFilter === key
                  ? `${style} opacity-100`
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
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
                sentimentFilter === key
                  ? `${style} opacity-100`
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
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
