"use client";

import { useEffect, useRef, useMemo } from "react";
import { TickerQuote } from "@/lib/mock-data";

type Props = { quotes?: TickerQuote[] };

const TICKER_ORDER = [
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP",
  "NEAR","INJ","DOT","APT","SUI","TIA","ATOM","AAVE","WIF","HYPE",
];

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(3);
  return p.toFixed(5);
}

const SPEED = 0.45; // px / frame

export default function TickerTape({ quotes: wsQuotes }: Props) {
  const rawQuotes = wsQuotes ?? [];

  const quotes = useMemo(() =>
    [...rawQuotes]
      .filter(q => q && typeof q.symbol === "string" && Number.isFinite(q.price))
      .map(q => ({
        ...q,
        changePct: Number.isFinite(q.changePct) ? q.changePct : 0,
      }))
      .sort((a, b) => TICKER_ORDER.indexOf(a.symbol) - TICKER_ORDER.indexOf(b.symbol)),
    [wsQuotes],
  );

  const trackRef  = useRef<HTMLDivElement>(null);
  const xRef      = useRef(0);
  const rafRef    = useRef<number>(0);
  const pausedRef = useRef(false);

  /* ── RAF animation loop — runs once, survives price re-renders ─────────── */
  useEffect(() => {
    const step = () => {
      const track = trackRef.current;
      if (track && !pausedRef.current) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          xRef.current -= SPEED;
          if (Math.abs(xRef.current) >= half) xRef.current = 0;
          track.style.transform = `translateX(${xRef.current}px)`;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // intentionally empty — animation loop is permanent

  /* ── Update prices directly in DOM — zero animation disruption ─────────── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || quotes.length === 0) return;
    quotes.forEach(q => {
      track.querySelectorAll<HTMLElement>(`[data-sym="${q.symbol}"]`).forEach(item => {
        const priceEl  = item.querySelector<HTMLElement>(".tt-price");
        const changeEl = item.querySelector<HTMLElement>(".tt-change");
        if (priceEl)  priceEl.textContent = fmtPrice(q.price);
        if (changeEl) {
          const up = q.changePct >= 0;
          changeEl.textContent = `${up ? "+" : ""}${q.changePct.toFixed(2)}%`;
          changeEl.className = `tt-change tabular-nums text-[10px] font-semibold ${up ? "text-emerald-400" : "text-red-400"}`;
        }
      });
    });
  }, [quotes]);

  if (quotes.length === 0) return null;

  /* Doubled list for seamless loop — only rebuilt when coin list changes */
  const doubled = useMemo(() => [...quotes, ...quotes], [quotes]);

  return (
    <div
      className="relative overflow-hidden border-b border-white/[0.06] bg-[#09090b] h-8 flex items-center select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-10 z-10 bg-gradient-to-r from-[#09090b] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-10 z-10 bg-gradient-to-l from-[#09090b] to-transparent" />

      <div ref={trackRef} className="flex items-center will-change-transform">
        {doubled.map((q, i) => {
          const up = q.changePct >= 0;
          return (
            <span
              key={`${q.symbol}-${i}`}
              data-sym={q.symbol}
              className="inline-flex items-center gap-2 px-3.5 shrink-0"
            >
              {/* Dot separator */}
              {i !== 0 && (
                <span className="mr-1 text-zinc-700 text-[8px]">•</span>
              )}
              <span className="text-[9px] font-extrabold tracking-[0.22em] text-zinc-500 uppercase">
                {q.symbol}
              </span>
              <span className="tt-price text-[11px] font-mono text-zinc-100 tabular-nums">
                {fmtPrice(q.price)}
              </span>
              <span className={`tt-change tabular-nums text-[10px] font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? "+" : ""}{q.changePct.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
