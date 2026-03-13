"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { NewsItem, AVAILABLE_TICKERS } from "@/lib/mock-data";
import { useAlerts } from "@/hooks/useAlerts";
import { useBinanceWs } from "@/hooks/useBinanceWs";
import TickerTape from "@/components/TickerTape";
import NewsFeed from "@/components/NewsFeed";
import PriceChart from "@/components/PriceChart";
import AlertPanel from "@/components/AlertPanel";
import TradingPanel from "@/components/TradingPanel";
import BottomPanel from "@/components/BottomPanel";
import HyperliquidPanel from "@/components/HyperliquidPanel";
import DydxPanel from "@/components/DydxPanel";
import VenuesPanel from "@/components/VenuesPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import BrandMark from "@/components/BrandMark";
import { useTradingState } from "@/hooks/useTradingState";
import { Wifi, WifiOff, Zap, Link2, GripVertical } from "lucide-react";

type RightTab = "trade" | "dex" | "alerts" | "connect" | "watch";
type DexSubTab = "hl" | "dydx";

function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const onMove = (ev: MouseEvent) => {
        if (dragging.current) onDrag(ev.movementX);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onDrag]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="group z-10 flex shrink-0 items-center justify-center transition-colors"
      style={{ width: 5, cursor: "ew-resize", background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0b90b22")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      title="Drag to resize"
    >
      <GripVertical
        className="h-5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "#f0b90b" }}
      />
    </div>
  );
}

export default function Home() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [chartTicker, setChartTicker] = useState("BTC");
  const [rightTab, setRightTab] = useState<RightTab>("trade");
  const [dexSubTab, setDexSubTab] = useState<DexSubTab>("hl");
  const [hlWallet, setHlWallet] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const { checkNewsAgainstAlerts } = useAlerts();

  const [newsWidth, setNewsWidth] = useState(370);
  const [rightWidth, setRightWidth] = useState(295);

  const resizeNews = useCallback(
    (dx: number) => setNewsWidth((w) => Math.max(200, Math.min(580, w + dx))),
    []
  );
  const resizeRight = useCallback(
    (dx: number) => setRightWidth((w) => Math.max(200, Math.min(480, w - dx))),
    []
  );

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString("tr-TR", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  const { prices: wsPrices, quotes: wsQuotes, connected: wsConnected } = useBinanceWs();
  const {
    balance,
    positions,
    orders,
    prices,
    equityHistory,
    placeOrder,
    closePosition,
    cancelOrder,
    updatePositionTpSl,
  } = useTradingState(wsPrices);

  const handleSelectItem = (item: NewsItem) => {
    setSelectedItem(item);
    if (item.ticker.length > 0) {
      const match = item.ticker.find((t) => AVAILABLE_TICKERS.includes(t));
      if (match) {
        setChartTicker(match);
        setRightTab("trade");
      }
    }
  };

  const tabs: { id: RightTab; label: string }[] = [
    { id: "trade", label: "Trade" },
    { id: "dex", label: "DEX" },
    { id: "connect", label: "Venues" },
    { id: "watch", label: "Watch" },
    { id: "alerts", label: "Alerts" },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <div className="panel-header brand-aura soft-divider status-glow relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(212,161,31,0.55),transparent)]">
        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <div className="hidden md:block">
            <div className="text-[10px] uppercase tracking-[0.34em] text-amber-200/80">
              TraderBross
            </div>
            <div className="text-[11px] tracking-[0.2em] text-zinc-400">
              Professional multi-venue terminal
            </div>
          </div>
          <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-amber-100 md:inline-flex">
            v1.3.0
          </span>
        </div>

        <div className="relative z-10 flex items-center justify-center px-4">
          <BrandMark className="mx-auto" />
        </div>

        <div className="relative z-10 flex items-center justify-end gap-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            {wsConnected ? (
              <Wifi className="h-3 w-3 animate-pulse text-emerald-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            {wsConnected ? "Market Data Live" : "Reconnecting"}
          </span>
          <span className="text-zinc-700">•</span>
          <span className="flex items-center gap-1 text-[#f0d893]">
            <Zap className="h-3 w-3" /> Hyperliquid
          </span>
          <span className="text-zinc-700">•</span>
          <span className="flex items-center gap-1 text-amber-200">
            <Link2 className="h-3 w-3" /> OKX • Bybit • dYdX
          </span>
          <span className="text-zinc-700">•</span>
          <span>{todayLabel || "..."}</span>
        </div>
      </div>

      <div className="px-2 pt-2">
        <div className="panel-shell soft-divider overflow-hidden rounded-xl border">
          <TickerTape quotes={wsQuotes} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-2">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="panel-shell soft-divider flex shrink-0 flex-col overflow-hidden rounded-l-xl border border-r-0"
            style={{ width: newsWidth }}
          >
            <NewsFeed
              onSelectItem={handleSelectItem}
              selectedItem={selectedItem}
              onNewItem={(item) => checkNewsAgainstAlerts(item)}
            />
          </div>

          <ResizeDivider onDrag={resizeNews} />

          <div className="panel-shell soft-divider flex min-w-0 flex-1 flex-col overflow-hidden border">
            <PriceChart
              defaultTicker={chartTicker}
              key={chartTicker}
              positions={positions}
              orders={orders}
              onUpdatePositionTpSl={updatePositionTpSl}
              onPlaceOrder={placeOrder}
            />
          </div>

          <ResizeDivider onDrag={resizeRight} />

          <div
            className="panel-shell soft-divider flex shrink-0 flex-col overflow-hidden rounded-r-xl border border-l-0"
            style={{ width: rightWidth }}
          >
            <div className="panel-header soft-divider grid shrink-0 grid-cols-5 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  data-active={rightTab === tab.id}
                  className="accent-tab truncate px-0.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.24em] transition-colors hover:text-zinc-300"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {rightTab === "trade" && (
              <TradingPanel
                activeTicker={chartTicker}
                selectedNews={selectedItem}
                balance={balance}
                positions={positions}
                prices={prices}
                onPlaceOrder={placeOrder}
              />
            )}

            {rightTab === "dex" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900/60">
                  <button
                    onClick={() => setDexSubTab("hl")}
                    className={`flex-1 py-1 text-[9px] font-bold uppercase transition-colors ${
                      dexSubTab === "hl"
                        ? "border-b-2 border-[rgba(212,161,31,0.72)] text-amber-100"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    Hyperliquid
                  </button>
                  <button
                    onClick={() => setDexSubTab("dydx")}
                    className={`flex-1 py-1 text-[9px] font-bold uppercase transition-colors ${
                      dexSubTab === "dydx"
                        ? "border-b-2 border-amber-300 text-amber-200"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    dYdX v4
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {dexSubTab === "hl" && <HyperliquidPanel />}
                  {dexSubTab === "dydx" && <DydxPanel />}
                </div>
              </div>
            )}

            {rightTab === "connect" && (
              <VenuesPanel hlWallet={hlWallet} onHlWalletChange={setHlWallet} />
            )}

            {rightTab === "watch" && (
              <WatchlistPanel
                quotes={wsQuotes}
                prices={prices}
                activeTicker={chartTicker}
                onSelectTicker={(ticker) => {
                  setChartTicker(ticker);
                  setRightTab("trade");
                }}
              />
            )}

            {rightTab === "alerts" && <AlertPanel />}
          </div>
        </div>

        <div className="pt-2">
          <BottomPanel
            positions={positions}
            orders={orders}
            balance={balance}
            equityHistory={equityHistory}
            onClosePosition={closePosition}
            onCancelOrder={cancelOrder}
            onUpdatePositionTpSl={updatePositionTpSl}
          />
        </div>
      </div>

      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-t px-4 py-1 text-[10px] text-zinc-500">
        <span>
          {wsConnected
            ? "Binance market data online • OKX • Bybit • Hyperliquid • dYdX active"
            : "Binance market data reconnecting..."}
        </span>
        <span className="flex items-center gap-2">
          <span style={{ color: "#3f3f4e" }}>
            News {newsWidth}px • Right {rightWidth}px
          </span>
          <span>
            {selectedItem
              ? `${selectedItem.ticker.join(", ")} - ${selectedItem.source}`
              : "Click a news item to analyze"}
          </span>
        </span>
      </div>
    </div>
  );
}
