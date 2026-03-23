"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { refreshRealtimeSnapshot, useRealtimeSelector } from "@/lib/realtime-client";
import type { NewsItem } from "@/lib/mock-data";
import { formatCompact, timeAgo } from "@/lib/format-utils";

const DEV_SIM_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEV_SIM_FEEDS === "true";

const DEV_TOKENS = ["BTC", "ETH", "SOL", "BNB", "XRP", "USDT"];
const DEV_EXCHANGES = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDevWhale(id: string): NewsItem {
  const token = randomFrom(DEV_TOKENS);
  const usdValue = Math.random() * 2_000_000 + 350_000;
  return {
    id,
    headline: `${formatCompact(usdValue)} ${token} moved`,
    summary: "Development simulation event",
    source: "Sim Feed",
    type: "whale",
    ticker: [token],
    sector: "Crypto",
    timestamp: new Date(),
    url: "#",
    sentiment: "neutral",
    whaleAmountUsd: usdValue,
    whaleToken: token,
    whaleFrom: randomFrom(DEV_EXCHANGES),
    whaleTo: randomFrom(DEV_EXCHANGES),
    whaleBlockchain: "simulation",
  };
}

function WhaleRow({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const usd = item.whaleAmountUsd ?? 0;
  const token = item.whaleToken ?? item.ticker?.[0] ?? "?";
  const from = item.whaleFrom ?? "Unknown";
  const to = item.whaleTo ?? "Unknown";

  return (
    <div
      className={`flex items-start gap-2.5 border-b border-[rgba(245,160,30,0.14)] bg-[rgba(245,160,30,0.03)] px-3 py-2.5 transition-all duration-150 ${isNew ? "animate-pulse-once" : ""}`}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(245,160,30,0.12)] text-base">
        W
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              color: "#f0b90b",
              background: "rgba(240,185,11,0.12)",
              border: "1px solid rgba(240,185,11,0.24)",
            }}
          >
            {token}
          </span>
          <span className="text-[12px] font-bold tabular-nums text-amber-200">{formatCompact(usd)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px]">
          <span className="truncate max-w-[100px] text-zinc-400">{from}</span>
          <span className="shrink-0 text-zinc-600">→</span>
          <span className="truncate max-w-[100px] text-zinc-300">{to}</span>
        </div>
      </div>
      <span className="shrink-0 text-[9px] text-zinc-600 tabular-nums mt-0.5">{timeAgo(item.timestamp)}</span>
    </div>
  );
}

export default function WhaleFeed({ onPulse }: { onPulse?: () => void }) {
  const realtimeWhales = useRealtimeSelector((state) => state.whales);
  const connectionStatus = useRealtimeSelector((state) => state.connectionStatus);
  const [devFeed, setDevFeed] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const latestRealtimeIdRef = useRef<string | null>(null);
  const counterRef = useRef(0);

  const feed = useMemo(() => {
    if (realtimeWhales.length > 0) return realtimeWhales.slice(0, 40);
    if (DEV_SIM_ENABLED) return devFeed;
    return [];
  }, [devFeed, realtimeWhales]);

  useEffect(() => {
    if (realtimeWhales.length === 0) return;
    const nextId = realtimeWhales[0]?.id;
    const previousId = latestRealtimeIdRef.current;
    if (previousId && nextId && previousId !== nextId) {
      setNewIds((prev) => new Set([...prev, nextId]));
      onPulse?.();
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(nextId);
          return next;
        });
      }, 3500);
    }
    if (nextId) latestRealtimeIdRef.current = nextId;
  }, [onPulse, realtimeWhales]);

  useEffect(() => {
    if (!DEV_SIM_ENABLED || realtimeWhales.length > 0) return;
    const initial = Array.from({ length: 6 }, (_, i) => generateDevWhale(`dev-whale-${i}-${Date.now()}`));
    setDevFeed(initial);
    const interval = setInterval(() => {
      const id = `dev-whale-${counterRef.current++}-${Date.now()}`;
      const next = generateDevWhale(id);
      setDevFeed((prev) => [next, ...prev].slice(0, 30));
      setNewIds((prev) => new Set([...prev, id]));
      onPulse?.();
      setTimeout(() => {
        setNewIds((prev) => {
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      }, 3000);
    }, 9000);
    return () => clearInterval(interval);
  }, [onPulse, realtimeWhales.length]);

  if (feed.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="text-xs text-zinc-500">
          {connectionStatus === "connecting" || connectionStatus === "reconnecting"
            ? "Loading whale feed..."
            : "Whale feed is currently quiet."}
        </div>
        <div className="text-[10px] text-zinc-600">Live on-chain or large-trade events will appear here automatically.</div>
        <button
          type="button"
          onClick={() => void refreshRealtimeSnapshot()}
          className="rounded-md border border-zinc-700/60 bg-zinc-900/70 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.2) transparent" }}>
      {feed.map((item) => (
        <WhaleRow key={item.id} item={item} isNew={newIds.has(item.id)} />
      ))}
    </div>
  );
}
