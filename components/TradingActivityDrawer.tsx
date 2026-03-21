"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import BottomPanel from "@/components/BottomPanel";
import type { EquityPoint, Order, Position } from "@/hooks/useTradingState";
import { calcPnl } from "@/hooks/useTradingState";

type DrawerMode = "closed" | "half" | "full";

type Props = {
  positions: Position[];
  orders: Order[];
  balance: number;
  equityHistory: EquityPoint[];
  onClosePosition: (id: string, closePercent?: number) => void;
  onCancelOrder: (id: string) => void;
  onUpdatePositionTpSl: (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => void;
  isLiveVenue?: boolean;
  venueName?: string;
};

const CLOSED_HEIGHT = 46;
const HALF_RATIO = 0.38;
const FULL_RATIO = 0.68;

function getModeHeight(mode: DrawerMode, viewportHeight: number) {
  if (mode === "closed") return CLOSED_HEIGHT;
  if (mode === "half") return Math.round(viewportHeight * HALF_RATIO);
  return Math.round(viewportHeight * FULL_RATIO);
}

function resolveModeFromHeight(height: number, viewportHeight: number): DrawerMode {
  const halfHeight = getModeHeight("half", viewportHeight);
  const fullHeight = getModeHeight("full", viewportHeight);
  const closedThreshold = CLOSED_HEIGHT + 40;
  const midpoint = (halfHeight + fullHeight) / 2;

  if (height <= closedThreshold) return "closed";
  if (height < midpoint) return "half";
  return "full";
}

export default function TradingActivityDrawer({
  positions,
  orders,
  balance,
  equityHistory,
  onClosePosition,
  onCancelOrder,
  onUpdatePositionTpSl,
  isLiveVenue = false,
  venueName,
}: Props) {
  const [mode, setMode] = useState<DrawerMode>("closed");
  const [drawerHeight, setDrawerHeight] = useState<number>(CLOSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const openOrders = useMemo(() => orders.filter((order) => order.status === "open"), [orders]);
  const totalUnrealizedPnl = useMemo(
    () => positions.reduce((sum, position) => sum + calcPnl(position), 0),
    [positions]
  );
  const pnlPositive = totalUnrealizedPnl >= 0;
  const hasPnl = positions.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDrawerHeight(getModeHeight(mode, window.innerHeight));
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setDrawerHeight((current) => {
        if (isDragging) return current;
        return getModeHeight(mode, window.innerHeight);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDragging, mode]);

  const cycleMode = () => {
    setMode((current) => {
      if (current === "closed") return "half";
      if (current === "half") return "full";
      return "closed";
    });
  };

  const handleBarClick = () => {
    if (mode === "closed") setMode("half");
  };

  const handleBarDoubleClick = () => {
    setMode((current) => {
      if (current === "closed") return "full";
      return current === "half" ? "full" : "half";
    });
  };

  const startDrag = (clientY: number) => {
    dragStateRef.current = { startY: clientY, startHeight: drawerHeight };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: MouseEvent) => {
      if (!dragStateRef.current) return;
      const viewportHeight = window.innerHeight;
      const deltaY = dragStateRef.current.startY - event.clientY;
      const nextHeight = Math.max(
        CLOSED_HEIGHT,
        Math.min(Math.round(viewportHeight * 0.75), dragStateRef.current.startHeight + deltaY)
      );
      setDrawerHeight(nextHeight);
    };

    const handleUp = () => {
      const viewportHeight = window.innerHeight;
      setMode(resolveModeFromHeight(drawerHeight, viewportHeight));
      setIsDragging(false);
      dragStateRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drawerHeight, isDragging]);

  /* ─── Accent colour driven by PnL direction ─── */
  const accentColor = hasPnl
    ? pnlPositive
      ? "rgba(52,211,153,0.7)"
      : "rgba(248,113,113,0.7)"
    : "rgba(212,161,31,0.5)";

  const accentBg = hasPnl
    ? pnlPositive
      ? "rgba(52,211,153,0.07)"
      : "rgba(248,113,113,0.07)"
    : "transparent";

  return (
    <div
      className="shrink-0 overflow-hidden transition-[height] duration-200 ease-out"
      style={{
        height: drawerHeight,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        background: "rgba(6,8,11,0.97)",
        borderRadius: "12px 12px 0 0",
      }}
    >
      {/* ── Handle / Title Bar ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleBarClick}
        onDoubleClick={handleBarDoubleClick}
        onKeyDown={(e) => e.key === "Enter" && handleBarClick()}
        className="relative flex h-[46px] w-full shrink-0 cursor-pointer select-none items-center gap-3 px-3 text-left"
        style={{
          borderBottom: mode !== "closed" ? "1px solid rgba(255,255,255,0.05)" : "none",
          background:
            mode !== "closed"
              ? "rgba(10,12,16,0.98)"
              : `linear-gradient(90deg, ${accentBg}, transparent 60%)`,
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 h-full w-[3px] rounded-tr-sm rounded-br-sm transition-colors duration-500"
          style={{ background: accentColor }}
        />

        {/* Drag handle knob */}
        <div className="absolute left-1/2 top-[6px] h-[3px] w-10 -translate-x-1/2 rounded-full bg-white/[0.08]" />

        {/* Icon + Title */}
        <div className="ml-2 flex items-center gap-2 shrink-0">
          <Activity
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: mode !== "closed" ? "#d4a11f" : accentColor }}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            Trade Activity
          </span>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Positions badge */}
          <span
            className="shrink-0 rounded-md px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: positions.length > 0 ? "rgba(212,161,31,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${positions.length > 0 ? "rgba(212,161,31,0.25)" : "rgba(255,255,255,0.07)"}`,
              color: positions.length > 0 ? "#d4a11f" : "#52525b",
            }}
          >
            {positions.length} POS
          </span>

          {/* Orders badge */}
          <span
            className="shrink-0 rounded-md px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: openOrders.length > 0 ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${openOrders.length > 0 ? "rgba(129,140,248,0.25)" : "rgba(255,255,255,0.07)"}`,
              color: openOrders.length > 0 ? "#818cf8" : "#52525b",
            }}
          >
            {openOrders.length} ORD
          </span>

          {/* Live venue badge */}
          {isLiveVenue && (
            <span
              className="shrink-0 rounded-md px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.25)",
                color: "#34d399",
              }}
            >
              ● {venueName ?? "LIVE"}
            </span>
          )}

          {/* Unrealized PnL chip */}
          {hasPnl && (
            <span
              className="shrink-0 rounded-md px-2 py-[3px] text-[9px] font-bold tabular-nums"
              style={{
                background: pnlPositive ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                border: `1px solid ${pnlPositive ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
                color: pnlPositive ? "#34d399" : "#f87171",
              }}
            >
              {pnlPositive ? "+" : ""}${totalUnrealizedPnl.toFixed(2)} PnL
            </span>
          )}

          {/* Balance chip */}
          <span
            className="shrink-0 rounded-md px-2 py-[3px] text-[9px] font-semibold tabular-nums"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#a1a1aa",
            }}
          >
            ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Right controls */}
        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMode((current) => (current === "closed" ? "half" : "closed"));
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            title={mode === "closed" ? "Open" : "Close"}
          >
            {mode === "closed" ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mode !== "closed" && (
        <div className="flex h-[calc(100%-46px)] min-h-0 flex-col overflow-hidden">
          <div
            className="flex h-3.5 shrink-0 cursor-ns-resize items-center justify-center"
            onMouseDown={(event) => startDrag(event.clientY)}
            title="Drag to resize"
          >
            <div className="h-[3px] w-12 rounded-full bg-white/[0.07]" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BottomPanel
              positions={positions}
              orders={orders}
              balance={balance}
              equityHistory={equityHistory}
              onClosePosition={onClosePosition}
              onCancelOrder={onCancelOrder}
              onUpdatePositionTpSl={onUpdatePositionTpSl}
              drawerMode={mode}
              isLiveVenue={isLiveVenue}
              onCollapse={() => setMode("closed")}
              onExpand={() => setMode((current) => (current === "half" ? "full" : "half"))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
