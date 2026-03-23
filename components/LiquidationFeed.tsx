"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { refreshRealtimeSnapshot, useRealtimeSelector } from "@/lib/realtime-client";
import type { LiquidationEvent } from "@/lib/backend-types";
import { Zap } from "lucide-react";
import { formatCompact, formatPrice, timeAgo } from "@/lib/format-utils";
import { apiFetch } from "@/lib/api-client";

const DEV_SIM_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEV_SIM_FEEDS === "true";
const DEV_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "LINK"];

type LiqStats = {
  totalUSD: number;
  longUSD: number;
  shortUSD: number;
  count: number;
};

type LiquidationApiResponse = {
  liquidations?: Array<{
    id?: string;
    symbol?: string;
    displaySymbol?: string;
    side?: string;
    quantity?: number;
    price?: number;
    sizeUSD?: number;
    timestamp?: string;
    exchange?: string;
  }>;
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDevLiquidation(id: string): LiquidationEvent {
  const symbol = randomFrom(DEV_SYMBOLS);
  const side: "long" | "short" = Math.random() > 0.5 ? "long" : "short";
  const price = symbol === "BTC" ? 85_000 : symbol === "ETH" ? 3_200 : 100;
  const usdValue = Math.random() * 700_000 + 30_000;
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

function LiquidationRow({ event, isNew }: { event: LiquidationEvent; isNew: boolean }) {
  const isLong = event.side === "long";
  const isBig = event.usdValue >= 1_000_000;
  const sideColor = isLong ? "#0ecb81" : "#f6465d";
  const source = String((event as unknown as { provider?: string }).provider || "").toLowerCase();
  const venueLabel =
    source.includes("bybit") ? "Bybit" : source.includes("okx") ? "OKX" : "Binance";

  return (
    <div
      className={`flex items-center gap-3 border-b px-3 py-2 transition-all duration-150 ${
        isLong
          ? "border-[rgba(14,203,129,0.18)] bg-[rgba(14,203,129,0.04)]"
          : "border-[rgba(246,70,93,0.18)] bg-[rgba(246,70,93,0.04)]"
      } ${isNew ? "animate-pulse-once" : ""}`}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: isLong ? "rgba(14,203,129,0.14)" : "rgba(246,70,93,0.14)" }}>
        <Zap className="h-3 w-3" style={{ color: sideColor }} />
      </div>
      <div className="min-w-[64px] shrink-0">
        <div className="text-[12px] font-bold text-[#f3ead7]">{event.symbol}<span className="ml-0.5 text-[10px] text-zinc-500">PERP</span></div>
        <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: sideColor }}>{event.side} liqd.</div>
      </div>
      <div className="flex-1">
        <div className={`text-[13px] tabular-nums ${isBig ? "font-extrabold" : "font-bold"}`} style={{ color: sideColor }}>
          {formatCompact(event.usdValue)}
        </div>
        <div className="text-[9px] text-zinc-600">@ ${formatPrice(event.price)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[9px] font-semibold text-zinc-400">{venueLabel}</div>
        <div className="text-[9px] text-zinc-600 tabular-nums">{timeAgo(event.timestamp)}</div>
      </div>
    </div>
  );
}

function LiquidationSummary({ stats }: { stats: LiqStats }) {
  return (
    <div className="flex items-center gap-4 border-b px-3 py-2" style={{ borderColor: "rgba(39,39,42,0.72)", background: "rgba(12,11,10,0.98)" }}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[9px] text-zinc-500">Long liqd.</span>
        <span className="text-[10px] font-bold tabular-nums text-emerald-400">{formatCompact(stats.longUSD)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span className="text-[9px] text-zinc-500">Short liqd.</span>
        <span className="text-[10px] font-bold tabular-nums text-rose-400">{formatCompact(stats.shortUSD)}</span>
      </div>
      <div className="ml-auto text-[9px] text-zinc-600">Last {stats.count} events</div>
    </div>
  );
}

export default function LiquidationFeed({
  onPulse,
  onStatsUpdate,
}: {
  onPulse?: () => void;
  onStatsUpdate?: (stats: LiqStats) => void;
}) {
  const realtimeLiquidations = useRealtimeSelector((state) => state.liquidations ?? []);
  const connectionStatus = useRealtimeSelector((state) => state.connectionStatus);
  const [apiFeed, setApiFeed] = useState<LiquidationEvent[]>([]);
  const [devFeed, setDevFeed] = useState<LiquidationEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const latestRealtimeIdRef = useRef<string | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const mapApiRows = (rows: NonNullable<LiquidationApiResponse["liquidations"]>): LiquidationEvent[] =>
      rows
        .map((row) => {
          const side = String(row.side || "").toUpperCase() === "LONG" ? "long" : "short";
          const symbol = String(row.displaySymbol || row.symbol || "").replace(/USDT$/i, "");
          const usdValue = Number(row.sizeUSD || 0);
          const price = Number(row.price || 0);
          const qty = Number(row.quantity || 0);
          if (!symbol || !Number.isFinite(usdValue) || usdValue <= 0) return null;
          return {
            id: String(row.id || `api-liq-${symbol}-${row.timestamp || Date.now()}`),
            symbol,
            side,
            qty: Number.isFinite(qty) ? qty : 0,
            price: Number.isFinite(price) ? price : 0,
            usdValue,
            timestamp: String(row.timestamp || new Date().toISOString()),
            provider: row.exchange ? `${String(row.exchange).toLowerCase()}_liquidations` : "liquidations_api",
          } as LiquidationEvent & { provider?: string };
        })
        .filter((item): item is LiquidationEvent => Boolean(item))
        .slice(0, 50);

    const fetchFromApi = async () => {
      try {
        const payload = await apiFetch<LiquidationApiResponse>("/api/liquidations?limit=50");
        const next = mapApiRows(Array.isArray(payload?.liquidations) ? payload.liquidations : []);
        if (!mounted) return;
        setApiFeed(next);
      } catch {
        if (!mounted) return;
        // Keep last successful API fallback feed.
      }
    };

    void fetchFromApi();
    intervalId = setInterval(() => {
      void fetchFromApi();
    }, 9000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const feed = useMemo(() => {
    if (realtimeLiquidations.length > 0) return realtimeLiquidations.slice(0, 50);
    if (apiFeed.length > 0) return apiFeed;
    if (DEV_SIM_ENABLED) return devFeed;
    return [];
  }, [apiFeed, devFeed, realtimeLiquidations]);

  const stats = useMemo(
    () =>
      feed.reduce<LiqStats>(
        (acc, row) => {
          acc.totalUSD += row.usdValue;
          if (row.side === "long") acc.longUSD += row.usdValue;
          if (row.side === "short") acc.shortUSD += row.usdValue;
          acc.count += 1;
          return acc;
        },
        { totalUSD: 0, longUSD: 0, shortUSD: 0, count: 0 },
      ),
    [feed],
  );

  useEffect(() => {
    onStatsUpdate?.(stats);
  }, [onStatsUpdate, stats]);

  useEffect(() => {
    if (realtimeLiquidations.length === 0) return;
    const nextId = realtimeLiquidations[0]?.id;
    const prevId = latestRealtimeIdRef.current;
    if (prevId && nextId && prevId !== nextId) {
      setNewIds((prev) => new Set([...prev, nextId]));
      onPulse?.();
      setTimeout(() => {
        setNewIds((prev) => {
          const copy = new Set(prev);
          copy.delete(nextId);
          return copy;
        });
      }, 3000);
    }
    if (nextId) latestRealtimeIdRef.current = nextId;
  }, [onPulse, realtimeLiquidations]);

  useEffect(() => {
    if (!DEV_SIM_ENABLED || realtimeLiquidations.length > 0) return;
    const initial = Array.from({ length: 10 }, (_, i) => generateDevLiquidation(`dev-liq-${i}-${Date.now() - i * 1000}`));
    setDevFeed(initial);
    const interval = setInterval(() => {
      const id = `dev-liq-${counterRef.current++}-${Date.now()}`;
      const next = generateDevLiquidation(id);
      setDevFeed((prev) => [next, ...prev].slice(0, 40));
      setNewIds((prev) => new Set([...prev, id]));
      onPulse?.();
      setTimeout(() => {
        setNewIds((prev) => {
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      }, 3000);
    }, 6000);
    return () => clearInterval(interval);
  }, [onPulse, realtimeLiquidations.length]);

  if (feed.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="text-xs text-zinc-500">
          {connectionStatus === "connecting" || connectionStatus === "reconnecting"
            ? "Loading liquidation feed..."
            : "No recent liquidation events."}
        </div>
        <div className="text-[10px] text-zinc-600">Large forced liquidations will stream here as they happen.</div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <LiquidationSummary stats={stats} />
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(246,70,93,0.2) transparent" }}>
        {feed.map((event) => (
          <LiquidationRow key={event.id} event={event} isNew={newIds.has(event.id)} />
        ))}
      </div>
    </div>
  );
}
