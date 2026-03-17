"use client";

import { memo, useMemo } from "react";
import { TickerQuote } from "@/lib/mock-data";

type Props = {
  quotes?: TickerQuote[];
};

const TICKER_ORDER = [
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP",
  "NEAR","INJ","DOT","APT","SUI","TIA","ATOM","AAVE","WIF","HYPE",
];

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(5);
}

/* Each item re-renders on price change but the animation wrapper does NOT */
const TickerItem = memo(function TickerItem({ q }: { q: TickerQuote & { changePct: number } }) {
  const up = q.changePct >= 0;
  return (
    <span className="inline-flex items-center gap-2 border-r border-white/6 px-4 text-xs last:border-r-0 shrink-0">
      <span className="text-[10px] font-bold tracking-[0.24em] text-zinc-500">{q.symbol}</span>
      <span className="text-zinc-50 tabular-nums">{fmtPrice(q.price)}</span>
      <span
        className={up
          ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-300"
          : "rounded-full border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-300"
        }
      >
        {up ? "+" : ""}{q.changePct.toFixed(2)}%
      </span>
    </span>
  );
});

/* The animated strip — only re-renders when symbol list changes, not prices */
const TickerStrip = memo(function TickerStrip({ items }: { items: Array<TickerQuote & { changePct: number }> }) {
  return (
    <div className="flex animate-ticker whitespace-nowrap">
      {items.map((q, i) => <TickerItem key={`${q.symbol}-${i}`} q={q} />)}
    </div>
  );
}, (prev, next) => {
  // Re-render strip only when prices/changes update — but the animation
  // CSS node is stable across renders so the animation does not reset
  if (prev.items.length !== next.items.length) return false;
  return prev.items.every((item, i) =>
    item.symbol === next.items[i].symbol &&
    item.price === next.items[i].price &&
    item.changePct === next.items[i].changePct
  );
});

export default function TickerTape({ quotes: wsQuotes }: Props) {
  const rawQuotes = wsQuotes ?? [];

  const quotes = useMemo(() =>
    [...rawQuotes]
      .filter((q) => q && typeof q.symbol === "string" && Number.isFinite(q.price))
      .map((q) => ({
        ...q,
        changePct: typeof q.changePct === "number" && Number.isFinite(q.changePct) ? q.changePct : 0,
      }))
      .sort((a, b) => TICKER_ORDER.indexOf(a.symbol) - TICKER_ORDER.indexOf(b.symbol)),
    [wsQuotes]
  );

  const items = useMemo(() => [...quotes, ...quotes], [quotes]);

  if (items.length === 0) return null;

  return (
    <div className="brand-aura overflow-hidden border-b border-white/6 bg-[linear-gradient(180deg,rgba(13,16,24,0.96),rgba(8,11,18,0.92))] h-9 flex items-center">
      <TickerStrip items={items} />
    </div>
  );
}
