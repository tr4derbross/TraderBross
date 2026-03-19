"use client";

import { useEffect, useState, memo } from "react";
import { apiFetch } from "@/lib/api-client";
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, BarChart2 } from "lucide-react";

type FundingRate = {
  symbol: string;
  fundingRate: string;
  nextFundingTime: number;
};

type OpenInterest = {
  symbol: string;
  openInterest: string;
  time: number;
};

type Mover = {
  symbol: string;
  price: number;
  changePct: number;
};

type SignalsProps = {
  quotes?: Array<{ symbol: string; price: number; changePct?: number }>;
  activeTicker?: string;
  onSelectTicker?: (ticker: string) => void;
};

const WATCH_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "ARB", "INJ"];

function fmt(n: number, decimals = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmt(n)}%`;
}

const FundingCard = memo(function FundingCard({
  symbol,
  rate,
  nextTime,
}: {
  symbol: string;
  rate: number;
  nextTime: number;
}) {
  const isPositive = rate >= 0;
  const minutesLeft = Math.max(0, Math.round((nextTime - Date.now()) / 60000));
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-zinc-300 w-10">{symbol}</span>
        <span className="text-[9px] text-zinc-600">{minutesLeft}m</span>
      </div>
      <span
        className={`text-[11px] font-mono font-semibold ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isPositive ? "+" : ""}{(rate * 100).toFixed(4)}%
      </span>
    </div>
  );
});

const MoverRow = memo(function MoverRow({
  item,
  onSelect,
}: {
  item: Mover;
  onSelect?: (ticker: string) => void;
}) {
  const up = item.changePct >= 0;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.symbol)}
      className="flex w-full items-center justify-between rounded-lg border border-transparent px-2.5 py-1.5 transition hover:border-zinc-800/60 hover:bg-zinc-900/40"
    >
      <span className="text-[11px] font-bold text-zinc-300">{item.symbol}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-zinc-400">
          ${item.price >= 1000
            ? item.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
            : item.price >= 1
            ? item.price.toFixed(2)
            : item.price.toFixed(4)}
        </span>
        <span
          className={`text-[10px] font-semibold w-14 text-right ${
            up ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {fmtPct(item.changePct)}
        </span>
        {up ? (
          <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />
        )}
      </div>
    </button>
  );
});

export default function SignalsPanel({ quotes = [], activeTicker, onSelectTicker }: SignalsProps) {
  const [funding, setFunding] = useState<FundingRate[]>([]);
  const [loadingFunding, setLoadingFunding] = useState(true);
  const [tab, setTab] = useState<"movers" | "funding">("movers");

  // Fetch funding rates from Binance via backend proxy
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<FundingRate[]>("/api/funding");
        if (!cancelled) setFunding(data);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoadingFunding(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Sort quotes into movers
  const movers = [...quotes]
    .filter((q) => Number.isFinite(q.changePct) && Number.isFinite(q.price))
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, 10) as Mover[];

  const gainers = movers.filter((m) => m.changePct >= 0).slice(0, 5);
  const losers = movers.filter((m) => m.changePct < 0).slice(0, 5);

  const topFunding = funding
    .filter((f) => WATCH_SYMBOLS.some((s) => f.symbol.startsWith(s)))
    .sort((a, b) => Math.abs(Number(b.fundingRate)) - Math.abs(Number(a.fundingRate)))
    .slice(0, 8);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-amber-300" />
          <span className="brand-section-title text-xs">Market Signals</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex shrink-0 border-b border-zinc-800/60">
        {(["movers", "funding"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] transition-colors ${
              tab === t
                ? "border-b-2 border-amber-300 text-amber-200"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t === "movers" ? "Movers" : "Funding"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tab === "movers" && (
          <div className="space-y-3">
            {gainers.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    Top Gainers
                  </span>
                </div>
                <div className="space-y-0.5">
                  {gainers.map((m) => (
                    <MoverRow key={m.symbol} item={m} onSelect={onSelectTicker} />
                  ))}
                </div>
              </div>
            )}
            {losers.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
                    Top Losers
                  </span>
                </div>
                <div className="space-y-0.5">
                  {losers.map((m) => (
                    <MoverRow key={m.symbol} item={m} onSelect={onSelectTicker} />
                  ))}
                </div>
              </div>
            )}
            {movers.length === 0 && (
              <div className="flex h-24 items-center justify-center text-[11px] text-zinc-600">
                Waiting for market data…
              </div>
            )}
          </div>
        )}

        {tab === "funding" && (
          <div className="space-y-1">
            <p className="mb-2 px-1 text-[9px] text-zinc-600 leading-relaxed">
              8h funding rates · positive = longs pay shorts
            </p>
            {loadingFunding ? (
              <div className="flex items-center justify-center py-6 text-[10px] text-zinc-600">
                Loading…
              </div>
            ) : topFunding.length > 0 ? (
              topFunding.map((f) => {
                const sym = f.symbol.replace("USDT", "").replace("PERP", "");
                return (
                  <FundingCard
                    key={f.symbol}
                    symbol={sym}
                    rate={Number(f.fundingRate)}
                    nextTime={f.nextFundingTime}
                  />
                );
              })
            ) : (
              <div className="flex items-center justify-center py-6 text-[10px] text-zinc-600">
                Funding data unavailable
              </div>
            )}

            {/* Legend */}
            <div className="mt-3 rounded-lg border border-zinc-800/40 bg-zinc-900/20 px-2.5 py-2 text-[9px] text-zinc-600 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
                Positive = longs pay (bearish pressure)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400/60" />
                Negative = shorts pay (bullish pressure)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
