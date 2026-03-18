"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeSelector } from "@/lib/realtime-client";
import type { LiquidationEvent } from "@/lib/backend-types";
import { Zap } from "lucide-react";

import { formatCompact, timeAgo, formatPrice } from "@/lib/format-utils";

// ── Mock liquidation generator ────────────────────────────────────────────────

const LIQD_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "MATIC", "ARB", "OP", "LINK", "PEPE"];
const LIQD_EXCHANGES = ["Binance", "OKX", "Bybit", "Hyperliquid", "dYdX", "BitMEX"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PRICES: Record<string, number> = {
  BTC: 85_000, ETH: 3_200, SOL: 170, BNB: 580, XRP: 0.55,
  DOGE: 0.12, AVAX: 35, MATIC: 0.85, ARB: 1.1, OP: 1.8,
  LINK: 14, PEPE: 0.000012,
};

function generateMockLiquidation(id: string): LiquidationEvent {
  const symbol = randomFrom(LIQD_SYMBOLS);
  const price = PRICES[symbol] ?? 1;
  const side: "long" | "short" = Math.random() > 0.5 ? "long" : "short";
  // Liquidation sizes: $5K – $10M
  const usdValue = Math.random() * 9_995_000 + 5_000;
  const qty = usdValue / price;

  return {
    id,
    symbol,
    side,
    qty,
    price,
    usdValue,
    timestamp: new Date().toISOString(),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiquidationRow({ event, isNew }: { event: LiquidationEvent & { exchange?: string }; isNew: boolean }) {
  const isLong = event.side === "long";
  const isBig = event.usdValue >= 1_000_000;

  const rowBg = isLong
    ? "border-[rgba(14,203,129,0.18)] bg-[rgba(14,203,129,0.04)]"
    : "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]";

  const sideColor = isLong ? "#0ecb81" : "#f6465d";

  return (
    <div
      className={`flex items-center gap-3 border-b px-3 py-2 transition-all duration-150 ${rowBg} ${isNew ? "animate-pulse-once" : ""}`}
    >
      {/* Icon */}
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: isLong ? "rgba(14,203,129,0.14)" : "rgba(246,70,93,0.14)" }}
      >
        <Zap className="h-3 w-3" style={{ color: sideColor }} />
      </div>

      {/* Symbol + Side */}
      <div className="min-w-[64px] shrink-0">
        <div
          className="text-[12px] font-bold"
          style={{ color: "#f3ead7", fontFamily: "IBM Plex Mono, monospace" }}
        >
          {event.symbol}
          <span className="ml-0.5 text-[10px] text-zinc-500">PERP</span>
        </div>
        <div
          className="text-[9px] font-bold uppercase tracking-wide"
          style={{ color: sideColor, fontFamily: "IBM Plex Sans, sans-serif" }}
        >
          {event.side} liqd.
        </div>
      </div>

      {/* USD Value */}
      <div className="flex-1">
        <div
          className="text-[13px] font-bold tabular-nums"
          style={{ color: sideColor, fontFamily: "IBM Plex Mono, monospace" }}
        >
          {formatCompact(event.usdValue)}
          {isBig && (
            <span
              className="ml-1.5 rounded px-1 py-0.5 text-[8px] font-bold"
              style={{ background: isLong ? "rgba(14,203,129,0.16)" : "rgba(246,70,93,0.16)", color: sideColor }}
            >
              BIG
            </span>
          )}
        </div>
        <div
          className="text-[9px] text-zinc-600"
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          @ ${formatPrice(event.price)}
        </div>
      </div>

      {/* Exchange + time */}
      <div className="shrink-0 text-right">
        <div
          className="text-[9px] font-semibold text-zinc-400"
          style={{ fontFamily: "IBM Plex Sans, sans-serif" }}
        >
          {event.exchange ?? randomFrom(LIQD_EXCHANGES)}
        </div>
        <div
          className="text-[9px] text-zinc-600 tabular-nums"
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          {timeAgo(event.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ── Aggregated totals bar ─────────────────────────────────────────────────────

function LiquidationSummary({ events }: { events: LiquidationEvent[] }) {
  const longTotal = events.filter((e) => e.side === "long").reduce((s, e) => s + e.usdValue, 0);
  const shortTotal = events.filter((e) => e.side === "short").reduce((s, e) => s + e.usdValue, 0);

  return (
    <div
      className="flex items-center gap-4 border-b px-3 py-2"
      style={{ borderColor: "rgba(39,39,42,0.72)", background: "rgba(12,11,10,0.98)" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[9px] text-zinc-500" style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
          Long liqd.
        </span>
        <span
          className="text-[10px] font-bold tabular-nums text-emerald-400"
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          {formatCompact(longTotal)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span className="text-[9px] text-zinc-500" style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
          Short liqd.
        </span>
        <span
          className="text-[10px] font-bold tabular-nums text-rose-400"
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          {formatCompact(shortTotal)}
        </span>
      </div>
      <div className="ml-auto">
        <span className="text-[9px] text-zinc-600" style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
          Last {events.length} events
        </span>
      </div>
    </div>
  );
}

// ── Main LiquidationFeed Component ───────────────────────────────────────────

export default function LiquidationFeed({ onPulse }: { onPulse?: () => void }) {
  const realtimeLiquidations = useRealtimeSelector((state) => state.liquidations ?? []);
  const [feed, setFeed] = useState<LiquidationEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const counterRef = useRef(0);

  // Seed with realtime or mock
  useEffect(() => {
    if (realtimeLiquidations.length > 0) {
      setFeed(realtimeLiquidations.slice(0, 40));
    } else {
      const initial = Array.from({ length: 12 }, (_, i) => {
        const ev = generateMockLiquidation(`liqd-init-${i}`);
        ev.timestamp = new Date(Date.now() - i * 12_000).toISOString();
        return ev;
      });
      setFeed(initial);
    }
  }, []);

  // Sync with realtime when it arrives
  useEffect(() => {
    if (realtimeLiquidations.length > 0) {
      setFeed(realtimeLiquidations.slice(0, 40));
    }
  }, [realtimeLiquidations]);

  // Simulate new liquidation every 5s when no live data
  useEffect(() => {
    if (realtimeLiquidations.length > 0) return;

    const interval = setInterval(() => {
      const id = `liqd-sim-${counterRef.current++}-${Date.now()}`;
      const newLiqd = generateMockLiquidation(id);

      setFeed((prev) => [newLiqd, ...prev].slice(0, 40));
      setNewIds((prev) => new Set([...prev, id]));
      onPulse?.();

      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);
    }, 5000);

    return () => clearInterval(interval);
  }, [realtimeLiquidations.length, onPulse]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LiquidationSummary events={feed} />
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(246,70,93,0.2) transparent" }}
      >
        {feed.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-zinc-600">
            Waiting for liquidation data…
          </div>
        ) : (
          feed.map((event) => (
            <LiquidationRow
              key={event.id}
              event={event}
              isNew={newIds.has(event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
