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
import {
  Wifi,
  WifiOff,
  Zap,
  Link2,
  GripVertical,
  Newspaper,
  CandlestickChart,
  PanelsTopLeft,
} from "lucide-react";

type RightTab = "trade" | "dex" | "alerts" | "connect" | "watch";
type DexSubTab = "hl" | "dydx";
type WorkspaceTab = "news" | "chart" | "tools";

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

export default function TerminalApp() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [chartTicker, setChartTicker] = useState("BTC");
  const [rightTab, setRightTab] = useState<RightTab>("trade");
  const [dexSubTab, setDexSubTab] = useState<DexSubTab>("hl");
  const [hlWallet, setHlWallet] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<WorkspaceTab>("chart");
  const { checkNewsAgainstAlerts } = useAlerts();

  const [newsWidth, setNewsWidth] = useState(370);
  const [rightWidth, setRightWidth] = useState(295);

  const resizeNews = useCallback(
    (dx: number) => setNewsWidth((w) => Math.max(240, Math.min(580, w + dx))),
    []
  );
  const resizeRight = useCallback(
    (dx: number) => setRightWidth((w) => Math.max(250, Math.min(480, w - dx))),
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

  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
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
        setMobileWorkspaceTab("chart");
      }
    }
  };

  const handleTickerRoute = (ticker: string, item: NewsItem) => {
    setSelectedItem(item);
    setChartTicker(ticker);
    setRightTab("trade");

    if (!showDesktopLayout) {
      setMobileWorkspaceTab("tools");
    }
  };

  const tabs: { id: RightTab; label: string }[] = [
    { id: "trade", label: "Trade" },
    { id: "dex", label: "DEX" },
    { id: "connect", label: "Venues" },
    { id: "watch", label: "Watch" },
    { id: "alerts", label: "Alerts" },
  ];

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1280;
  const showDesktopLayout = viewportWidth >= 1280;

  const renderNewsPanel = () => (
    <div className="panel-shell soft-divider flex h-full min-h-0 flex-col overflow-hidden border xl:rounded-l-xl xl:border-r-0">
      <NewsFeed
        onSelectItem={handleSelectItem}
        onTickerSelect={handleTickerRoute}
        selectedItem={selectedItem}
        onNewItem={(item) => checkNewsAgainstAlerts(item)}
      />
    </div>
  );

  const renderChartPanel = (extraClassName = "") => (
    <div
      className={`panel-shell soft-divider flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border ${extraClassName}`}
    >
      <PriceChart
        defaultTicker={chartTicker}
        key={chartTicker}
        positions={positions}
        orders={orders}
        onUpdatePositionTpSl={updatePositionTpSl}
        onPlaceOrder={placeOrder}
      />
    </div>
  );

  const renderRightPanel = () => (
    <div className="panel-shell soft-divider flex h-full min-h-0 flex-col overflow-hidden border xl:rounded-r-xl xl:border-l-0">
      <div className="panel-header soft-divider shrink-0 border-b">
        <div className="flex overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              data-active={rightTab === tab.id}
              className="accent-tab shrink-0 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors hover:text-zinc-300"
            >
              {tab.label}
            </button>
          ))}
        </div>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900/60">
            <button
              onClick={() => setDexSubTab("hl")}
              className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-colors ${
                dexSubTab === "hl"
                  ? "border-b-2 border-[rgba(212,161,31,0.72)] text-amber-100"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Hyperliquid
            </button>
            <button
              onClick={() => setDexSubTab("dydx")}
              className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-colors ${
                dexSubTab === "dydx"
                  ? "border-b-2 border-amber-300 text-amber-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              dYdX v4
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {dexSubTab === "hl" && <HyperliquidPanel />}
            {dexSubTab === "dydx" && <DydxPanel />}
          </div>
        </div>
      )}

      {rightTab === "connect" && <VenuesPanel hlWallet={hlWallet} onHlWalletChange={setHlWallet} />}

      {rightTab === "watch" && (
        <WatchlistPanel
          quotes={wsQuotes}
          prices={prices}
          activeTicker={chartTicker}
          onSelectTicker={(ticker) => {
            setChartTicker(ticker);
            setRightTab("trade");
            setMobileWorkspaceTab("chart");
          }}
        />
      )}

      {rightTab === "alerts" && <AlertPanel />}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <div className="panel-header brand-aura soft-divider status-glow relative grid shrink-0 gap-3 border-b px-3 py-3 sm:px-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(212,161,31,0.55),transparent)]">
        <div className="relative z-10 flex min-w-0 items-center gap-3 lg:order-1">
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

        <div className="relative z-10 flex items-center justify-center px-2 lg:order-2 lg:px-4">
          <BrandMark className="mx-auto" />
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 lg:order-3 lg:justify-end">
          <span className="flex items-center gap-1">
            {wsConnected ? (
              <Wifi className="h-3 w-3 animate-pulse text-emerald-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            {wsConnected ? "Market Data Live" : "Reconnecting"}
          </span>
          <span className="hidden text-zinc-700 sm:inline">•</span>
          <span className="flex items-center gap-1 text-[#f0d893]">
            <Zap className="h-3 w-3" /> Hyperliquid
          </span>
          <span className="hidden text-zinc-700 sm:inline">•</span>
          <span className="flex items-center gap-1 text-amber-200">
            <Link2 className="h-3 w-3" /> OKX • Bybit • dYdX
          </span>
          <span className="hidden text-zinc-700 sm:inline">•</span>
          <span>{todayLabel || "..."}</span>
        </div>
      </div>

      <div className="px-2 pt-2">
        <div className="panel-shell soft-divider overflow-hidden rounded-xl border">
          <TickerTape quotes={wsQuotes} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-2">
        {isMobile && (
          <div className="mb-2 flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-[rgba(212,161,31,0.12)] bg-[rgba(13,12,11,0.9)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "news" as const, label: "News", icon: Newspaper },
              { id: "chart" as const, label: "Chart", icon: CandlestickChart },
              { id: "tools" as const, label: "Tools", icon: PanelsTopLeft },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMobileWorkspaceTab(item.id)}
                  className={`flex min-w-[96px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${
                    mobileWorkspaceTab === item.id ? "brand-chip-active" : "terminal-chip text-zinc-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {showDesktopLayout ? (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="shrink-0" style={{ width: newsWidth }}>
                {renderNewsPanel()}
              </div>

              <ResizeDivider onDrag={resizeNews} />

              {renderChartPanel()}

              <ResizeDivider onDrag={resizeRight} />

              <div className="shrink-0" style={{ width: rightWidth }}>
                {renderRightPanel()}
              </div>
            </div>
          ) : isTablet ? (
            <>
              <div className="min-h-0 flex-[1.15] overflow-hidden">
                {renderChartPanel("rounded-xl")}
              </div>
              <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-2">
                <div className="min-h-0 overflow-hidden">{renderNewsPanel()}</div>
                <div className="min-h-0 overflow-hidden">{renderRightPanel()}</div>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              {mobileWorkspaceTab === "news" && renderNewsPanel()}
              {mobileWorkspaceTab === "chart" && renderChartPanel("rounded-xl")}
              {mobileWorkspaceTab === "tools" && renderRightPanel()}
            </div>
          )}

          <div className={isMobile ? "" : "pt-2"}>
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
      </div>

      <div className="panel-header soft-divider flex shrink-0 flex-col gap-1 border-t px-3 py-2 text-[10px] text-zinc-500 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <span className="text-center lg:text-left">
          {wsConnected
            ? "Binance market data online • OKX • Bybit • Hyperliquid • dYdX active"
            : "Binance market data reconnecting..."}
        </span>
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center lg:justify-end">
          <span style={{ color: "#3f3f4e" }}>
            {showDesktopLayout
              ? `News ${newsWidth}px • Right ${rightWidth}px`
              : isTablet
                ? "Tablet workspace"
                : "Mobile workspace"}
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
