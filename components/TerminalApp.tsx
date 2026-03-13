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
  GripVertical,
  Newspaper,
  CandlestickChart,
  PanelsTopLeft,
  Wallet,
  X,
} from "lucide-react";

type RightTab = "trade" | "dex" | "alerts" | "connect" | "watch";
type DexSubTab = "hl" | "dydx";
type WorkspaceTab = "news" | "chart" | "tools";
type HeaderPlatform = "hyperliquid" | "dydx" | "okx" | "bybit" | "binance";
type HeaderPlatformMeta = {
  id: HeaderPlatform;
  label: string;
  type: "wallet" | "cex";
  eyebrow: string;
  description: string;
  primaryAction: string;
  secondaryAction?: string;
};

const HEADER_PLATFORMS: HeaderPlatformMeta[] = [
  {
    id: "hyperliquid",
    label: "Hyperliquid",
    type: "wallet",
    eyebrow: "DEX Wallet",
    description: "Connect a wallet-based flow for Hyperliquid trading access.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
  },
  {
    id: "dydx",
    label: "dYdX",
    type: "wallet",
    eyebrow: "DEX Wallet",
    description: "Prepare an address or wallet-based connection flow for dYdX v4.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
  },
  {
    id: "okx",
    label: "OKX",
    type: "cex",
    eyebrow: "CEX API",
    description: "Store API credentials locally and test venue readiness for OKX.",
    primaryAction: "Start API Setup",
  },
  {
    id: "bybit",
    label: "Bybit",
    type: "cex",
    eyebrow: "CEX API",
    description: "Configure Bybit API access for future account and execution workflows.",
    primaryAction: "Start API Setup",
  },
  {
    id: "binance",
    label: "Binance",
    type: "cex",
    eyebrow: "CEX API",
    description: "Prepare Binance connectivity with a compact setup flow in the header.",
    primaryAction: "Start API Setup",
  },
];

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
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<WorkspaceTab>("chart");
  const [headerPlatform, setHeaderPlatform] = useState<HeaderPlatform>("hyperliquid");
  const [headerConnectOpen, setHeaderConnectOpen] = useState(false);
  const [headerConnectStatus, setHeaderConnectStatus] = useState<string>("");
  const { checkNewsAgainstAlerts } = useAlerts();
  const headerPopoverRef = useRef<HTMLDivElement | null>(null);

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
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!headerConnectOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!headerPopoverRef.current?.contains(event.target as Node)) {
        setHeaderConnectOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [headerConnectOpen]);

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
        if (showDesktopLayout) {
          setMobileWorkspaceTab("chart");
        } else {
          setMobileWorkspaceTab("tools");
        }
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
  const showBottomPanel = !isMobile || mobileWorkspaceTab !== "tools";
  const selectedHeaderPlatform =
    HEADER_PLATFORMS.find((platform) => platform.id === headerPlatform) ?? HEADER_PLATFORMS[0];

  const runHeaderConnectAction = (mode: "primary" | "secondary" = "primary") => {
    const actionLabel =
      mode === "secondary"
        ? selectedHeaderPlatform.secondaryAction ?? selectedHeaderPlatform.primaryAction
        : selectedHeaderPlatform.primaryAction;

    setHeaderConnectStatus(
      selectedHeaderPlatform.type === "wallet"
        ? `${selectedHeaderPlatform.label}: ${actionLabel} flow ready`
        : `${selectedHeaderPlatform.label}: compact API setup ready`
    );
  };

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
      <div className="panel-header brand-aura soft-divider status-glow relative z-40 flex shrink-0 items-center justify-center overflow-visible border-b px-3 py-3 sm:px-4 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(212,161,31,0.55),transparent)]">
        <div className="relative z-10 flex items-center justify-center px-2">
          <BrandMark className="mx-auto" />
        </div>
        <div ref={headerPopoverRef} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-4">
          <div className="panel-shell-alt flex items-center gap-1.5 rounded-2xl px-2 py-1.5">
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="brand-chip-active inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em]"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Wallet Connect</span>
              <span className="sm:hidden">Connect</span>
            </button>
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="terminal-chip inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]"
            >
              <span className="hidden md:inline text-zinc-500">{selectedHeaderPlatform.eyebrow}</span>
              <span className="text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
            </button>
          </div>

          {headerConnectOpen && (
            <div className="panel-shell-alt absolute right-0 mt-3 w-[min(92vw,360px)] rounded-2xl border p-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Header Connect</div>
                  <div className="mt-1 text-sm font-semibold text-[#f5efe1]">Platform Access</div>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-400">
                    Choose a platform and start the relevant connection flow directly from the header.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHeaderConnectOpen(false)}
                  className="rounded-full border border-white/8 p-2 text-zinc-500 transition-colors hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {HEADER_PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      setHeaderPlatform(platform.id);
                      setHeaderConnectStatus("");
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      headerPlatform === platform.id
                        ? "border-[rgba(212,161,31,0.26)] bg-[rgba(212,161,31,0.12)]"
                        : "border-[rgba(255,255,255,0.06)] bg-[#111317] hover:bg-[rgba(212,161,31,0.05)]"
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">{platform.eyebrow}</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#f3ead7]">{platform.label}</div>
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-[rgba(212,161,31,0.12)] bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="brand-badge brand-badge-gold rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.14em]">
                    {selectedHeaderPlatform.type === "wallet" ? "Wallet Flow" : "API Flow"}
                  </span>
                  <span className="text-[11px] font-semibold text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                  {selectedHeaderPlatform.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runHeaderConnectAction("primary")}
                    className="brand-chip-active rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                  >
                    {selectedHeaderPlatform.primaryAction}
                  </button>
                  {selectedHeaderPlatform.secondaryAction && (
                    <button
                      type="button"
                      onClick={() => runHeaderConnectAction("secondary")}
                      className="terminal-chip rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                    >
                      {selectedHeaderPlatform.secondaryAction}
                    </button>
                  )}
                </div>

                {headerConnectStatus && (
                  <div className="mt-3 rounded-xl border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.06)] px-3 py-2 text-[10px] text-amber-100">
                    {headerConnectStatus}
                  </div>
                )}
              </div>
            </div>
          )}
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

          {showBottomPanel && (
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
          )}
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
