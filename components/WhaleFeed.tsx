"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeSelector } from "@/lib/realtime-client";
import type { NewsItem } from "@/lib/mock-data";
import { formatCompact, timeAgo } from "@/lib/format-utils";

const WHALE_TOKENS = ["BTC", "ETH", "USDT", "SOL", "BNB", "XRP", "USDC"];
const EXCHANGES = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "KuCoin"];
const WALLET_LABELS = ["Unknown Wallet", "Whale 0x...a4f2", "Whale 0x...3c9e", "Cold Storage", "DeFi Vault", "Foundation Wallet"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockWhale(id: string): NewsItem {
  const token = randomFrom(WHALE_TOKENS);
  const isStable = token === "USDT" || token === "USDC";
  const usdValue = isStable ? Math.random() * 900_000_000 + 100_000_000 : Math.random() * 4_500_000_000 + 500_000;
  const toExchange = Math.random() > 0.55;
  const fromExchange = !toExchange && Math.random() > 0.7;
  const from = fromExchange ? randomFrom(EXCHANGES) : randomFrom(WALLET_LABELS);
  const to = toExchange ? randomFrom(EXCHANGES) : randomFrom(WALLET_LABELS);

  return {
    id,
    headline: `${formatCompact(usdValue)} ${token} moved`,
    summary: "",
    source: "Whale Alert",
    type: "whale",
    ticker: [token],
    sector: "DeFi",
    timestamp: new Date(),
    url: "#",
    sentiment: toExchange ? "bearish" : fromExchange ? "bullish" : "neutral",
    whaleAmountUsd: usdValue,
    whaleToken: token,
    whaleFrom: from,
    whaleTo: to,
    whaleBlockchain: token === "BTC" ? "bitcoin" : "ethereum",
  };
}

function WhaleRow({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const usd = item.whaleAmountUsd ?? 0;
  const token = item.whaleToken ?? item.ticker?.[0] ?? "?";
  const from = item.whaleFrom ?? "Unknown";
  const to = item.whaleTo ?? "Unknown";
  const isExchangeInflow = EXCHANGES.some((exchange) => to.toLowerCase().includes(exchange.toLowerCase()));
  const isExchangeOutflow = EXCHANGES.some((exchange) => from.toLowerCase().includes(exchange.toLowerCase()));

  const rowColor = isExchangeInflow
    ? "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]"
    : isExchangeOutflow
      ? "border-[rgba(14,203,129,0.18)] bg-[rgba(14,203,129,0.03)]"
      : "border-[rgba(245,160,30,0.14)] bg-[rgba(245,160,30,0.03)]";

  const amountColor = isExchangeInflow ? "#f6465d" : isExchangeOutflow ? "#0ecb81" : "#f5a01e";

  return (
    <div className={`flex items-start gap-2.5 border-b px-3 py-2.5 transition-all duration-150 ${rowColor} ${isNew ? "animate-pulse-once" : ""}`}>
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
        {"W"}
      </div>

      <div className="min-w-0 flex-1">
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
          <span className="text-[12px] font-bold tabular-nums" style={{ color: amountColor, fontFamily: "IBM Plex Mono, monospace" }}>
            {formatCompact(usd)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
          <span className="truncate max-w-[100px] text-zinc-400">{from}</span>
          <span className="shrink-0 text-zinc-600">→</span>
          <span className="truncate max-w-[100px] text-zinc-300">{to}</span>
        </div>
      </div>

      <span className="shrink-0 text-[9px] text-zinc-600 tabular-nums mt-0.5" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

export default function WhaleFeed({ onPulse }: { onPulse?: () => void }) {
  const realtimeWhales = useRealtimeSelector((state) => state.whales);
  const [mockFeed, setMockFeed] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [tabPulse, setTabPulse] = useState(false);
  const counterRef = useRef(0);
  const latestRealtimeIdRef = useRef<string | null>(null);

  function triggerTabPulse() {
    setTabPulse(true);
    onPulse?.();
    setTimeout(() => setTabPulse(false), 3000);
  }

  useEffect(() => {
    if (realtimeWhales.length > 0) {
      setMockFeed(realtimeWhales.slice(0, 30));
      return;
    }

    const initial = Array.from({ length: 8 }, (_, i) =>
      generateMockWhale(`whale-init-${i}-${Date.now()}`),
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setMockFeed(initial);
  }, [realtimeWhales]);

  useEffect(() => {
    if (realtimeWhales.length === 0) return;
    const nextId = realtimeWhales[0]?.id;
    const previousId = latestRealtimeIdRef.current;

    if (previousId && nextId && previousId !== nextId) {
      setNewIds((prev) => new Set([...prev, nextId]));
      triggerTabPulse();
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(nextId);
          return next;
        });
      }, 3000);
    }

    if (nextId) {
      latestRealtimeIdRef.current = nextId;
    }
    setMockFeed(realtimeWhales.slice(0, 30));
  }, [realtimeWhales]);

  useEffect(() => {
    if (realtimeWhales.length > 0) return;

    const interval = setInterval(() => {
      const id = `whale-sim-${counterRef.current++}-${Date.now()}`;
      const newWhale = generateMockWhale(id);

      setMockFeed((prev) => [newWhale, ...prev].slice(0, 30));
      setNewIds((prev) => new Set([...prev, id]));
      triggerTabPulse();

      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 4000);
    }, 8000);

    return () => clearInterval(interval);
  }, [realtimeWhales.length]);

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto transition-all duration-300 ${tabPulse ? "ring-1 ring-amber-400/20" : ""}`}
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.2) transparent" }}
    >
      {mockFeed.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-zinc-600">
          Waiting for whale data...
        </div>
      ) : (
        mockFeed.map((item) => (
          <WhaleRow key={item.id} item={item} isNew={newIds.has(item.id)} />
        ))
      )}
    </div>
  );
}
