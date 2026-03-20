"use client";

import { useState, useEffect, useMemo } from "react";
import { AVAILABLE_TICKERS } from "@/lib/mock-data";
import type { TickerQuote } from "@/lib/mock-data";
import { canonicalSymbol, symbolAliases } from "@/lib/symbol-map";
import { apiFetch } from "@/lib/api-client";
import { Star, X, Plus, TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  quotes: TickerQuote[];
  prices: Record<string, number>;
  onSelectTicker: (ticker: string) => void;
  activeTicker: string;
  venueId?: string;
  availableTickers?: string[];
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

export default function WatchlistPanel({
  quotes,
  prices,
  onSelectTicker,
  activeTicker,
  venueId = "binance",
  availableTickers = [],
}: Props) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [adding, setAdding] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [statusText, setStatusText] = useState<string>("");
  const [backendSymbols, setBackendSymbols] = useState<string[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Array<string | { symbol?: string }>>(`/api/venues/symbols?venue=${encodeURIComponent(venueId)}`)
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setBackendSymbols(
          rows
            .map((row) => canonicalSymbol(typeof row === "string" ? row : row.symbol || ""))
            .filter(Boolean),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const quoteMap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
  const supportedUniverse = useMemo(
    () =>
      Array.from(
        new Set(
          [...AVAILABLE_TICKERS, ...availableTickers, ...backendSymbols, ...quotes.map((q) => q.symbol)]
            .map((value) => canonicalSymbol(value))
            .filter(Boolean),
        ),
      ),
    [availableTickers, backendSymbols, quotes],
  );
  const supportSet = useMemo(() => new Set(supportedUniverse), [supportedUniverse]);

  const removeTicker = (t: string) => setWatchlist((prev) => prev.filter((x) => x !== t));

  const handleAdd = (inputValue?: string) => {
    const raw = (inputValue ?? addTicker).trim();
    const normalized = canonicalSymbol(raw);

    if (!normalized) {
      setStatusText("Please enter a ticker.");
      return;
    }

    if (!supportSet.has(normalized)) {
      setStatusText(`${raw.toUpperCase()} is not supported yet on this terminal.`);
      return;
    }

    if (watchlist.includes(normalized)) {
      setStatusText(`${normalized} is already in watchlist.`);
      return;
    }

    setWatchlist((prev) => [...prev, normalized].slice(0, 30));
    onSelectTicker(normalized);
    setStatusText(
      normalized === raw.toUpperCase()
        ? `${normalized} added.`
        : `${raw.toUpperCase()} mapped to ${normalized} and added.`,
    );
    setAdding(false);
    setAddTicker("");
  };

  const available = supportedUniverse.filter((t) => !watchlist.includes(t));
  const normalizedInput = canonicalSymbol(addTicker);
  const inputAliases = normalizedInput ? symbolAliases(normalizedInput) : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-amber-400" />
          <span className="brand-section-title text-xs font-bold tracking-wider uppercase">Watchlist</span>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="brand-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition hover:border-[rgba(212,161,31,0.24)] hover:text-amber-100"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* Add ticker dropdown */}
      {adding && (
        <div className="border-b border-[rgba(212,161,31,0.08)] bg-[rgba(18,16,13,0.72)] px-3 py-2.5">
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                className="terminal-input min-h-[34px] flex-1 rounded-lg px-2.5 py-1 text-xs text-white outline-none placeholder:text-zinc-600"
                value={addTicker}
                onChange={(e) => {
                  setAddTicker(e.target.value);
                  if (statusText) setStatusText("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAdd();
                  }
                }}
                autoFocus
                placeholder="Type ticker or alias (BTC, XBT, WBTC)"
              />
              <button
                onClick={() => handleAdd()}
                disabled={!addTicker.trim()}
                className="brand-chip-active rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setAddTicker(""); setStatusText(""); }}
                className="terminal-chip rounded-lg px-2 py-1.5 text-[10px] text-zinc-400 transition-colors hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {available.slice(0, 8).map((t) => (
                <button
                  key={t}
                  onClick={() => handleAdd(t)}
                  className="terminal-chip rounded-full px-2 py-0.5 text-[9px] text-zinc-300 hover:text-white"
                >
                  {t}
                </button>
              ))}
            </div>

            {inputAliases.length > 1 && (
              <div className="text-[9px] text-zinc-500">
                Alias map: {inputAliases.join(" / ")}
              </div>
            )}

            {statusText && (
              <div className="text-[10px] text-amber-200">{statusText}</div>
            )}
          </div>
        </div>
      )}

      {/* Watchlist table */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="sticky top-0 grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[rgba(212,161,31,0.08)] bg-[rgba(10,10,10,0.96)] px-3 py-1.5 text-[9px] text-zinc-600 backdrop-blur">
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
                className={`group flex cursor-pointer items-center border-b border-[rgba(212,161,31,0.06)] px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(212,161,31,0.08)] shadow-[inset_2px_0_0_rgba(212,161,31,0.7)]"
                    : "hover:bg-[rgba(212,161,31,0.04)]"
                }`}
              >
                {/* Symbol + indicator */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    <span className={`text-xs font-bold tracking-[0.06em] ${isActive ? "text-amber-300" : "text-white"}`}>
                      {ticker}
                    </span>
                    <span className="text-[9px] text-zinc-600">USDT</span>
                  </div>
                </div>

                {/* Price */}
                <div className="mr-3 text-right">
                  <span className={`text-xs font-mono ${isUp ? "text-green-400" : "text-red-400"}`}>
                    ${fmt(price)}
                  </span>
                </div>

                {/* 24h change */}
                <div className="flex w-14 items-center justify-end gap-0.5">
                  {isUp
                    ? <TrendingUp className="h-2.5 w-2.5 shrink-0 text-green-400" />
                    : <TrendingDown className="h-2.5 w-2.5 shrink-0 text-red-400" />}
                  <span className={`text-[10px] font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
                    {isUp ? "+" : ""}{changePct.toFixed(2)}%
                  </span>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }}
                  className="ml-1 rounded-full p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/[0.04] hover:text-red-400 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="panel-header soft-divider shrink-0 border-t px-3 py-2">
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
