"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { TickerQuote } from "@/lib/mock-data";

type Props = { quotes?: TickerQuote[] };
type Q = TickerQuote & { changePct: number };

const TICKER_ORDER = [
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP",
  "NEAR","INJ","DOT","APT","SUI","TIA","ATOM","AAVE","WIF","HYPE",
];

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(3);
  return p.toFixed(5);
}

export default function TickerTape({ quotes: wsQuotes }: Props) {
  const rawQuotes = wsQuotes ?? [];

  /* All normalized quotes — new reference on every WS tick */
  const quotes: Q[] = useMemo(() =>
    [...rawQuotes]
      .filter(q => q && typeof q.symbol === "string" && Number.isFinite(q.price))
      .map(q => ({ ...q, changePct: Number.isFinite(q.changePct) ? q.changePct : 0 }))
      .sort((a, b) => TICKER_ORDER.indexOf(a.symbol) - TICKER_ORDER.indexOf(b.symbol)),
    [wsQuotes],
  );

  /*
   * stableQuotes — only updates when the SYMBOL LIST changes (not prices).
   * This prevents React from re-rendering the track DOM on every price tick,
   * keeping the CSS marquee animation uninterrupted.
   */
  const [stableQuotes, setStableQuotes] = useState<Q[]>([]);
  const lastSymKeyRef = useRef("");

  useEffect(() => {
    if (quotes.length === 0) return;
    const key = quotes.map(q => q.symbol).join(",");
    if (key !== lastSymKeyRef.current) {
      lastSymKeyRef.current = key;
      setStableQuotes(quotes);
    }
  }, [quotes]);

  /* Direct DOM price updates — zero re-render, zero animation disruption */
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || quotes.length === 0) return;
    quotes.forEach(q => {
      track.querySelectorAll<HTMLElement>(`[data-sym="${q.symbol}"]`).forEach(item => {
        const priceEl  = item.querySelector<HTMLElement>(".tt-p");
        const changeEl = item.querySelector<HTMLElement>(".tt-c");
        if (priceEl)  priceEl.textContent = fmtPrice(q.price);
        if (changeEl) {
          const up = q.changePct >= 0;
          changeEl.textContent = `${up ? "+" : ""}${q.changePct.toFixed(2)}%`;
          changeEl.className   = `tt-c text-[10px] font-semibold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`;
        }
      });
    });
  }, [quotes]);

  /* Doubled list — rebuilt only when symbol list changes */
  const doubled = useMemo(() => [...stableQuotes, ...stableQuotes], [stableQuotes]);

  if (stableQuotes.length === 0) return null;

  return (
    <div
      className="ticker-wrap"
      onMouseEnter={e => (e.currentTarget.querySelector<HTMLElement>(".ticker-track")!.style.animationPlayState = "paused")}
      onMouseLeave={e => (e.currentTarget.querySelector<HTMLElement>(".ticker-track")!.style.animationPlayState = "running")}
    >
      <div className="ticker-fade-l" />
      <div className="ticker-fade-r" />

      <div ref={trackRef} className="ticker-track">
        {doubled.map((q, i) => (
          <span key={`${q.symbol}-${i}`} data-sym={q.symbol} className="ticker-item">
            <span className="ticker-dot">•</span>
            <span className="ticker-sym">{q.symbol}</span>
            <span className="tt-p ticker-price">{fmtPrice(q.price)}</span>
            <span className={`tt-c text-[10px] font-semibold tabular-nums ${q.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
