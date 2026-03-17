"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import type { ScreenerCoin } from "@/app/api/screener/route";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Search,
  RefreshCw,
  ExternalLink,
  LayoutDashboard,
  Zap,
} from "lucide-react";

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPrice(p: number): string {
  if (p >= 10_000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

const SORT_TABS = [
  { key: "volume",  label: "Volume",  icon: BarChart2  },
  { key: "gainers", label: "Gainers", icon: TrendingUp  },
  { key: "losers",  label: "Losers",  icon: TrendingDown },
];

function getReferralUrl(symbol: string): string {
  const ref = process.env.NEXT_PUBLIC_BINANCE_REF;
  return ref
    ? `https://www.binance.com/en/trade/${symbol}_USDT?ref=${ref}`
    : `https://www.binance.com/en/trade/${symbol}_USDT`;
}

/* ── Mini sparkline bar ─────────────────────────────────────────────────────── */
function MiniRange({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high > low ? ((price - low) / (high - low)) * 100 : 50;
  return (
    <div className="relative h-1 w-16 rounded-full bg-[rgba(255,255,255,0.07)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-500/60 to-emerald-400/60"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <div
        className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full bg-white/60"
        style={{ left: `${Math.min(98, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────────────────────────── */
function CoinRow({ coin, rank }: { coin: ScreenerCoin; rank: number }) {
  const positive = coin.change24h >= 0;
  return (
    <tr className="group border-b border-[rgba(255,255,255,0.035)] transition-colors hover:bg-[rgba(212,161,31,0.03)]">
      <td className="py-2.5 pl-4 pr-2 text-[11px] text-zinc-700 tabular-nums">{rank}</td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(212,161,31,0.1)] text-[10px] font-bold text-amber-300">
            {coin.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#e8dfc8]">{coin.symbol}</div>
            <div className="text-[10px] text-zinc-600">/USDT</div>
          </div>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        <span className="text-[12px] font-medium text-[#e8dfc8]">{fmtPrice(coin.price)}</span>
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            positive
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {positive ? "+" : ""}{coin.change24h.toFixed(2)}%
        </span>
      </td>
      <td className="hidden py-2.5 pr-4 text-right tabular-nums sm:table-cell">
        <span className="text-[11px] text-zinc-400">${fmtVol(coin.volume24h)}</span>
      </td>
      <td className="hidden py-2.5 pr-4 md:table-cell">
        <MiniRange low={coin.low24h} high={coin.high24h} price={coin.price} />
        <div className="mt-0.5 flex justify-between text-[9px] text-zinc-700">
          <span>{fmtPrice(coin.low24h)}</span>
          <span>{fmtPrice(coin.high24h)}</span>
        </div>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/terminal?ticker=${coin.symbol}`}
            className="flex items-center gap-1 rounded-md border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-400 transition hover:bg-[rgba(212,161,31,0.16)]"
          >
            <LayoutDashboard className="h-2.5 w-2.5" />
            Terminal
          </Link>
          <a
            href={getReferralUrl(coin.symbol)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 transition hover:text-zinc-300"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Trade
          </a>
        </div>
      </td>
    </tr>
  );
}

/* ── Stats header ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = "amber" }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    amber:   "border-amber-400/15 bg-amber-400/5 text-amber-300",
    emerald: "border-emerald-400/15 bg-emerald-400/5 text-emerald-300",
    rose:    "border-rose-400/15 bg-rose-400/5 text-rose-300",
    sky:     "border-sky-400/15 bg-sky-400/5 text-sky-300",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colors[color]}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] opacity-60">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-bold">{value}</div>
      {sub && <div className="text-[10px] opacity-50">{sub}</div>}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ScreenerPage() {
  const [sort, setSort]     = useState<"volume" | "gainers" | "losers">("volume");
  const [search, setSearch] = useState("");
  const [coins, setCoins]   = useState<ScreenerCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screener?sort=${sort}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScreenerCoin[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("No data returned");
      setCoins(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[Screener] fetch failed:", err);
      setError("Could not load market data.");
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = coins.filter((c) =>
    search.length < 1 || c.symbol.toUpperCase().includes(search.toUpperCase())
  );

  const gainersCount = coins.filter((c) => c.change24h > 0).length;
  const losersCount  = coins.filter((c) => c.change24h < 0).length;
  const topGainer    = coins.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h)[0];
  const topLoser     = coins.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h)[0];
  const totalVol     = coins.reduce((s, c) => s + c.volume24h, 0);

  return (
    <div className="flex min-h-screen flex-col bg-[#07060a] text-[var(--text-primary)]">
      <SiteNav />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-amber-400" />
              <h1 className="text-[15px] font-bold tracking-[-0.01em] text-[#f0e8d3]">Market Screener</h1>
              <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${!loading ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-zinc-700/40 bg-zinc-800/40 text-zinc-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${!loading && coins.length > 0 ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`} />
                {loading ? "Loading" : `${coins.length} pairs`}
              </span>
            </div>
            {lastUpdate && (
              <p className="text-[11px] text-zinc-600">
                Updated {lastUpdate.toLocaleTimeString()} · Auto-refreshes every 30s
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 self-start rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[10px] text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="24h Volume" value={fmt(totalVol)} color="amber" />
          <StatCard label="Gainers" value={gainersCount.toString()} sub={topGainer ? `Top: ${topGainer.symbol} +${topGainer.change24h.toFixed(1)}%` : undefined} color="emerald" />
          <StatCard label="Losers"  value={losersCount.toString()}  sub={topLoser  ? `Top: ${topLoser.symbol} ${topLoser.change24h.toFixed(1)}%`   : undefined} color="rose"    />
          <StatCard label="Pairs"   value={coins.length.toString()} sub=">$500K vol" color="sky" />
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Sort tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-1">
            {SORT_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key as typeof sort)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${
                  sort === key
                    ? "bg-[rgba(212,161,31,0.16)] text-amber-200 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter symbol…"
              className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] py-1.5 pl-8 pr-3 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-[rgba(212,161,31,0.2)] sm:w-[180px]"
            />
          </div>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 py-10">
            <p className="text-sm text-rose-400">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[11px] font-bold text-rose-300 transition hover:bg-rose-500/20"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                  <th className="py-2.5 pl-4 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">#</th>
                  <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Coin</th>
                  <th className="py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Price</th>
                  <th className="py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">24h %</th>
                  <th className="hidden py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 sm:table-cell">Volume</th>
                  <th className="hidden py-2.5 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 md:table-cell">24h Range</th>
                  <th className="py-2.5 pr-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && coins.length === 0 ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className="border-b border-[rgba(255,255,255,0.03)]">
                      {[40, 80, 60, 50, 70, 100, 60].map((w, j) => (
                        <td key={j} className="py-3 pl-4">
                          <div className="skeleton-shimmer h-3 rounded" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-600">
                        <Search className="h-6 w-6 opacity-30" />
                        <p className="text-sm">No coins found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((coin, i) => (
                    <CoinRow key={coin.symbol} coin={coin} rank={i + 1} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] px-4 py-2">
              <span className="text-[10px] text-zinc-700">
                Showing {filtered.length} of {coins.length} pairs · Source: Binance
              </span>
              <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                <Zap className="h-2.5 w-2.5" />
                Auto-refresh 30s
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
