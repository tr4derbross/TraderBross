"use client";

import { useState, useEffect } from "react";
import { AVAILABLE_TICKERS } from "@/lib/mock-data";
import type { TickerQuote } from "@/lib/mock-data";
import { Star, X, Plus, TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  quotes: TickerQuote[];
  prices: Record<string, number>;
  onSelectTicker: (ticker: string) => void;
  activeTicker: string;
};

const DEFAULT_WATCHLIST = ["BTC", "ETH", "SOL", "BNB", "XRP"];
const STORAGE_KEY = "tt_watchlist";

function fmt(n: number) {
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function WatchlistPanel({ quotes, prices, onSelectTicker, activeTicker }: Props) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [adding, setAdding] = useState(false);
  const [addTicker, setAddTicker] = useState("");

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setWatchlist(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const quoteMap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));

  const removeTicker = (t: string) => setWatchlist((prev) => prev.filter((x) => x !== t));

  const handleAdd = () => {
    const t = addTicker.toUpperCase().trim();
    if (t && AVAILABLE_TICKERS.includes(t) && !watchlist.includes(t)) {
      setWatchlist((prev) => [...prev, t]);
    }
    setAdding(false);
    setAddTicker("");
  };

  const available = AVAILABLE_TICKERS.filter((t) => !watchlist.includes(t));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Watchlist</span>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Add ticker dropdown */}
      {adding && (
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex gap-1">
            <select
              className="flex-1 bg-zinc-900 border border-zinc-700 text-xs text-white px-2 py-1 rounded outline-none"
              value={addTicker}
              onChange={(e) => setAddTicker(e.target.value)}
              autoFocus
            >
              <option value="">Select ticker...</option>
              {available.map((t) => (
                <option key={t} value={t}>{t}/USDT</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!addTicker}
              className="px-3 py-1 text-[10px] bg-amber-500 disabled:bg-zinc-700 text-black disabled:text-zinc-500 rounded font-bold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setAddTicker(""); }}
              className="px-2 py-1 text-[10px] bg-zinc-800 text-zinc-400 rounded hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Watchlist table */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 text-[9px] text-zinc-600 border-b border-zinc-800/40 sticky top-0 bg-zinc-950">
          <span>Symbol</span>
          <span className="text-right">Price</span>
          <span className="text-right pr-5">24h</span>
        </div>

        {watchlist.length === 0 ? (
          <div className="text-center text-zinc-600 text-xs py-8">
            No tickers. Click Add to start.
          </div>
        ) : (
          watchlist.map((ticker) => {
            const q = quoteMap[ticker];
            const price = q?.price ?? prices[ticker] ?? 0;
            const changePct = q?.changePct ?? 0;
            const isActive = ticker === activeTicker;
            const isUp = changePct >= 0;

            return (
              <div
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className={`group flex items-center px-3 py-2 cursor-pointer border-b border-zinc-800/30 transition-colors ${
                  isActive ? "bg-zinc-800/60" : "hover:bg-zinc-900/50"
                }`}
              >
                {/* Symbol + indicator */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isActive && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                    <span className={`text-xs font-bold ${isActive ? "text-amber-400" : "text-white"}`}>
                      {ticker}
                    </span>
                    <span className="text-[9px] text-zinc-600">USDT</span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right mr-3">
                  <span className={`text-xs font-mono ${isUp ? "text-green-400" : "text-red-400"}`}>
                    ${fmt(price)}
                  </span>
                </div>

                {/* 24h change */}
                <div className="flex items-center gap-0.5 w-14 justify-end">
                  {isUp
                    ? <TrendingUp className="w-2.5 h-2.5 text-green-400 shrink-0" />
                    : <TrendingDown className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                  <span className={`text-[10px] font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
                    {isUp ? "+" : ""}{changePct.toFixed(2)}%
                  </span>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-1.5 border-t border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex justify-between text-[9px] text-zinc-600">
          <span>{watchlist.length} symbols</span>
          <span>
            {watchlist.filter(t => (quoteMap[t]?.changePct ?? 0) >= 0).length} up ·{" "}
            {watchlist.filter(t => (quoteMap[t]?.changePct ?? 0) < 0).length} down
          </span>
        </div>
      </div>
    </div>
  );
}
