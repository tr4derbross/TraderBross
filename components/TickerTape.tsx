"use client";

import { TickerQuote } from "@/lib/mock-data";

type Props = {
  quotes?: TickerQuote[]; // from WebSocket; falls back to REST if empty
};

// Preserve order across renders
const TICKER_ORDER = [
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP",
  "NEAR","INJ","DOT","APT","SUI","TIA","ATOM","AAVE","WIF","HYPE",
];

export default function TickerTape({ quotes: wsQuotes }: Props) {
  const rawQuotes = wsQuotes ?? [];

  // Sort by canonical ticker order
  const quotes = [...rawQuotes]
    .filter(
      (quote) =>
        quote &&
        typeof quote.symbol === "string" &&
        typeof quote.price === "number" &&
        Number.isFinite(quote.price)
    )
    .map((quote) => ({
      ...quote,
      change: typeof quote.change === "number" && Number.isFinite(quote.change) ? quote.change : 0,
      changePct:
        typeof quote.changePct === "number" && Number.isFinite(quote.changePct) ? quote.changePct : 0,
    }))
    .sort((a, b) => TICKER_ORDER.indexOf(a.symbol) - TICKER_ORDER.indexOf(b.symbol));

  if (quotes.length === 0) return null;

  const items = [...quotes, ...quotes]; // duplicate for seamless loop

  return (
    <div className="brand-aura overflow-hidden border-b border-white/6 bg-[linear-gradient(180deg,rgba(13,16,24,0.96),rgba(8,11,18,0.92))] h-9 flex items-center">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((q, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 border-r border-white/6 px-4 text-xs last:border-r-0"
          >
            <span className="text-[10px] font-bold tracking-[0.24em] text-zinc-500">
              {q.symbol}
            </span>
            <span className="text-zinc-50 tabular-nums">
              {q.price >= 1000
                ? q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : q.price >= 1
                ? q.price.toFixed(3)
                : q.price.toFixed(5)}
            </span>
            <span
              className={
                q.changePct >= 0
                  ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300"
                  : "rounded-full border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-red-300"
              }
            >
              {q.changePct >= 0 ? "+" : ""}
              {q.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
