"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeSelector } from "@/lib/realtime-client";
import type { NewsItem } from "@/lib/mock-data";

import { formatCompact, timeAgo } from "@/lib/format-utils";

// ── Simulated mock whale generator ───────────────────────────────────────────

const WHALE_TOKENS = ["BTC", "ETH", "USDT", "SOL", "BNB", "XRP", "USDC"];
const EXCHANGES = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "KuCoin"];
const WALLET_LABELS = ["Unknown Wallet", "Whale 0x...a4f2", "Whale 0x...3c9e", "Cold Storage", "DeFi Vault", "Foundation Wallet"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockWhale(id: string): NewsItem {
  const token = randomFrom(WHALE_TOKENS);
  const isStable = token === "USDT" || token === "USDC";

  // USD value range: $500K – $5B
  const usdValue = isStable
    ? Math.random() * 900_000_000 + 100_000_000
    : Math.random() * 4_500_000_000 + 500_000;

  const toExchange = Math.random() > 0.55;
  const fromExchange = !toExchange && Math.random() > 0.7;

  const from = fromExchange ? randomFrom(EXCHANGES) : randomFrom(WALLET_LABELS);
  const to = toExchange ? randomFrom(EXCHANGES) : randomFrom(WALLET_LABELS);

  const tokenAmount =
    token === "BTC"
      ? usdValue / 85_000
      : token === "ETH"
        ? usdValue / 3_200
        : token === "SOL"
          ? usdValue / 170
          : token === "BNB"
            ? usdValue / 580
            : usdValue; // stables

  const sentiment: "bullish" | "bearish" | "neutral" =
    toExchange ? "bearish" : fromExchange ? "bullish" : "neutral";

  return {
    id,
    headline: `🐋 ${tokenAmount >= 1 ? tokenAmount.toFixed(2) : tokenAmount.toFixed(4)} ${token} (${formatCompact(usdValue)}) moved${fromExchange ? ` from ${from}` : ``} to ${to}`,
    summary: "",
    source: "Whale Alert",
    type: "whale",
    ticker: [token],
    sector: "DeFi",
    timestamp: new Date(),
    url: "#",
    sentiment,
    whaleAmountUsd: usdValue,
    whaleToken: token,
    whaleFrom: from,
    whaleTo: to,
    whaleBlockchain: token === "BTC" ? "bitcoin" : "ethereum",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WhaleRow({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const usd = item.whaleAmountUsd ?? 0;
  const token = item.whaleToken ?? "?";
  const from = item.whaleFrom ?? "Unknown";
  const to = item.whaleTo ?? "Unknown";
  const isExchangeInflow = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "KuCoin"].some((e) =>
    to.toLowerCase().includes(e.toLowerCase()),
  );
  const isExchangeOutflow = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "KuCoin"].some((e) =>
    from.toLowerCase().includes(e.toLowerCase()),
  );

  const rowColor = isExchangeInflow
    ? "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]"
    : isExchangeOutflow
      ? "border-[rgba(14,203,129,0.18)] bg-[rgba(14,203,129,0.03)]"
      : "border-[rgba(245,160,30,0.14)] bg-[rgba(245,160,30,0.03)]";

  const amountColor = isExchangeInflow ? "#f6465d" : isExchangeOutflow ? "#0ecb81" : "#f5a01e";

  return (
    <div
      className={`flex items-start gap-2.5 border-b px-3 py-2.5 transition-all duration-150 ${rowColor} ${isNew ? "animate-pulse-once" : ""}`}
    >
      {/* Icon */}
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base"
        style={{
          background: isExchangeInflow
            ? "rgba(246,70,93,0.12)"
            : isExchangeOutflow
              ? "rgba(14,203,129,0.12)"
              : "rgba(245,160,30,0.12)",
        }}
      >
        🐋
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Token + amount */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              color: "#f0b90b",
              background: "rgba(240,185,11,0.12)",
              border: "1px solid rgba(240,185,11,0.24)",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {token}
          </span>
          <span
            className="text-[12px] font-bold tabular-nums"
            style={{ color: amountColor, fontFamily: "IBM Plex Mono, monospace" }}
          >
            {formatCompact(usd)}
          </span>
          {isExchangeInflow && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "#f6465d", background: "rgba(246,70,93,0.1)", border: "1px solid rgba(246,70,93,0.2)" }}
            >
              Exchange Inflow
            </span>
          )}
          {isExchangeOutflow && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "#0ecb81", background: "rgba(14,203,129,0.1)", border: "1px solid rgba(14,203,129,0.2)" }}
            >
              Exchange Outflow
            </span>
          )}
        </div>

        {/* Route: from → to */}
        <div
          className="mt-1 flex items-center gap-1 text-[10px]"
          style={{ fontFamily: "IBM Plex Sans, sans-serif" }}
        >
          <span className="truncate max-w-[100px] text-zinc-400">{from}</span>
          <span className="shrink-0 text-zinc-600">→</span>
          <span className="truncate max-w-[100px] text-zinc-300">{to}</span>
        </div>
      </div>

      {/* Timestamp */}
      <span
        className="shrink-0 text-[9px] text-zinc-600 tabular-nums mt-0.5"
        style={{ fontFamily: "IBM Plex Mono, monospace" }}
      >
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

// ── Main WhaleFeed Component ──────────────────────────────────────────────────

export default function WhaleFeed({ onPulse }: { onPulse?: () => void }) {
  const realtimeWhales = useRealtimeSelector((state) => state.whales);
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const counterRef = useRef(0);

  // Seed with realtime data or mock on mount
  useEffect(() => {
    if (realtimeWhales.length > 0) {
      setFeed(realtimeWhales.slice(0, 30));
    } else {
      // Initial 8 mock entries
      const initial = Array.from({ length: 8 }, (_, i) =>
        generateMockWhale(`whale-init-${i}-${Date.now()}`),
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setFeed(initial);
    }
  }, []);

  // Sync with realtime when it arrives
  useEffect(() => {
    if (realtimeWhales.length > 0) {
      setFeed(realtimeWhales.slice(0, 30));
    }
  }, [realtimeWhales]);

  // Simulate new whale every 8s when no live data
  useEffect(() => {
    if (realtimeWhales.length > 0) return; // Live data takes over

    const interval = setInterval(() => {
      const id = `whale-sim-${counterRef.current++}-${Date.now()}`;
      const newWhale = generateMockWhale(id);

      setFeed((prev) => [newWhale, ...prev].slice(0, 30));
      setNewIds((prev) => new Set([...prev, id]));
      onPulse?.();

      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 4000);
    }, 8000);

    return () => clearInterval(interval);
  }, [realtimeWhales.length, onPulse]);

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.2) transparent" }}
    >
      {feed.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-zinc-600">
          Waiting for whale data…
        </div>
      ) : (
        feed.map((item) => (
          <WhaleRow key={item.id} item={item} isNew={newIds.has(item.id)} />
        ))
      )}
    </div>
  );
}
