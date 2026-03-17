"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { NewsItem, AVAILABLE_TICKERS } from "@/lib/mock-data";
import { useAlerts } from "@/hooks/useAlerts";
import { useBinanceWs } from "@/hooks/useBinanceWs";
import { useVenueMarketData } from "@/hooks/useVenueMarketData";
import { getTickerDisplayPrice } from "@/lib/market-data/shared";
import TickerTape from "@/components/TickerTape";
import NewsFeed from "@/components/NewsFeed";
import PriceChart from "@/components/PriceChart";
import AlertPanel from "@/components/AlertPanel";
import TradingPanel from "@/components/TradingPanel";
import BottomPanel from "@/components/BottomPanel";
import TradingActivityDrawer from "@/components/TradingActivityDrawer";
import HyperliquidPanel from "@/components/HyperliquidPanel";
import DydxPanel from "@/components/DydxPanel";
import VenuesPanel from "@/components/VenuesPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import ChatPanel from "@/components/ChatPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FearGreedPill } from "@/components/FearGreedWidget";
import { useFearGreed } from "@/hooks/useFearGreed";
import { apiFetch } from "@/lib/api-client";
import { buildApiUrl } from "@/lib/runtime-env";
import { useRealtimeSelector } from "@/lib/realtime-client";
import BrandMark from "@/components/BrandMark";
import MarketStatsBar from "@/components/MarketStatsBar";
import MarketSessionBar from "@/components/MarketSessionBar";
import { useTradingState } from "@/hooks/useTradingState";
import type { Position } from "@/hooks/useTradingState";
import type { ActiveVenueState, TradingVenueConnectionStatus, TradingVenueType } from "@/lib/active-venue";
import { getVenueAdapter } from "@/lib/venues";
import type { VenueBalance, VenueConnectionInput, VenuePosition } from "@/lib/venues/types";
import { validateExecutionRequest } from "@/lib/execution-validation";
import type { NewsTradePreset } from "@/lib/news-trade";
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
  Layers,
} from "lucide-react";

type RightTab = "trade" | "dex" | "connect" | "watch" | "ai";
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
  comingSoon?: boolean;
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
type NewsTradeIntent = NewsTradePreset & { sourceItemId: string };

const HEADER_PLATFORMS: HeaderPlatformMeta[] = [
  {
    id: "hyperliquid",
    label: "Hyperliquid",
    type: "wallet",
    eyebrow: "DEX · Live",
    description: "Step 1: Connect your main wallet (MetaMask, Rabby…) to view read-only balance and positions. Step 2: Enter your Hyperliquid API wallet private key below to enable in-terminal order placement.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
    wallets: ["MetaMask", "Rabby", "Coinbase Wallet", "Phantom", "Solflare"],
  },
  {
    id: "dydx",
    label: "dYdX",
    type: "wallet",
    eyebrow: "DEX · Live",
    description: "dYdX v4 trading with Keplr wallet and STARK key signing is coming soon.",
    primaryAction: "Connect Wallet",
    secondaryAction: "Wallet Menu",
    wallets: ["MetaMask", "Rabby", "Coinbase Wallet", "Phantom", "Solflare"],
    comingSoon: true,
  },
  {
    id: "okx",
    label: "OKX",
    type: "cex",
    eyebrow: "CEX API",
    description: "OKX API integration — balance, position, and order management coming soon.",
    primaryAction: "Start API Setup",
    comingSoon: true,
  },
  {
    id: "bybit",
    label: "Bybit",
    type: "cex",
    eyebrow: "CEX API",
    description: "Bybit API integration — full account access and order routing coming soon.",
    primaryAction: "Start API Setup",
    comingSoon: true,
  },
  {
    id: "binance",
    label: "Binance",
    type: "cex",
    eyebrow: "CEX API · Live",
    description: "Binance Futures — real order placement via HMAC-SHA256 signed requests. API keys are encrypted server-side (AES-256). Never grant withdrawal permissions on keys used here.",
    primaryAction: "Save API Keys",
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

export default function TerminalApp({ initialTicker }: { initialTicker?: string } = {}) {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("trade");
  const [dexSubTab, setDexSubTab] = useState<DexSubTab>("hl");
  const [hlWallet, setHlWallet] = useState("");
  const [hlVaultToken, setHlVaultToken] = useState<string>("");
  const [hlPrivateKeyInput, setHlPrivateKeyInput] = useState<string>("");
  const [hlKeyStatus, setHlKeyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
  /** Server-side vault session tokens — stored in sessionStorage, NOT localStorage */
  const [vaultTokens, setVaultTokens] = useState<Partial<Record<HeaderCexPlatform, string>>>({});
  const [binanceTestnet, setBinanceTestnet] = useState(false);
  const [newsTradeIntent, setNewsTradeIntent] = useState<NewsTradeIntent | null>(null);
  const [activeVenueState, setActiveVenueState] = useState<ActiveVenueState>({
    venueId: "hyperliquid",
    venueType: "wallet",
    activeSymbol: initialTicker && AVAILABLE_TICKERS.includes(initialTicker) ? initialTicker : "BTC",
    connectionStatus: "disconnected",
  });
  const { checkNewsAgainstAlerts, checkPriceAlerts } = useAlerts();
  const headerControlRef = useRef<HTMLDivElement | null>(null);
  const headerPanelRef = useRef<HTMLDivElement | null>(null);
  const [headerAnchorRect, setHeaderAnchorRect] = useState<DOMRect | null>(null);
  const headerWalletSessionRef = useRef<ConnectedWalletSession | null>(null);

  const [newsWidth, setNewsWidth] = useState(370);
  const [rightWidth, setRightWidth] = useState(340);

  const resizeNews = useCallback(
    (dx: number) => setNewsWidth((w) => Math.max(240, Math.min(580, w + dx))),
    []
  );
  const resizeRight = useCallback(
    (dx: number) => setRightWidth((w) => Math.max(280, Math.min(520, w - dx))),
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
          // Restore hlWallet so HyperliquidPanel can show read-only account data on reload
          if (parsed.platform === "hyperliquid" && parsed.address) {
            setHlWallet(parsed.address);
          }
        }
      }

      // Load vault tokens from sessionStorage (tokens are safe to persist — they're just UUIDs)
      const cexPlatforms: HeaderCexPlatform[] = ["okx", "bybit", "binance"];
      const loadedTokens: Partial<Record<HeaderCexPlatform, string>> = {};
      for (const platform of cexPlatforms) {
        const token = sessionStorage.getItem(`traderbross.vault-token.${platform}.v1`);
        if (token) loadedTokens[platform] = token;
      }
      if (Object.keys(loadedTokens).length > 0) {
        setVaultTokens(loadedTokens);
      }

      const hlToken = sessionStorage.getItem("traderbross.vault-token.hyperliquid.v1");
      if (hlToken) {
        setHlVaultToken(hlToken);
        setHeaderConnection({ status: "connected", platform: "hyperliquid" });
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
        const hasVaultToken = Boolean(vaultTokens[cexPlatform]);
        const hasRawCreds = hasSavedHeaderCredentials(cexPlatform, headerCexCredentials);
        return {
          status: (hasVaultToken || hasRawCreds) ? "saved_locally" : "not_configured",
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

  // NOTE: Raw CEX credentials are intentionally NOT persisted to localStorage.
  // Credentials are stored server-side (encrypted) via /api/vault/store.
  // Only vault session tokens are persisted (in sessionStorage).

  useEffect(() => {
    const venueMeta = HEADER_PLATFORMS.find((platform) => platform.id === headerPlatform) ?? HEADER_PLATFORMS[0];
    const nextConnectionStatus: TradingVenueConnectionStatus =
      headerConnection.platform === headerPlatform ? headerConnection.status : "disconnected";
    const nextVenueType: TradingVenueType = venueMeta.type;

    setActiveVenueState((prev) => ({
      ...prev,
      venueId: headerPlatform,
      venueType: nextVenueType,
      connectionStatus: nextConnectionStatus,
    }));
  }, [headerConnection, headerPlatform]);

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

  // Check price alerts whenever live quotes update
  useEffect(() => {
    if (wsQuotes.length > 0) checkPriceAlerts(wsQuotes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsQuotes]);
  const { data: fearGreedData } = useFearGreed();
  const { ticker: activeVenueTicker, connectionState: activeVenueFeedState } = useVenueMarketData(
    activeVenueState.venueId,
    activeVenueState.activeSymbol
  );
  const backendVenueQuotes = useRealtimeSelector((state) => state.venueQuotes);
  const venueMarketPrices = useMemo<
    Partial<Record<ActiveVenueState["venueId"], Record<string, number>>>
  >(
    () => ({
      binance: wsPrices,
      okx: Object.fromEntries(backendVenueQuotes.OKX.map((quote) => [quote.symbol, quote.price])),
      bybit: Object.fromEntries(backendVenueQuotes.Bybit.map((quote) => [quote.symbol, quote.price])),
      hyperliquid: wsPrices,
      dydx: wsPrices,
    }),
    [backendVenueQuotes.Bybit, backendVenueQuotes.OKX, wsPrices],
  );
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

  // ── Real venue balance + positions (overwrites paper state when connected) ──
  const [venueBalance, setVenueBalance] = useState<VenueBalance | null>(null);
  const [venuePositions, setVenuePositions] = useState<VenuePosition[] | null>(null);
  const [venueRefreshTick, setVenueRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchVenueData = async () => {
      const isConnected =
        activeVenueState.connectionStatus === "connected" ||
        activeVenueState.connectionStatus === "saved_locally";

      if (!isConnected) {
        setVenueBalance(null);
        setVenuePositions(null);
        return;
      }

      try {
        const connection = buildActiveVenueConnection();
        const adapter = getVenueAdapter(activeVenueState.venueId);
        const [balance, pos] = await Promise.all([
          adapter.getBalance(connection),
          adapter.getPositions(connection),
        ]);
        if (!cancelled) {
          setVenueBalance(balance);
          // null = not fetched yet (show paper), array = real data (even if empty)
          setVenuePositions(pos);
        }
      } catch {
        if (!cancelled) {
          setVenueBalance(null);
          setVenuePositions(null);
        }
      }
    };

    void fetchVenueData();

    // Poll every 10s while connected
    const pollInterval = setInterval(() => {
      void fetchVenueData();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVenueState.venueId, activeVenueState.connectionStatus, hlVaultToken, vaultTokens, venueRefreshTick]);

  // Use real venue balance/positions if available, otherwise paper trading state
  const displayBalance = venueBalance != null
    ? (venueBalance.available ?? venueBalance.total)
    : balance;
  const displayPositions: Position[] = useMemo(() => {
    if (!venuePositions) return positions;
    return venuePositions.map((p): Position => {
      // Derive current mark price: use live ws price if available, else back-compute from pnl
      const markPrice = wsPrices[p.symbol] ??
        (p.size > 0
          ? p.side === "long"
            ? p.entryPrice + (p.pnl ?? 0) / p.size
            : p.entryPrice - (p.pnl ?? 0) / p.size
          : p.entryPrice);
      const lev = p.leverage ?? 1;
      return {
        id: `${p.symbol}_${p.side}`,
        ticker: p.symbol,
        side: p.side,
        amount: p.size,
        entryPrice: p.entryPrice,
        currentPrice: markPrice,
        leverage: lev,
        margin: (p.size * p.entryPrice) / lev,
        marginMode: p.marginMode ?? "isolated",
        liquidationPrice: p.liquidationPrice ?? 0,
        tpPrice: undefined,
        slPrice: undefined,
        timestamp: new Date(),
      };
    });
  }, [venuePositions, positions, wsPrices]);

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

  const handleNewsQuickTrade = (preset: NewsTradePreset, item: NewsItem) => {
    setSelectedItem(item);
    setActiveSymbol(preset.symbol);
    setRightTab("trade");
    setNewsTradeIntent({
      ...preset,
      sourceItemId: item.id,
    });

    if (!showDesktopLayout) {
      setMobileWorkspaceTab("tools");
    }
  };

  const tabs: { id: RightTab; label: string }[] = [
    { id: "trade", label: "Trade" },
    { id: "dex", label: "DEX" },
    { id: "connect", label: "Venues" },
    { id: "watch", label: "Watch" },
    { id: "ai", label: "AI" },
  ];

  const [watchSubTab, setWatchSubTab] = useState<"watchlist" | "alerts">("watchlist");

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
    {
      ...(venueMarketPrices[activeVenueState.venueId] ?? (activeVenueState.venueId === "binance" ? wsPrices : {})),
      ...(activeVenueTicker
        ? {
            [activeVenueTicker.symbol]:
              getTickerDisplayPrice(activeVenueTicker) ??
              venueMarketPrices[activeVenueState.venueId]?.[activeVenueTicker.symbol] ??
              0,
          }
        : {}),
    };
  const activeVenueMarketLabel = getVenueAdapter(activeVenueState.venueId).marketDataLabel;

  const setActiveSymbol = useCallback((symbol: string) => {
    setActiveVenueState((prev) => ({
      ...prev,
      activeSymbol: symbol,
    }));
  }, []);

  const buildActiveVenueConnection = useCallback((): VenueConnectionInput | undefined => {
    if (activeVenueState.venueType === "cex" && selectedHeaderCexPlatform) {
      const token = vaultTokens[selectedHeaderCexPlatform];
      if (token) {
        // Preferred: vault token — raw keys stay on the server
        return { sessionToken: token };
      }
      // Fallback: raw credentials (only if user hasn't saved to vault yet)
      if (selectedHeaderCredentials) {
        return {
          apiKey: selectedHeaderCredentials.apiKey.trim(),
          apiSecret: selectedHeaderCredentials.apiSecret.trim(),
          passphrase: selectedHeaderCredentials.passphrase.trim(),
        };
      }
    }

    if (activeVenueState.venueType === "wallet") {
      if (activeVenueState.venueId === "hyperliquid" && hlVaultToken) {
        return { walletAddress: hlWallet, sessionToken: hlVaultToken };
      }
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
    hlVaultToken,
    hlWallet,
    selectedHeaderCexPlatform,
    selectedHeaderCredentials,
    vaultTokens,
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
      const adapter = getVenueAdapter(activeVenueState.venueId);
      const validation = validateExecutionRequest(activeVenueState, adapter, {
        ticker,
        side,
        type,
        marginAmount,
        leverage,
        marginMode,
        limitPrice,
        tpPrice,
        slPrice,
        balance: displayBalance,
      });

      if (!validation.ok) {
        return { ok: false, message: validation.message };
      }

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

      if (result.ok) {
        // Trigger a positions refresh ~2s after the order is accepted
        setTimeout(() => setVenueRefreshTick((t) => t + 1), 2000);
      }

      return result.ok
        ? { ok: true, message: `${adapter.id.toUpperCase()} accepted the order request.` }
        : { ok: false, message: result.message };
    },
    [activeVenueState, displayBalance, buildActiveVenueConnection]
  );

  // Close a real venue position (Binance: reduceOnly market order opposite side)
  const handleCloseVenuePosition = useCallback(
    async (positionId: string) => {
      if (venuePositions) {
        const pos = displayPositions.find((p) => p.id === positionId);
        if (pos) {
          const connection = buildActiveVenueConnection();
          await fetch(
            buildApiUrl("/api/binance/order"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "closePosition",
                symbol: pos.ticker,
                side: pos.side,
                size: pos.amount.toFixed(3),
                sessionToken: connection?.sessionToken,
              }),
            }
          );
          // Refresh positions after close
          setTimeout(() => setVenueRefreshTick((t) => t + 1), 1500);
          return;
        }
      }
      // Paper trading fallback
      closePosition(positionId);
    },
    [venuePositions, displayPositions, buildActiveVenueConnection, closePosition]
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

  const saveHlPrivateKey = async () => {
    if (!hlPrivateKeyInput.trim()) return;
    setHlKeyStatus("saving");
    try {
      const data = await apiFetch<{ ok: boolean; sessionToken?: string; message?: string }>("/api/vault/store", {
        method: "POST",
        body: JSON.stringify({ venueId: "hyperliquid", privateKey: hlPrivateKeyInput.trim(), walletAddress: hlWallet }),
      });
      if (data.ok && data.sessionToken) {
        setHlVaultToken(data.sessionToken);
        try { sessionStorage.setItem("traderbross.vault-token.hyperliquid.v1", data.sessionToken); } catch {}
        setHlPrivateKeyInput("");
        setHlKeyStatus("saved");
        setHeaderConnection({ status: "connected", platform: "hyperliquid" });
      } else {
        setHlKeyStatus("error");
      }
    } catch {
      setHlKeyStatus("error");
    }
  };

  const runHeaderCexAction = useCallback(async () => {
    if (selectedHeaderPlatform.type !== "cex") return;

    const cexPlatform = selectedHeaderPlatform.id as HeaderCexPlatform;
    const creds = headerCexCredentials[cexPlatform];
    const hasRequired = hasSavedHeaderCredentials(cexPlatform, headerCexCredentials);

    if (!hasRequired) {
      setHeaderActionMessage(
        cexPlatform === "okx"
          ? "Add API key, secret, and passphrase to save OKX credentials."
          : "Add API key and secret to save these credentials securely."
      );
      setHeaderConnection({ status: "failed", platform: headerPlatform, error: "Missing required API credentials." });
      return;
    }

    // Store credentials in server-side vault — browser will only keep the session token
    setHeaderActionMessage("Securing credentials…");
    try {
      const data = await apiFetch<{ ok: boolean; sessionToken?: string; message?: string }>("/api/vault/store", {
        method: "POST",
        body: JSON.stringify({
          venueId: cexPlatform,
          apiKey: creds.apiKey.trim(),
          apiSecret: creds.apiSecret.trim(),
          passphrase: creds.passphrase.trim() || undefined,
          testnet: cexPlatform === "binance" ? binanceTestnet : undefined,
        }),
      });

      if (data.ok && data.sessionToken) {
        // Persist token in sessionStorage (safe — just a UUID, not the key itself)
        try {
          sessionStorage.setItem(`traderbross.vault-token.${cexPlatform}.v1`, data.sessionToken);
        } catch { /* ignore */ }

        setVaultTokens((prev) => ({ ...prev, [cexPlatform]: data.sessionToken }));
        // Clear raw credentials from React state — they're secured server-side now
        setHeaderCexCredentials((prev) => ({
          ...prev,
          [cexPlatform]: EMPTY_HEADER_CEX_CREDENTIALS[cexPlatform],
        }));
        setHeaderConnection({ status: "saved_locally", platform: headerPlatform });
        setHeaderActionMessage(`${selectedHeaderPlatform.label} credentials secured in server vault.`);
      } else {
        setHeaderActionMessage(data.message ?? "Failed to store credentials.");
        setHeaderConnection({ status: "failed", platform: headerPlatform, error: data.message });
      }
    } catch {
      setHeaderActionMessage("Network error — could not reach the credential vault.");
      setHeaderConnection({ status: "failed", platform: headerPlatform, error: "Vault unreachable." });
    }
  }, [binanceTestnet, headerCexCredentials, headerPlatform, selectedHeaderPlatform]);

  const removeHeaderCexCredentials = useCallback(() => {
    if (selectedHeaderPlatform.type !== "cex") return;

    const cexPlatform = selectedHeaderPlatform.id as HeaderCexPlatform;
    const token = vaultTokens[cexPlatform];

    // Clear vault session on server (best-effort)
    if (token) {
      void apiFetch<{ ok: boolean }>("/api/vault/clear", {
        method: "DELETE",
        body: JSON.stringify({ sessionToken: token }),
      }).catch(() => { /* ignore */ });
      try { sessionStorage.removeItem(`traderbross.vault-token.${cexPlatform}.v1`); } catch { /* ignore */ }
      setVaultTokens((prev) => { const next = { ...prev }; delete next[cexPlatform]; return next; });
    }

    // Clear raw credentials from state
    setHeaderCexCredentials((prev) => ({
      ...prev,
      [cexPlatform]: EMPTY_HEADER_CEX_CREDENTIALS[cexPlatform],
    }));
    setHeaderActionMessage(`${selectedHeaderPlatform.label} credentials removed.`);
    setHeaderConnection({ status: "not_configured", platform: headerPlatform });
  }, [headerPlatform, selectedHeaderPlatform, vaultTokens]);

  const testHeaderCexConnection = useCallback(async () => {
    if (!selectedHeaderCexPlatform) return;

    const token = vaultTokens[selectedHeaderCexPlatform];
    const hasVaultToken = Boolean(token);
    const hasRawCreds = hasSavedHeaderCredentials(selectedHeaderCexPlatform, headerCexCredentials);

    if (!hasVaultToken && !hasRawCreds) {
      setHeaderConnection({ status: "failed", platform: headerPlatform, error: "Missing required API credentials." });
      setHeaderActionMessage(
        selectedHeaderCexPlatform === "okx"
          ? "OKX needs API key, API secret, and passphrase before testing."
          : "API key and secret are required before testing."
      );
      return;
    }

    setHeaderActionMessage("");
    setHeaderConnection({ status: "testing", platform: headerPlatform });

    try {
      // If no vault token yet, auto-save to vault first so test goes through server-side signing
      let effectiveToken = token;
      if (!effectiveToken && hasRawCreds) {
        setHeaderActionMessage("Securing credentials…");
        const creds = headerCexCredentials[selectedHeaderCexPlatform];
        const storeData = await apiFetch<{ ok: boolean; sessionToken?: string; message?: string }>("/api/vault/store", {
          method: "POST",
          body: JSON.stringify({
            venueId: selectedHeaderCexPlatform,
            apiKey: creds.apiKey.trim(),
            apiSecret: creds.apiSecret.trim(),
            passphrase: creds.passphrase.trim() || undefined,
          }),
        });
        if (storeData.ok && storeData.sessionToken) {
          effectiveToken = storeData.sessionToken;
          try { sessionStorage.setItem(`traderbross.vault-token.${selectedHeaderCexPlatform}.v1`, effectiveToken); } catch { /* ignore */ }
          setVaultTokens((prev) => ({ ...prev, [selectedHeaderCexPlatform]: effectiveToken! }));
          setHeaderCexCredentials((prev) => ({ ...prev, [selectedHeaderCexPlatform]: EMPTY_HEADER_CEX_CREDENTIALS[selectedHeaderCexPlatform] }));
        } else {
          setHeaderActionMessage(storeData.message ?? "Failed to secure credentials.");
          setHeaderConnection({ status: "failed", platform: headerPlatform, error: storeData.message });
          return;
        }
      }

      const connectionInput = effectiveToken ? { sessionToken: effectiveToken } : {};
      const result = await getVenueAdapter(selectedHeaderCexPlatform).testConnection(connectionInput);

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
    vaultTokens,
  ]);

  const handleAskAI = useCallback(
    (item: NewsItem) => {
      handleSelectItem(item);
      setRightTab("ai");
    },
    [handleSelectItem]
  );

  const renderNewsPanel = () => (
    <ErrorBoundary label="News Feed">
    <div className="panel-shell soft-divider flex h-full min-h-0 flex-col overflow-hidden border xl:rounded-l-xl xl:border-r-0">
      <NewsFeed
        onSelectItem={handleSelectItem}
        onTickerSelect={handleTickerRoute}
        onQuickTrade={handleNewsQuickTrade}
        selectedItem={selectedItem}
        onNewItem={(item) => checkNewsAgainstAlerts(item)}
        onAskAI={handleAskAI}
      />
    </div>
    </ErrorBoundary>
  );

  const renderChartPanel = (extraClassName = "") => (
    <div
      className={`panel-shell soft-divider flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border ${extraClassName}`}
    >
      <PriceChart
        activeVenue={activeVenueState.venueId}
        activeSymbol={activeVenueState.activeSymbol}
        marketDataSourceLabel={activeVenueMarketLabel}
        liveTickerPrice={getTickerDisplayPrice(activeVenueTicker) ?? undefined}
        liveFeedConnected={activeVenueFeedState === "connected"}
        positions={displayPositions}
        orders={orders}
        onUpdatePositionTpSl={updatePositionTpSl}
        onPlaceOrder={placeOrder}
        onTickerChange={setActiveSymbol}
      />
    </div>
  );

  const renderChartPanelWrapped = (extraClassName = "") => (
    <ErrorBoundary label="Price Chart">
      {renderChartPanel(extraClassName)}
    </ErrorBoundary>
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
              className={`accent-tab shrink-0 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors hover:text-zinc-300 ${
                tab.id === "ai"
                  ? rightTab === "ai"
                    ? "text-amber-300"
                    : "text-amber-600 hover:text-amber-300"
                  : ""
              }`}
            >
              {tab.id === "ai" ? (
                <span className="inline-flex items-center gap-1">
                  <span>✦</span>
                  {tab.label}
                </span>
              ) : (
                tab.label
              )}
            </button>
          ))}
        </div>
      </div>

      {rightTab === "trade" && (
        <TradingPanel
          activeVenueState={activeVenueState}
          selectedNews={selectedItem}
          newsTradeIntent={newsTradeIntent}
          balance={displayBalance}
          positions={displayPositions}
          prices={activeVenuePriceMap}
          marketDataSourceLabel={activeVenueMarketLabel}
          onActiveSymbolChange={setActiveSymbol}
          onPlaceOrder={routeOrderThroughVenue}
          onConsumeNewsTradeIntent={() => setNewsTradeIntent(null)}
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
              <span className="ml-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-amber-400">
                Soon
              </span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {dexSubTab === "hl" && (
              <HyperliquidPanel
                walletAddress={hlWallet || undefined}
                onRequestConnect={() => {
                  setHeaderPlatform("hyperliquid");
                  setHeaderConnectOpen(true);
                }}
              />
            )}
            {dexSubTab === "dydx" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-500/8">
                  <Layers className="h-7 w-7 text-amber-300/50" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">dYdX v4</p>
                  <p className="mt-1 text-xs font-semibold text-amber-300">Coming Soon</p>
                </div>
                <p className="max-w-[200px] text-[10px] leading-relaxed text-zinc-500">
                  Keplr wallet integration with STARK key signing is in development.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {rightTab === "connect" && (
        <ErrorBoundary label="Venues">
          <div className="tab-content-enter min-h-0 flex-1 overflow-hidden">
            <VenuesPanel hlWallet={hlWallet} onHlWalletChange={setHlWallet} />
          </div>
        </ErrorBoundary>
      )}

      {rightTab === "watch" && (
        <ErrorBoundary label="Watch">
          <div className="tab-content-enter flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Sub-tab toggle */}
            <div className="panel-header soft-divider flex shrink-0 border-b">
              {(["watchlist", "alerts"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setWatchSubTab(st)}
                  className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors ${
                    watchSubTab === st
                      ? "border-b-2 border-amber-300 text-amber-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {st === "watchlist" ? "Watchlist" : "Alerts"}
                </button>
              ))}
            </div>

            {watchSubTab === "watchlist" && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <WatchlistPanel
                  quotes={wsQuotes}
                  prices={prices}
                  activeTicker={activeVenueState.activeSymbol}
                  onSelectTicker={(ticker) => {
                    setActiveSymbol(ticker);
                    setRightTab("trade");
                    setMobileWorkspaceTab("chart");
                  }}
                />
              </div>
            )}
            {watchSubTab === "alerts" && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <AlertPanel />
              </div>
            )}
          </div>
        </ErrorBoundary>
      )}

      {rightTab === "ai" && (
        <ErrorBoundary label="AI Chat">
          <div className="tab-content-enter min-h-0 flex-1 overflow-hidden">
            <ChatPanel
              context={{
                ticker: activeVenueState.activeSymbol,
                price: getTickerDisplayPrice(activeVenueTicker)
                  ? String(getTickerDisplayPrice(activeVenueTicker))
                  : undefined,
                fearGreed: fearGreedData
                  ? { value: fearGreedData.value, label: fearGreedData.label }
                  : undefined,
                recentNews: selectedItem
                  ? [{ headline: selectedItem.headline, sentiment: selectedItem.sentiment ?? undefined }]
                  : undefined,
              }}
            />
          </div>
        </ErrorBoundary>
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <div className="panel-header brand-aura soft-divider status-glow relative z-40 flex shrink-0 items-center justify-center overflow-visible border-b px-3 py-3 sm:px-4 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(212,161,31,0.55),transparent)]">
        {/* Left: Fear & Greed + page nav */}
        <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-4 flex items-center gap-2">
          <FearGreedPill />
          <div className="hidden items-center gap-0.5 sm:flex">
            {([
              { label: "Home",     href: "/"          },
              { label: "News",     href: "/news"      },
              { label: "Screener", href: "/screener"  },
              { label: "Calendar", href: "/calendar"  },
            ] as const).map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-400"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Center brand */}
        <div className="relative z-10 flex items-center justify-center px-2">
          <div className="relative">
            <BrandMark className="mx-auto" />
            {/* Live data indicator */}
            {wsConnected && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2 py-[2px]"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <span className="h-1 w-1 rounded-full status-dot-online live-dot" />
                <span className="text-[8px] font-bold tracking-[0.18em] text-emerald-500 uppercase hidden sm:inline">
                  Live
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right: wallet connect */}
        <div ref={headerControlRef} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-4">
          <div className="panel-shell-alt flex items-center gap-1.5 rounded-2xl px-2 py-1.5">
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="brand-chip-active shimmer-on-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em]"
            >
              {/* Connection status dot */}
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isActiveHeaderConnection
                    ? "status-dot-online"
                    : headerConnection.status === "testing"
                      ? "status-dot-pending"
                      : ""
                }`}
                style={
                  !isActiveHeaderConnection && headerConnection.status !== "testing"
                    ? { background: "#4a3a1a" }
                    : {}
                }
              />
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Wallet</span>
            </button>
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="terminal-chip shimmer-on-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]"
            >
              <span className="hidden md:inline text-zinc-500">{selectedHeaderPlatform.eyebrow}</span>
              <span className="text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 pt-2">
        <div className="panel-shell soft-divider overflow-hidden rounded-xl border terminal-glow-pulse">
          <TickerTape quotes={wsQuotes} />
          <MarketStatsBar />
          <MarketSessionBar />
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

              {renderChartPanelWrapped()}

              <ResizeDivider onDrag={resizeRight} />

              <div className="shrink-0" style={{ width: rightWidth }}>
                {renderRightPanel()}
              </div>
            </div>
          ) : isTablet ? (
            <>
              <div className="min-h-0 flex-[1.15] overflow-hidden">
                {renderChartPanelWrapped("rounded-xl")}
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
              <TradingActivityDrawer
                positions={displayPositions}
                orders={orders}
                balance={displayBalance}
                equityHistory={equityHistory}
                onClosePosition={handleCloseVenuePosition}
                onCancelOrder={cancelOrder}
                onUpdatePositionTpSl={updatePositionTpSl}
                isLiveVenue={venuePositions !== null}
                venueName={venuePositions !== null ? activeVenueState.venueId.toUpperCase() : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────────────── */}
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1.5 sm:px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Left: feed status */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Binance */}
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${wsConnected ? "status-dot-online live-dot" : "status-dot-offline"}`} />
            <span className="text-[9px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: wsConnected ? "#10b981" : "#ef4444" }}>
              {wsConnected ? "Binance" : "Reconnecting"}
            </span>
          </div>

          <span className="text-[#2a2820] hidden sm:inline">·</span>

          {/* Venue feeds */}
          {(["OKX", "Bybit", "HL", "dYdX"] as const).map((v) => (
            <div key={v} className="hidden sm:flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#6b7280" }} />
              <span className="text-[9px] tracking-[0.1em] text-zinc-600">{v}</span>
            </div>
          ))}
        </div>

        {/* Center: selected item context */}
        <div className="min-w-0 flex items-center gap-1.5 text-[9px]">
          {selectedItem ? (
            <>
              <span className="rounded px-1.5 py-0.5 font-bold tracking-[0.12em] uppercase"
                style={{
                  background: "rgba(212,161,31,0.1)",
                  border: "1px solid rgba(212,161,31,0.2)",
                  color: "#d4a11f",
                }}>
                {selectedItem.ticker.slice(0, 2).join(" / ")}
              </span>
              <span className="truncate text-zinc-500 hidden md:inline">{selectedItem.source}</span>
            </>
          ) : (
            <span className="text-zinc-700 hidden md:inline tracking-[0.1em]">
              Select a news item to analyse
            </span>
          )}
        </div>

        {/* Right: layout info */}
        <div className="flex shrink-0 items-center gap-2 text-[9px] text-zinc-700">
          <span className="hidden lg:inline tracking-[0.1em]">
            {showDesktopLayout
              ? `NEWS ${newsWidth}px · RIGHT ${rightWidth}px`
              : isTablet
                ? "TABLET"
                : "MOBILE"}
          </span>
          <span
            className="rounded px-1.5 py-0.5 tracking-[0.12em] uppercase font-semibold"
            style={{
              background: "rgba(6,8,12,0.8)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "#3f3f4e",
            }}
          >
            TB v2
          </span>
        </div>
      </div>
      {headerConnectOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[120] bg-transparent" />
            <div
              ref={headerPanelRef}
              className="panel-shell-alt fixed z-[130] max-h-[calc(100vh-100px)] overflow-y-auto border p-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
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
                    disabled={platform.comingSoon}
                    onClick={() => {
                      if (platform.comingSoon) return;
                      setHeaderPlatform(platform.id);
                      setHeaderActionMessage("");
                    }}
                    className={`relative rounded-xl border px-3 py-2 text-left transition-colors ${
                      platform.comingSoon
                        ? "cursor-not-allowed border-[rgba(255,255,255,0.04)] bg-[#0d0f12] opacity-60"
                        : headerPlatform === platform.id
                          ? "border-[rgba(212,161,31,0.26)] bg-[rgba(212,161,31,0.12)]"
                          : "border-[rgba(255,255,255,0.06)] bg-[#111317] hover:bg-[rgba(212,161,31,0.05)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">{platform.eyebrow}</div>
                      {platform.comingSoon && (
                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-amber-300">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#f3ead7]">{platform.label}</div>
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-[rgba(212,161,31,0.12)] bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="brand-badge brand-badge-gold rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.14em]">
                    {selectedHeaderPlatform.comingSoon ? "Coming Soon" : isHeaderWalletPlatform ? "Wallet Flow" : "API Flow"}
                  </span>
                  <span className="text-[11px] font-semibold text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
                  {!selectedHeaderPlatform.comingSoon && (
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
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                  {selectedHeaderPlatform.description}
                </p>

                {selectedHeaderPlatform.comingSoon ? (
                  <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-500/5 px-4 py-4 text-center">
                    <div className="mb-1 text-[20px]">🔒</div>
                    <div className="text-[12px] font-semibold text-amber-200">Coming Soon</div>
                    <p className="mt-1.5 text-[10px] leading-4 text-zinc-400">
                      We&apos;re actively working on {selectedHeaderPlatform.label} integration.
                      Stay tuned for early access.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                ) : isHeaderWalletPlatform ? (
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

                    {headerPlatform === "hyperliquid" && (
                      <div className="mt-3 space-y-2 rounded-xl border border-[rgba(212,161,31,0.12)] bg-[#0c0f13] p-3">
                        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300/70">
                          API Wallet — Trading Key
                        </div>
                        <p className="text-[10px] leading-4 text-zinc-500">
                          Enter your Hyperliquid API wallet private key to enable in-terminal order placement with builder fee revenue.
                        </p>
                        {hlVaultToken ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                              <CheckCircle className="h-3.5 w-3.5" />
                              API key secured in vault
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setHlVaultToken("");
                                try { sessionStorage.removeItem("traderbross.vault-token.hyperliquid.v1"); } catch {}
                                setHlKeyStatus("idle");
                                if (headerConnection.platform === "hyperliquid") {
                                  setHeaderConnection({ status: "disconnected", platform: "hyperliquid" });
                                }
                              }}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="password"
                              value={hlPrivateKeyInput}
                              onChange={(e) => setHlPrivateKeyInput(e.target.value)}
                              placeholder="0x… private key"
                              className="terminal-input w-full rounded-xl px-3 py-2 text-[11px] outline-none placeholder:text-zinc-600"
                            />
                            <button
                              type="button"
                              disabled={!hlPrivateKeyInput.trim() || hlKeyStatus === "saving"}
                              onClick={saveHlPrivateKey}
                              className="w-full rounded-xl bg-amber-500/15 px-3 py-2 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {hlKeyStatus === "saving" ? "Securing…" : hlKeyStatus === "error" ? "Failed — Retry" : "Save API Key"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
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

                    {selectedHeaderPlatform.id === "binance" && (
                      <label className="mt-2.5 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={binanceTestnet}
                          onChange={(e) => setBinanceTestnet(e.target.checked)}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        <span className="text-[10px] text-amber-400/80">Testnet mode</span>
                      </label>
                    )}

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
                        {headerActionMessage || (
                          vaultTokens[selectedHeaderCexPlatform as HeaderCexPlatform]
                            ? "Credentials secured in server vault · only a session token is stored locally."
                            : "Enter your API credentials and click Save to store them securely."
                        )}
                      </div>
                      {/* Security status */}
                      {vaultTokens[selectedHeaderCexPlatform as HeaderCexPlatform] ? (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2 py-1.5 text-[9px] text-emerald-400">
                          <span className="mt-0.5 shrink-0">🔒</span>
                          <span>Keys encrypted server-side (AES-256). Your browser holds only a session token.</span>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/12 bg-amber-500/5 px-2 py-1.5 text-[9px] text-amber-400/70">
                          <span className="mt-0.5 shrink-0">⚠</span>
                          <span>Never use keys with withdrawal permissions. Restrict by IP in exchange settings.</span>
                        </div>
                      )}
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
