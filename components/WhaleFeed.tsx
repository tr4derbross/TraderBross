"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeSelector } from "@/lib/realtime-client";
import type { NewsItem } from "@/lib/mock-data";

import { formatCompact, timeAgo } from "@/lib/format-utils";

// ── API whale shape ───────────────────────────────────────────────────────────

interface ApiWhale {
  id: string;
  type: "transfer" | "exchange_inflow" | "exchange_outflow" | "liquidation";
  asset: string;
  amountUSD: number;
  from: string;
  to: string;
  side?: "LONG" | "SHORT";
  timestamp: string;
  channelUrl: string;
  severity: number;
}

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

// ── Convert ApiWhale → display-friendly shape ─────────────────────────────────

interface WhaleDisplay {
  id: string;
  type: "transfer" | "exchange_inflow" | "exchange_outflow" | "liquidation";
  asset: string;
  amountUSD: number;
  from: string;
  to: string;
  side?: "LONG" | "SHORT";
  timestamp: string;
  channelUrl: string;
  severity: number;
}

function apiWhaleToDisplay(w: ApiWhale): WhaleDisplay {
  return {
    id: w.id,
    type: w.type,
    asset: w.asset,
    amountUSD: w.amountUSD,
    from: w.from,
    to: w.to,
    side: w.side,
    timestamp: w.timestamp,
    channelUrl: w.channelUrl,
    severity: w.severity,
  };
}

// ── Sub-components (API-native row) ───────────────────────────────────────────

function WhaleRowApi({ whale, isNew }: { whale: WhaleDisplay; isNew: boolean }) {
  const isInflow = whale.type === "exchange_inflow";
  const isOutflow = whale.type === "exchange_outflow";
  const isLiquidation = whale.type === "liquidation";

  const rowColor = isInflow
    ? "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]"
    : isOutflow
      ? "border-[rgba(14,203,129,0.18)] bg-[rgba(14,203,129,0.03)]"
      : isLiquidation
        ? "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]"
        : "border-[rgba(245,160,30,0.14)] bg-[rgba(245,160,30,0.03)]";

  const amountColor = isInflow
    ? "#f6465d"
    : isOutflow
      ? "#0ecb81"
      : isLiquidation
        ? "#f6465d"
        : "#f5a01e";

  const iconBg = isInflow || isLiquidation
    ? "rgba(246,70,93,0.12)"
    : isOutflow
      ? "rgba(14,203,129,0.12)"
      : "rgba(245,160,30,0.12)";

  const icon = isLiquidation ? "💥" : isInflow ? "🔴" : isOutflow ? "🟢" : "🐋";

  const badgeLabel = isInflow
    ? "Exchange Inflow"
    : isOutflow
      ? "Exchange Outflow"
      : isLiquidation
        ? `${whale.side ?? ""} Liqd.`
        : "Transfer";

  const badgeColor = isInflow || isLiquidation
    ? { color: "#f6465d", background: "rgba(246,70,93,0.1)", border: "1px solid rgba(246,70,93,0.2)" }
    : isOutflow
      ? { color: "#0ecb81", background: "rgba(14,203,129,0.1)", border: "1px solid rgba(14,203,129,0.2)" }
      : { color: "#f5a01e", background: "rgba(245,160,30,0.1)", border: "1px solid rgba(245,160,30,0.2)" };

  return (
    <div
      className={`flex items-start gap-2.5 border-b px-3 py-2.5 transition-all duration-150 ${rowColor} ${isNew ? "animate-pulse-once" : ""}`}
    >
      {/* Icon */}
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base"
        style={{ background: iconBg }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Asset + amount */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold font-mono"
            style={{
              color: "#f0b90b",
              background: "rgba(240,185,11,0.12)",
              border: "1px solid rgba(240,185,11,0.24)",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {whale.asset}
          </span>
          <span
            className="text-[12px] font-bold tabular-nums"
            style={{ color: amountColor, fontFamily: "IBM Plex Mono, monospace" }}
          >
            {formatCompact(whale.amountUSD)}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
            style={badgeColor}
          >
            {badgeLabel}
          </span>
        </div>

        {/* Route: from → to */}
        <div
          className="mt-1 flex items-center gap-1 text-[10px]"
          style={{ fontFamily: "IBM Plex Sans, sans-serif" }}
        >
          <span className="truncate max-w-[100px] text-zinc-400">{whale.from}</span>
          <span className="shrink-0 text-zinc-600">→</span>
          <span className="truncate max-w-[100px] text-zinc-300">{whale.to}</span>
        </div>
      </div>

      {/* Timestamp + severity */}
      <div className="shrink-0 flex flex-col items-end gap-0.5 mt-0.5">
        <span
          className="text-[9px] text-zinc-600 tabular-nums"
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          {timeAgo(whale.timestamp)}
        </span>
        {whale.severity >= 4 && (
          <span className="text-[8px] font-bold" style={{ color: "#f5a01e" }}>
            {"★".repeat(whale.severity - 3)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Legacy mock row (NewsItem shape) ─────────────────────────────────────────

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

  // API-fetched whales (primary source)
  const [apiWhales, setApiWhales] = useState<WhaleDisplay[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Mock fallback feed (NewsItem shape)
  const [mockFeed, setMockFeed] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const counterRef = useRef(0);

  // ── Tab-level pulse (3s) on new data ──────────────────────────────────────
  const [tabPulse, setTabPulse] = useState(false);

  function triggerTabPulse() {
    setTabPulse(true);
    onPulse?.();
    setTimeout(() => setTabPulse(false), 3000);
  }

  // ── Fetch from /api/whales ─────────────────────────────────────────────────
  async function fetchWhales() {
    try {
      const res = await fetch("/api/whales?limit=20");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiWhale[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const displays = data.map(apiWhaleToDisplay);
        setApiWhales((prev) => {
          // Detect new entries by comparing first id
          const hasNew = prev.length > 0 && displays[0]?.id !== prev[0]?.id;
          if (hasNew) {
            const newId = displays[0]?.id;
            if (newId) {
              setNewIds((p) => new Set([...p, newId]));
              triggerTabPulse();
              setTimeout(() => {
                setNewIds((p) => {
                  const next = new Set(p);
                  next.delete(newId);
                  return next;
                });
              }, 3000);
            }
          }
          return displays;
        });
        setApiLoaded(true);
      }
    } catch {
      // Fall through — mock fallback will take over
    }
  }

  // Initial fetch + 15s polling
  useEffect(() => {
    fetchWhales();
    const interval = setInterval(fetchWhales, 15_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seed mock feed on mount (fallback) ───────────────────────────────────
  useEffect(() => {
    if (realtimeWhales.length > 0) {
      setMockFeed(realtimeWhales.slice(0, 30));
    } else {
      const initial = Array.from({ length: 8 }, (_, i) =>
        generateMockWhale(`whale-init-${i}-${Date.now()}`),
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setMockFeed(initial);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mock feed with realtime when it arrives
  useEffect(() => {
    if (realtimeWhales.length > 0) {
      setMockFeed(realtimeWhales.slice(0, 30));
    }
  }, [realtimeWhales]);

  // Simulate new whale every 8s when no live/API data
  useEffect(() => {
    if (apiLoaded || realtimeWhales.length > 0) return;

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
  }, [apiLoaded, realtimeWhales.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────

  // If API data is loaded, render API rows; otherwise render mock rows
  const useApiData = apiLoaded && apiWhales.length > 0;

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto transition-all duration-300 ${tabPulse ? "ring-1 ring-amber-400/20" : ""}`}
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,161,31,0.2) transparent" }}
    >
      {useApiData ? (
        apiWhales.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-zinc-600">
            Waiting for whale data…
          </div>
        ) : (
          apiWhales.map((whale) => (
            <WhaleRowApi key={whale.id} whale={whale} isNew={newIds.has(whale.id)} />
          ))
        )
      ) : (
        mockFeed.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-zinc-600">
            Waiting for whale data…
          </div>
        ) : (
          mockFeed.map((item) => (
            <WhaleRow key={item.id} item={item} isNew={newIds.has(item.id)} />
          ))
        )
      )}
    </div>
  );
}
