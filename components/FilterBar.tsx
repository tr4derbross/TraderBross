"use client";

import { SECTORS, AVAILABLE_TICKERS } from "@/lib/mock-data";
import { SourceFilter } from "@/hooks/useNews";
import { Search, X, Newspaper, Twitter, Waves } from "lucide-react";

type Props = {
  sector: string;
  ticker: string;
  keyword: string;
  sourceFilter: SourceFilter;
  onSector: (s: string) => void;
  onTicker: (t: string) => void;
  onKeyword: (k: string) => void;
  onSource: (s: SourceFilter) => void;
  counts: { news: number; whale: number; social: number; all: number };
};

const SOURCE_TABS: { key: SourceFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "all", label: "All", icon: null, color: "text-amber-50" },
  { key: "news", label: "News", icon: <Newspaper className="h-3 w-3" />, color: "text-amber-100" },
  { key: "social", label: "Social", icon: <Twitter className="h-3 w-3" />, color: "text-zinc-200" },
  { key: "whale", label: "Whales", icon: <Waves className="h-3 w-3" />, color: "text-zinc-200" },
];

export default function FilterBar({
  sector,
  ticker,
  keyword,
  sourceFilter,
  onSector,
  onTicker,
  onKeyword,
  onSource,
  counts,
}: Props) {
  return (
    <div className="flex flex-col border-b border-[rgba(212,161,31,0.1)] bg-[linear-gradient(180deg,rgba(20,17,13,0.96),rgba(11,10,10,0.94))]">
      <div className="flex items-center gap-0 border-b border-[rgba(212,161,31,0.08)] px-3 pb-0 pt-2">
        {SOURCE_TABS.map(({ key, label, icon, color }) => {
          const count = key === "all" ? counts.all : counts[key as keyof typeof counts];
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

        {(sourceFilter === "all" || sourceFilter === "news") && (
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
    </div>
  );
}
