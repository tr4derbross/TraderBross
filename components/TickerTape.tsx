"use client";

import { useEffect, useLayoutEffect, useRef, useMemo } from "react";
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

const SPEED = 0.6; // px / frame @ 60fps

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

  /* Doubled list for seamless loop */
  const doubled = useMemo(() => [...quotes, ...quotes], [quotes]);

  const trackRef  = useRef<HTMLDivElement>(null);
  const xRef      = useRef(0);
  const rafRef    = useRef<number>(0);
  const pausedRef = useRef(false);
  const halfRef   = useRef(0); // cached half-width — only recalculated after layout

  /* ── Measure half-width after DOM paints (layout effect = sync) ─────────── */
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // Small delay to let browser finish layout
    const id = requestAnimationFrame(() => {
      halfRef.current = track.scrollWidth / 2;
    });
    return () => cancelAnimationFrame(id);
  }, [doubled]); // recalculate only when coin list changes

  /* ── RAF animation loop ─────────────────────────────────────────────────── */
  useEffect(() => {
    const step = () => {
      const track = trackRef.current;
      const half  = halfRef.current;
      if (track && half > 0 && !pausedRef.current) {
        xRef.current -= SPEED;
        if (xRef.current <= -half) xRef.current = 0;
        track.style.transform = `translate3d(${xRef.current}px,0,0)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // starts once, never restarts

  /* ── Update prices directly in DOM — no animation disruption ────────────── */
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
          changeEl.className = `tt-change tabular-nums text-[10px] font-semibold leading-none ${up ? "text-emerald-400" : "text-red-400"}`;
        }
      });
    });
  }, [quotes]);

  if (quotes.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden border-b border-white/[0.06] bg-[#09090b] h-8 flex items-center select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10 bg-gradient-to-r from-[#09090b] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10 bg-gradient-to-l from-[#09090b] to-transparent" />

      <div ref={trackRef} className="flex items-center" style={{ willChange: "transform" }}>
        {doubled.map((q, i) => {
          const up = q.changePct >= 0;
          return (
            <span
              key={`${q.symbol}-${i}`}
              data-sym={q.symbol}
              className="inline-flex items-center gap-2 px-4 shrink-0"
            >
              <span className="text-zinc-600 text-[8px] leading-none">•</span>
              <span className="text-[9px] font-extrabold tracking-[0.2em] text-zinc-500 uppercase leading-none">
                {q.symbol}
              </span>
              <span className="tt-price text-[11px] font-mono text-zinc-100 tabular-nums leading-none">
                {fmtPrice(q.price)}
              </span>
              <span className={`tt-change tabular-nums text-[10px] font-semibold leading-none ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? "+" : ""}{q.changePct.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
