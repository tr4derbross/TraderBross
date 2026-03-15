"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronsUpDown } from "lucide-react";
import BottomPanel from "@/components/BottomPanel";
import type { EquityPoint, Order, Position } from "@/hooks/useTradingState";
import { calcPnl } from "@/hooks/useTradingState";

type DrawerMode = "closed" | "half" | "full";

type Props = {
  positions: Position[];
  orders: Order[];
  balance: number;
  equityHistory: EquityPoint[];
  onClosePosition: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onUpdatePositionTpSl: (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => void;
};

const CLOSED_HEIGHT = 42;
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

  const openHalf = () => setMode("half");

  const cycleMode = () => {
    setMode((current) => {
      if (current === "closed") return "half";
      if (current === "half") return "full";
      return "closed";
    });
  };

  const handleBarClick = () => {
    if (mode === "closed") {
      setMode("half");
    }
  };

  const handleBarDoubleClick = () => {
    setMode((current) => {
      if (current === "closed") return "full";
      return current === "half" ? "full" : "half";
    });
  };

  const startDrag = (clientY: number) => {
    dragStateRef.current = {
      startY: clientY,
      startHeight: drawerHeight,
    };
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

  return (
    <div
      className="panel-shell soft-divider shrink-0 overflow-hidden border transition-[height] duration-200 ease-out"
      style={{ height: drawerHeight }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleBarClick}
        onDoubleClick={handleBarDoubleClick}
        onKeyDown={(e) => e.key === "Enter" && handleBarClick()}
        className="panel-header soft-divider relative flex h-[42px] w-full shrink-0 cursor-pointer items-center justify-between border-b px-3 text-left"
      >
        <div className="absolute left-1/2 top-1.5 h-1 w-14 -translate-x-1/2 rounded-full bg-white/10" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Trade Activity
          </span>
          <span className="truncate text-[10px] text-zinc-500">
            Positions ({positions.length}) | Orders ({openOrders.length}) | Unrealized PnL{" "}
            <span className={totalUnrealizedPnl >= 0 ? "text-emerald-300" : "text-red-300"}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="ml-3 flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              cycleMode();
            }}
            className="terminal-chip inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300"
            title="Cycle drawer size"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-zinc-400">
            <ChevronUp
              className={`h-4 w-4 transition-transform duration-200 ${
                mode === "closed" ? "rotate-0" : "rotate-180"
              }`}
            />
          </span>
        </div>
      </div>

      {mode !== "closed" && (
        <div className="flex h-[calc(100%-42px)] min-h-0 flex-col overflow-hidden">
          <div
            className="flex h-4 shrink-0 cursor-ns-resize items-center justify-center"
            onMouseDown={(event) => startDrag(event.clientY)}
            title="Drag to resize"
          >
            <div className="h-1 w-12 rounded-full bg-white/10" />
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
              onCollapse={() => setMode("closed")}
              onExpand={() => setMode((current) => (current === "half" ? "full" : "half"))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
