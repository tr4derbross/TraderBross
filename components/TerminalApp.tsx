"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
import type { ActiveVenueState, TradingVenueConnectionStatus, TradingVenueType } from "@/lib/active-venue";
import { getVenueAdapter } from "@/lib/venues";
import type { VenueConnectionInput } from "@/lib/venues/types";
import {
  connectWalletByLabel,
  disconnectWalletSession,
  formatWalletAddress,
  type ConnectedWalletSession,
  type SupportedWalletLabel,
} from "@/lib/wallet-connect";
import {
  GripVertical,
  Newspaper,
  CandlestickChart,
  PanelsTopLeft,
  Wallet,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Unplug,
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
  wallets?: SupportedWalletLabel[];
};

type HeaderConnectionState = {
  status:
    | "not_configured"
    | "saved_locally"
    | "testing"
    | "connected"
    | "failed"
    | "disconnected";
  platform: HeaderPlatform;
  walletLabel?: SupportedWalletLabel;
  address?: string;
  error?: string;
};

type PersistedHeaderConnection = {
  platform: HeaderPlatform;
  walletLabel?: SupportedWalletLabel;
  address?: string;
};

type HeaderCexCredentials = {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
};

type HeaderCexCredentialMap = Record<Extract<HeaderPlatform, "okx" | "bybit" | "binance">, HeaderCexCredentials>;
type HeaderCexPlatform = keyof HeaderCexCredentialMap;

const HEADER_PLATFORMS: HeaderPlatformMeta[] = [
  {
    id: "hyperliquid",
    label: "Hyperliquid",
    type: "wallet",
    eyebrow: "DEX Wallet",
    description: "Connect a wallet-based flow for Hyperliquid trading access.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
    wallets: ["MetaMask", "Rabby", "Coinbase Wallet", "Phantom", "Solflare"],
  },
  {
    id: "dydx",
    label: "dYdX",
    type: "wallet",
    eyebrow: "DEX Wallet",
    description: "Prepare an address or wallet-based connection flow for dYdX v4.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
    wallets: ["MetaMask", "Rabby", "Coinbase Wallet", "Phantom", "Solflare"],
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

const EMPTY_HEADER_CEX_CREDENTIALS: HeaderCexCredentialMap = {
  okx: { apiKey: "", apiSecret: "", passphrase: "" },
  bybit: { apiKey: "", apiSecret: "", passphrase: "" },
  binance: { apiKey: "", apiSecret: "", passphrase: "" },
};

function maskCredentialPreview(value: string) {
  if (!value) return "Not saved";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function hasSavedHeaderCredentials(
  platform: HeaderCexPlatform,
  credentials: HeaderCexCredentialMap
) {
  const current = credentials[platform];
  return Boolean(
    current.apiKey.trim() &&
      current.apiSecret.trim() &&
      (platform !== "okx" || current.passphrase.trim())
  );
}

function getHeaderStatusLabel(status: HeaderConnectionState["status"]) {
  switch (status) {
    case "not_configured":
      return "Not configured";
    case "saved_locally":
      return "Saved locally";
    case "testing":
      return "Testing";
    case "connected":
      return "Connected";
    case "failed":
      return "Failed";
    default:
      return "Disconnected";
  }
}

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
  const [headerConnection, setHeaderConnection] = useState<HeaderConnectionState>({
    status: "disconnected",
    platform: "hyperliquid",
  });
  const [headerActionMessage, setHeaderActionMessage] = useState("");
  const [headerCexCredentials, setHeaderCexCredentials] = useState<HeaderCexCredentialMap>(
    EMPTY_HEADER_CEX_CREDENTIALS
  );
  const [activeVenueState, setActiveVenueState] = useState<ActiveVenueState>({
    venueId: "hyperliquid",
    venueType: "wallet",
    activeSymbol: "BTC",
    connectionStatus: "disconnected",
  });
  const [venueMarketPrices, setVenueMarketPrices] = useState<
    Partial<Record<ActiveVenueState["venueId"], Record<string, number>>>
  >({});
  const { checkNewsAgainstAlerts } = useAlerts();
  const headerControlRef = useRef<HTMLDivElement | null>(null);
  const headerPanelRef = useRef<HTMLDivElement | null>(null);
  const [headerAnchorRect, setHeaderAnchorRect] = useState<DOMRect | null>(null);
  const headerWalletSessionRef = useRef<ConnectedWalletSession | null>(null);

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
    try {
      const savedPlatform = localStorage.getItem("traderbross.header-platform.v1") as HeaderPlatform | null;
      if (savedPlatform && HEADER_PLATFORMS.some((platform) => platform.id === savedPlatform)) {
        setHeaderPlatform(savedPlatform);
        setHeaderConnection((prev) => ({ ...prev, platform: savedPlatform }));
      }

      const savedConnection = localStorage.getItem("traderbross.header-connection.v1");
      if (savedConnection) {
        const parsed = JSON.parse(savedConnection) as PersistedHeaderConnection;
        if (parsed?.platform && HEADER_PLATFORMS.some((platform) => platform.id === parsed.platform)) {
          setHeaderConnection({
            status: "disconnected",
            platform: parsed.platform,
            walletLabel: parsed.walletLabel,
            address: parsed.address,
          });
        }
      }

      const savedCexCredentials = localStorage.getItem("traderbross.header-cex-credentials.v1");
      if (savedCexCredentials) {
        const parsed = JSON.parse(savedCexCredentials) as Partial<HeaderCexCredentialMap>;
        setHeaderCexCredentials({
          okx: {
            ...EMPTY_HEADER_CEX_CREDENTIALS.okx,
            ...parsed.okx,
          },
          bybit: {
            ...EMPTY_HEADER_CEX_CREDENTIALS.bybit,
            ...parsed.bybit,
          },
          binance: {
            ...EMPTY_HEADER_CEX_CREDENTIALS.binance,
            ...parsed.binance,
          },
        });
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("traderbross.header-platform.v1", headerPlatform);
    } catch {
      // ignore storage errors
    }
    setHeaderActionMessage("");
    setHeaderConnection((prev) => {
      if (prev.platform === headerPlatform) return prev;

      const nextPlatform = HEADER_PLATFORMS.find((platform) => platform.id === headerPlatform);
      if (nextPlatform?.type === "cex") {
        const cexPlatform = nextPlatform.id as HeaderCexPlatform;
        return {
          status: hasSavedHeaderCredentials(cexPlatform, headerCexCredentials)
            ? "saved_locally"
            : "not_configured",
          platform: headerPlatform,
        };
      }

      return { status: "disconnected", platform: headerPlatform };
    });
  }, [headerCexCredentials, headerPlatform]);

  useEffect(() => {
    try {
      if (headerConnection.status === "connected" && headerConnection.address) {
        localStorage.setItem(
          "traderbross.header-connection.v1",
          JSON.stringify({
            platform: headerConnection.platform,
            walletLabel: headerConnection.walletLabel,
            address: headerConnection.address,
          } satisfies PersistedHeaderConnection)
        );
      } else if (headerConnection.status === "disconnected") {
        localStorage.removeItem("traderbross.header-connection.v1");
      }
    } catch {
      // ignore storage errors
    }
  }, [headerConnection]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "traderbross.header-cex-credentials.v1",
        JSON.stringify(headerCexCredentials)
      );
    } catch {
      // ignore storage errors
    }
  }, [headerCexCredentials]);

  useEffect(() => {
    const venueMeta = HEADER_PLATFORMS.find((platform) => platform.id === headerPlatform) ?? HEADER_PLATFORMS[0];
    const nextConnectionStatus: TradingVenueConnectionStatus =
      headerConnection.platform === headerPlatform ? headerConnection.status : "disconnected";
    const nextVenueType: TradingVenueType = venueMeta.type;

    setActiveVenueState((prev) => ({
      ...prev,
      venueId: headerPlatform,
      venueType: nextVenueType,
      activeSymbol: chartTicker,
      connectionStatus: nextConnectionStatus,
    }));
  }, [chartTicker, headerConnection, headerPlatform]);

  useEffect(() => {
    return () => {
      headerWalletSessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!headerConnectOpen) return;

    const syncAnchor = () => {
      setHeaderAnchorRect(headerControlRef.current?.getBoundingClientRect() ?? null);
    };
    syncAnchor();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !headerControlRef.current?.contains(target) &&
        !headerPanelRef.current?.contains(target)
      ) {
        setHeaderConnectOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHeaderConnectOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [headerConnectOpen]);

  const { prices: wsPrices, quotes: wsQuotes, connected: wsConnected } = useBinanceWs();

  useEffect(() => {
    const loadVenueMarketData = async () => {
      const [okxRes, bybitRes, hyperliquidRes, dydxRes] = await Promise.allSettled([
        Promise.all(
          AVAILABLE_TICKERS.map(async (symbol) => [symbol, await getVenueAdapter("okx").getTicker(symbol)] as const)
        ),
        Promise.all(
          AVAILABLE_TICKERS.map(async (symbol) => [symbol, await getVenueAdapter("bybit").getTicker(symbol)] as const)
        ),
        Promise.all(
          AVAILABLE_TICKERS.map(async (symbol) => [symbol, await getVenueAdapter("hyperliquid").getTicker(symbol)] as const)
        ),
        Promise.all(
          AVAILABLE_TICKERS.map(async (symbol) => [symbol, await getVenueAdapter("dydx").getTicker(symbol)] as const)
        ),
      ]);

      const quoteMap = (entries: Array<readonly [string, { price: number } | null]>) =>
        Object.fromEntries(entries.filter(([, quote]) => quote).map(([symbol, quote]) => [symbol, quote!.price]));

      setVenueMarketPrices({
        binance: wsPrices,
        okx: okxRes.status === "fulfilled" ? quoteMap(okxRes.value) : {},
        bybit: bybitRes.status === "fulfilled" ? quoteMap(bybitRes.value) : {},
        hyperliquid: hyperliquidRes.status === "fulfilled" ? quoteMap(hyperliquidRes.value) : {},
        dydx: dydxRes.status === "fulfilled" ? quoteMap(dydxRes.value) : {},
      });
    };

    void loadVenueMarketData();
    const intervalId = setInterval(loadVenueMarketData, 15_000);
    return () => clearInterval(intervalId);
  }, [wsPrices]);
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
        setActiveSymbol(match);
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
    setActiveSymbol(ticker);
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
  const isHeaderWalletPlatform = selectedHeaderPlatform.type === "wallet";
  const isActiveHeaderConnection =
    headerConnection.platform === headerPlatform && headerConnection.status === "connected";
  const selectedHeaderCexPlatform = !isHeaderWalletPlatform
    ? (selectedHeaderPlatform.id as HeaderCexPlatform)
    : null;
  const selectedHeaderCredentials =
    selectedHeaderCexPlatform ? headerCexCredentials[selectedHeaderCexPlatform] : null;
  const activeVenuePriceMap =
    venueMarketPrices[activeVenueState.venueId] ?? (activeVenueState.venueId === "binance" ? wsPrices : {});
  const activeVenueMarketLabel = getVenueAdapter(activeVenueState.venueId).marketDataLabel;

  const setActiveSymbol = useCallback((symbol: string) => {
    setChartTicker(symbol);
    setActiveVenueState((prev) => ({
      ...prev,
      activeSymbol: symbol,
    }));
  }, []);

  const buildActiveVenueConnection = useCallback((): VenueConnectionInput | undefined => {
    if (activeVenueState.venueType === "cex" && selectedHeaderCexPlatform && selectedHeaderCredentials) {
      return {
        apiKey: selectedHeaderCredentials.apiKey.trim(),
        apiSecret: selectedHeaderCredentials.apiSecret.trim(),
        passphrase: selectedHeaderCredentials.passphrase.trim(),
      };
    }

    if (activeVenueState.venueType === "wallet") {
      return {
        walletAddress:
          headerConnection.platform === activeVenueState.venueId ? headerConnection.address : undefined,
        walletProvider:
          headerConnection.platform === activeVenueState.venueId ? headerConnection.walletLabel : undefined,
      };
    }

    return undefined;
  }, [
    activeVenueState.venueId,
    activeVenueState.venueType,
    headerConnection.address,
    headerConnection.platform,
    headerConnection.walletLabel,
    selectedHeaderCexPlatform,
    selectedHeaderCredentials,
  ]);

  const routeOrderThroughVenue = useCallback(
    async (
      ticker: string,
      side: "long" | "short",
      type: "market" | "limit" | "stop",
      marginAmount: number,
      leverage: number,
      marginMode: "isolated" | "cross",
      limitPrice?: number,
      tpPrice?: number,
      slPrice?: number
    ) => {
      if (!ticker || marginAmount <= 0 || leverage <= 0) {
        return { ok: false, message: "Invalid order input." };
      }

      if (activeVenueState.connectionStatus !== "connected") {
        return {
          ok: false,
          message: `${activeVenueState.venueId.toUpperCase()} is not connected.`,
        };
      }

      const adapter = getVenueAdapter(activeVenueState.venueId);
      const connection = buildActiveVenueConnection();

      const result = await adapter.placeOrder(
        {
          symbol: ticker,
          side,
          type,
          marginAmount,
          leverage,
          limitPrice,
          tpPrice,
          slPrice,
        },
        connection
      );

      return result.ok
        ? { ok: true, message: `${adapter.id.toUpperCase()} accepted the order request.` }
        : { ok: false, message: result.message };
    },
    [activeVenueState.connectionStatus, activeVenueState.venueId, buildActiveVenueConnection]
  );

  const disconnectHeaderWallet = useCallback(async () => {
    const activeSession = headerWalletSessionRef.current;
    headerWalletSessionRef.current = null;
    setHeaderActionMessage("");

    setHeaderConnection((prev) => ({
      status: "disconnected",
      platform: prev.platform,
      walletLabel: prev.walletLabel,
      address: undefined,
    }));

    if (activeSession) {
      try {
        await disconnectWalletSession(activeSession);
      } catch {
        // provider disconnect may be best-effort
      }
    }

    if (headerConnection.platform === "hyperliquid") {
      setHlWallet("");
    }
  }, [headerConnection.platform]);

  const connectHeaderWallet = useCallback(
    async (walletLabel: SupportedWalletLabel) => {
      setHeaderActionMessage("");
      setHeaderConnection({
        status: "testing",
        platform: headerPlatform,
        walletLabel,
      });

      const previousSession = headerWalletSessionRef.current;
      if (previousSession) {
        try {
          await disconnectWalletSession(previousSession);
        } catch {
          // best effort before switching
        }
      }

      try {
        const session = await connectWalletByLabel(walletLabel);
        headerWalletSessionRef.current = session;
        console.info("[TraderBross Header Wallet]", "connected", headerPlatform, walletLabel, session.address);

        setHeaderConnection({
          status: "connected",
          platform: headerPlatform,
          walletLabel,
          address: session.address,
        });

        if (headerPlatform === "hyperliquid") {
          setHlWallet(session.address);
        }
      } catch (error) {
        headerWalletSessionRef.current = null;
        console.info("[TraderBross Header Wallet]", "failed", headerPlatform, walletLabel, error);
        setHeaderConnection({
          status: "failed",
          platform: headerPlatform,
          walletLabel,
          error: error instanceof Error ? error.message : "Wallet connection failed.",
        });
      }
    },
    [headerPlatform]
  );

  const runHeaderCexAction = useCallback(() => {
    if (selectedHeaderPlatform.type !== "cex") return;

    const creds = headerCexCredentials[selectedHeaderPlatform.id as HeaderCexPlatform];
    const hasRequired = hasSavedHeaderCredentials(
      selectedHeaderPlatform.id as HeaderCexPlatform,
      headerCexCredentials
    );

    setHeaderActionMessage(
      hasRequired
        ? `${selectedHeaderPlatform.label} credentials saved locally for MVP setup.`
        : selectedHeaderPlatform.id === "okx"
          ? "Add API key, secret, and passphrase to save OKX credentials."
          : "Add API key and secret to save these credentials locally."
    );
    setHeaderConnection({
      status: hasRequired ? "saved_locally" : "failed",
      platform: headerPlatform,
      error: hasRequired ? undefined : "Missing required API credentials.",
    });
  }, [headerCexCredentials, headerPlatform, selectedHeaderPlatform]);

  const removeHeaderCexCredentials = useCallback(() => {
    if (selectedHeaderPlatform.type !== "cex") return;

    setHeaderCexCredentials((prev) => ({
      ...prev,
      [selectedHeaderPlatform.id]: { apiKey: "", apiSecret: "", passphrase: "" },
    }));
    setHeaderActionMessage(`${selectedHeaderPlatform.label} credentials removed from this device.`);
    setHeaderConnection({
      status: "not_configured",
      platform: headerPlatform,
    });
  }, [headerPlatform, selectedHeaderPlatform]);

  const testHeaderCexConnection = useCallback(async () => {
    if (!selectedHeaderCexPlatform || !selectedHeaderCredentials) return;

    const hasRequired = hasSavedHeaderCredentials(selectedHeaderCexPlatform, headerCexCredentials);
    if (!hasRequired) {
      setHeaderConnection({
        status: "failed",
        platform: headerPlatform,
        error: "Missing required API credentials.",
      });
      setHeaderActionMessage(
        selectedHeaderCexPlatform === "okx"
          ? "OKX needs API key, API secret, and passphrase before testing."
          : "API key and secret are required before testing."
      );
      return;
    }

    setHeaderActionMessage("");
    setHeaderConnection({
      status: "testing",
      platform: headerPlatform,
    });

    try {
      const result = await getVenueAdapter(selectedHeaderCexPlatform).testConnection({
        apiKey: selectedHeaderCredentials.apiKey.trim(),
        apiSecret: selectedHeaderCredentials.apiSecret.trim(),
        passphrase: selectedHeaderCredentials.passphrase.trim(),
      });

      if (result.ok) {
        setHeaderConnection({
          status: "connected",
          platform: headerPlatform,
        });
        setHeaderActionMessage(
          result.detail || result.message || `${selectedHeaderPlatform.label} credentials verified.`
        );
        return;
      }

      setHeaderConnection({
        status: "failed",
        platform: headerPlatform,
        error: result.message || "Credential validation failed.",
      });
      setHeaderActionMessage(result.message || "Credential validation failed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credential validation failed.";
      setHeaderConnection({
        status: "failed",
        platform: headerPlatform,
        error: message,
      });
      setHeaderActionMessage(message);
    }
  }, [
    headerCexCredentials,
    headerPlatform,
    selectedHeaderCredentials,
    selectedHeaderCexPlatform,
    selectedHeaderPlatform.label,
  ]);

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
          activeVenueState={activeVenueState}
          selectedNews={selectedItem}
          balance={balance}
          positions={positions}
          prices={activeVenuePriceMap}
          marketDataSourceLabel={activeVenueMarketLabel}
          onActiveSymbolChange={setActiveSymbol}
          onPlaceOrder={routeOrderThroughVenue}
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
            setActiveSymbol(ticker);
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
        <div ref={headerControlRef} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-4">
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
      {headerConnectOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[120] bg-transparent" />
            <div
              ref={headerPanelRef}
              className="panel-shell-alt fixed z-[130] border p-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
              style={
                isMobile
                  ? {
                      left: 12,
                      right: 12,
                      top: 84,
                      borderRadius: 20,
                    }
                  : {
                      top: (headerAnchorRect?.bottom ?? 80) + 12,
                      left: Math.max(12, (headerAnchorRect?.right ?? 360) - 360),
                      width: Math.min(360, viewportWidth - 24),
                      borderRadius: 20,
                    }
              }
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Connect Platform</div>
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
                      setHeaderActionMessage("");
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="brand-badge brand-badge-gold rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.14em]">
                    {isHeaderWalletPlatform ? "Wallet Flow" : "API Flow"}
                  </span>
                  <span className="text-[11px] font-semibold text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
                  <span
                    className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                      headerConnection.platform === headerPlatform && headerConnection.status === "connected"
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : headerConnection.platform === headerPlatform && headerConnection.status === "testing"
                          ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                          : headerConnection.platform === headerPlatform && headerConnection.status === "saved_locally"
                            ? "border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.1)] text-amber-100"
                            : headerConnection.platform === headerPlatform && headerConnection.status === "failed"
                              ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
                              : headerConnection.platform === headerPlatform &&
                                  headerConnection.status === "not_configured"
                                ? "border-white/10 bg-white/5 text-zinc-500"
                                : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {headerConnection.platform === headerPlatform
                      ? getHeaderStatusLabel(headerConnection.status)
                      : "Disconnected"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                  {selectedHeaderPlatform.description}
                </p>

                {isHeaderWalletPlatform ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedHeaderPlatform.wallets?.map((walletLabel) => {
                        const isConnecting =
                          headerConnection.platform === headerPlatform &&
                          headerConnection.status === "testing" &&
                          headerConnection.walletLabel === walletLabel;

                        return (
                          <button
                            key={walletLabel}
                            type="button"
                            onClick={() => connectHeaderWallet(walletLabel)}
                            disabled={headerConnection.status === "testing"}
                            className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                              isActiveHeaderConnection && headerConnection.walletLabel === walletLabel
                                ? "border-emerald-400/20 bg-emerald-500/10"
                                : "border-[rgba(255,255,255,0.06)] bg-[#111317] hover:bg-[rgba(212,161,31,0.05)]"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-[#f3ead7]">{walletLabel}</span>
                              {isConnecting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-200" />
                              ) : isActiveHeaderConnection && headerConnection.walletLabel === walletLabel ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-300" />
                              ) : null}
                            </div>
                            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                              Direct wallet request
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0c0f13] px-3 py-2.5">
                      {headerConnection.platform === headerPlatform && headerConnection.status === "connected" ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Connected Wallet</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold text-emerald-100">
                                {headerConnection.walletLabel}
                              </span>
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                                {formatWalletAddress(headerConnection.address ?? "")}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={disconnectHeaderWallet}
                            className="terminal-chip inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                          >
                            <Unplug className="h-3.5 w-3.5" />
                            Disconnect
                          </button>
                        </div>
                      ) : headerConnection.platform === headerPlatform &&
                        headerConnection.status === "failed" ? (
                        <div className="flex items-start gap-2 text-[10px] text-rose-200">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{headerConnection.error ?? "Wallet connection failed."}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-400">
                          Pick a wallet above to trigger a direct connection request inside this header flow.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 space-y-2.5">
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                          API Key
                        </span>
                        <input
                          type="text"
                          value={selectedHeaderCredentials?.apiKey ?? ""}
                          onChange={(event) =>
                            setHeaderCexCredentials((prev) => ({
                              ...prev,
                              [selectedHeaderCexPlatform as HeaderCexPlatform]: {
                                ...prev[selectedHeaderCexPlatform as HeaderCexPlatform],
                                apiKey: event.target.value,
                              },
                            }))
                          }
                          placeholder={`${selectedHeaderPlatform.label} API key`}
                          className="terminal-input w-full rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                          API Secret
                        </span>
                        <input
                          type="password"
                          value={selectedHeaderCredentials?.apiSecret ?? ""}
                          onChange={(event) =>
                            setHeaderCexCredentials((prev) => ({
                              ...prev,
                              [selectedHeaderCexPlatform as HeaderCexPlatform]: {
                                ...prev[selectedHeaderCexPlatform as HeaderCexPlatform],
                                apiSecret: event.target.value,
                              },
                            }))
                          }
                          placeholder={`${selectedHeaderPlatform.label} API secret`}
                          className="terminal-input w-full rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                          Passphrase {selectedHeaderPlatform.id === "okx" ? "" : "(Optional)"}
                        </span>
                        <input
                          type="password"
                          value={selectedHeaderCredentials?.passphrase ?? ""}
                          onChange={(event) =>
                            setHeaderCexCredentials((prev) => ({
                              ...prev,
                              [selectedHeaderCexPlatform as HeaderCexPlatform]: {
                                ...prev[selectedHeaderCexPlatform as HeaderCexPlatform],
                                passphrase: event.target.value,
                              },
                            }))
                          }
                          placeholder={
                            selectedHeaderPlatform.id === "okx"
                              ? "Required for OKX"
                              : "Optional passphrase"
                          }
                          className="terminal-input w-full rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={runHeaderCexAction}
                        className="brand-chip-active rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={testHeaderCexConnection}
                        className="terminal-chip rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                      >
                        Test Connection
                      </button>
                      <button
                        type="button"
                        onClick={removeHeaderCexCredentials}
                        className="terminal-chip rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0c0f13] px-3 py-2.5 text-[10px] text-zinc-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-500">Saved Key</span>
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] text-[#f3ead7]">
                          {maskCredentialPreview(selectedHeaderCredentials?.apiKey ?? "")}
                        </span>
                        <span className="text-zinc-500">Secret</span>
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] text-[#f3ead7]">
                          {maskCredentialPreview(selectedHeaderCredentials?.apiSecret ?? "")}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] text-zinc-400">
                        {headerActionMessage ||
                          "Credentials stay inside this header flow and are stored locally for MVP setup only."}
                      </div>
                      {headerConnection.platform === headerPlatform && headerConnection.status === "failed" && (
                        <div className="mt-2 text-[10px] text-rose-200">
                          {headerConnection.error || "Credential validation failed."}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
