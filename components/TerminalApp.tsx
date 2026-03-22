"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NewsItem, AVAILABLE_TICKERS } from "@/lib/mock-data";
import { useAlerts } from "@/hooks/useAlerts";
import { useBinanceWs } from "@/hooks/useBinanceWs";
import { useVenueMarketData } from "@/hooks/useVenueMarketData";
import { getTickerDisplayPrice } from "@/lib/market-data/shared";
import NewsFeed from "@/components/NewsFeed";
import PriceChart from "@/components/PriceChart";
import AlertPanel from "@/components/AlertPanel";
import TradingPanel from "@/components/TradingPanel";
import BottomPanel from "@/components/BottomPanel";
import TradingActivityDrawer from "@/components/TradingActivityDrawer";
import HyperliquidPanel from "@/components/HyperliquidPanel";
import DydxPanel from "@/components/DydxPanel";
import SignalsPanel from "@/components/SignalsPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FearGreedPill } from "@/components/FearGreedWidget";
import { apiFetch } from "@/lib/api-client";
import { buildApiUrl } from "@/lib/runtime-env";
import { useRealtimeSelector } from "@/lib/realtime-client";
import BrandMark from "@/components/BrandMark";
import MarketStatsBar from "@/components/MarketStatsBar";
import MarketSessionBar from "@/components/MarketSessionBar";
import { useTradingState } from "@/hooks/useTradingState";
import { useEncryptedLocalStorage } from "@/hooks/useEncryptedLocalStorage";
import type { Position, Order } from "@/hooks/useTradingState";
import type { ActiveVenueState, TradingVenueConnectionStatus, TradingVenueType } from "@/lib/active-venue";
import { getVenueAdapter } from "@/lib/venues";
import type { VenueBalance, VenueConnectionInput, VenuePosition } from "@/lib/venues/types";
import { validateExecutionRequest } from "@/lib/execution-validation";
import type { NewsTradePreset } from "@/lib/news-trade";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import {
  connectWalletByLabel,
  disconnectWalletSession,
  formatWalletAddress,
  isWalletInstalled,
  subscribeWalletSession,
  type ConnectedWalletSession,
  type SupportedWalletLabel,
  walletInstallUrl,
} from "@/lib/wallet-connect";
import {
  GripVertical,
  Newspaper,
  CandlestickChart,
  Wallet,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Unplug,
  Layers,
  TrendingUp,
  Activity,
  Eye,
  Zap,
} from "lucide-react";

function normalizeVenueTicker(value: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(USDT|USDC|USD)$/i, "");
}


/* ─── Funding Stats Bar ─────────────────────────────────────────────────────── */
function _StatChip({ label, value, valueClass = "text-zinc-400" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">{label}</span>
      <span className={`text-[10px] font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function FundingStatsBar({ ticker }: { ticker: string }) {
  const [funding, setFunding] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ rates?: { venue: string; rate: number | null }[] }>(`/api/funding?ticker=${ticker}`)
      .then((d) => {
        if (!active) return;
        const item = d.rates?.find((r) => r.venue === "Binance") ?? d.rates?.[0];
        setFunding(item?.rate ?? null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [ticker]);

  const fmtFund = funding !== null
    ? `${funding >= 0 ? "+" : ""}${(funding * 100).toFixed(4)}%`
    : "—";
  const fundColor = funding === null ? "text-zinc-600" : funding >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div
      className="shrink-0 flex items-center gap-4 px-3 py-1 border-b overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ borderColor: "rgba(212,161,31,0.1)", background: "rgba(8,7,6,0.9)", minHeight: 28 }}
    >
      <_StatChip label="FUNDING" value={fmtFund} valueClass={fundColor} />
      <span className="text-zinc-800 text-[8px]">·</span>
      <_StatChip label="OI" value="—" />
      <span className="text-zinc-800 text-[8px]">·</span>
      <_StatChip label="L/S" value="—" />
      <span className="text-zinc-800 text-[8px]">·</span>
      <_StatChip label="LIQD 24H" value="—" />
      <span className="text-zinc-800 text-[8px]">·</span>
      <_StatChip label="CVD" value="—" />
    </div>
  );
}

/* ─── Order Book Mini ────────────────────────────────────────────────────────── */
type OBEntry = [string, string, string, string]; // [price, qty, ?, ?]

function OrderBookMini({ ticker }: { ticker: string }) {
  const [bids, setBids] = useState<OBEntry[]>([]);
  const [asks, setAsks] = useState<OBEntry[]>([]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await apiFetch<{ bids: OBEntry[]; asks: OBEntry[] }>(
          `/api/okx/orderbook?ticker=${ticker}&sz=4`
        );
        if (!active) return;
        setBids((res.bids ?? []).slice(0, 4));
        setAsks((res.asks ?? []).slice(0, 4));
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => { active = false; clearInterval(id); };
  }, [ticker]);

  if (!bids.length && !asks.length) return null;

  const topBid = bids[0] ? parseFloat(bids[0][0]) : null;
  const topAsk = asks[0] ? parseFloat(asks[0][0]) : null;
  const spread = topBid && topAsk ? (topAsk - topBid).toFixed(2) : "—";
  const fmtP = (p: string) => {
    const n = parseFloat(p);
    return n >= 1000 ? n.toFixed(1) : n >= 1 ? n.toFixed(3) : n.toFixed(5);
  };
  const fmtS = (s: string) => parseFloat(s).toFixed(2);

  return (
    <div
      className="hidden lg:flex shrink-0 border-t"
      style={{ borderColor: "rgba(212,161,31,0.1)", background: "rgba(6,5,4,0.95)", height: 86 }}
    >
      {/* Asks (top → lowest ask first) */}
      <div className="flex-1 flex flex-col justify-end px-3 py-1.5 gap-0.5">
        <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-700 mb-0.5">Ask</div>
        {[...asks].reverse().map(([price, size], i) => (
          <div key={i} className="flex items-center justify-between text-[9px] tabular-nums">
            <span className="text-red-400 font-medium">{fmtP(price)}</span>
            <span className="text-zinc-600">{fmtS(size)}</span>
          </div>
        ))}
      </div>
      {/* Spread */}
      <div
        className="flex flex-col items-center justify-center border-x px-3 text-center"
        style={{ minWidth: 64, borderColor: "rgba(212,161,31,0.08)" }}
      >
        <span className="text-[8px] uppercase tracking-[0.12em] text-zinc-700 mb-0.5">SPREAD</span>
        <span className="text-[10px] font-semibold text-zinc-400">{spread}</span>
        <span className="text-[8px] text-zinc-700 mt-0.5">OKX</span>
      </div>
      {/* Bids */}
      <div className="flex-1 flex flex-col justify-start px-3 py-1.5 gap-0.5">
        <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-700 mb-0.5">Bid</div>
        {bids.map(([price, size], i) => (
          <div key={i} className="flex items-center justify-between text-[9px] tabular-nums">
            <span className="text-emerald-400 font-medium">{fmtP(price)}</span>
            <span className="text-zinc-600">{fmtS(size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RightTab = "trade" | "dex" | "signals" | "watch";
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
type HeaderCexTestnetMap = Record<HeaderCexPlatform, boolean>;
type NewsTradeIntent = NewsTradePreset & { sourceItemId: string };
type SecureStoredCexState = {
  version: 1;
  testnetMode: HeaderCexTestnetMap;
};

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
    eyebrow: "CEX API · Live",
    description: "OKX Perpetuals — server-side signed API routing with vault session tokens for balance, positions, and order actions.",
    primaryAction: "Save API Keys",
  },
  {
    id: "bybit",
    label: "Bybit",
    type: "cex",
    eyebrow: "CEX API · Live",
    description: "Bybit Linear — server-side signed API routing with vault session tokens for balance, positions, and order actions.",
    primaryAction: "Save API Keys",
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

const MOBILE_ROUTE_TABS: Array<{ href: string; label: string; active?: boolean }> = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News" },
  { href: "/screener", label: "Screener" },
  { href: "/calendar", label: "Calendar" },
  { href: "/terminal", label: "Terminal", active: true },
];

function createEmptyHeaderCexCredentials(): HeaderCexCredentialMap {
  return {
    okx: { apiKey: "", apiSecret: "", passphrase: "" },
    bybit: { apiKey: "", apiSecret: "", passphrase: "" },
    binance: { apiKey: "", apiSecret: "", passphrase: "" },
  };
}

const DEFAULT_CEX_TESTNET_MODE: HeaderCexTestnetMap = {
  okx: false,
  bybit: false,
  binance: false,
};

const SECURE_CEX_STORAGE_KEY = "traderbross.cex.credentials.secure.v1";

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
  const [secureStorageScope, setSecureStorageScope] = useState<string>("anon");
  const [secureCexStateReady, setSecureCexStateReady] = useState(false);
  const secureCexStorage = useEncryptedLocalStorage<SecureStoredCexState>(`traderbross:cex:${secureStorageScope}`);
  const secureCexStorageRef = useRef(secureCexStorage);
  const hydratedSecureScopeRef = useRef<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("trade");
  const [dexSubTab, setDexSubTab] = useState<DexSubTab>("hl");
  const [hlWallet, setHlWallet] = useState("");
  const [hlVaultToken, setHlVaultToken] = useState<string>("");
  const [hlPrivateKeyInput, setHlPrivateKeyInput] = useState<string>("");
  const [hlKeyStatus, setHlKeyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<WorkspaceTab>("chart");
  const [headerPlatform, setHeaderPlatform] = useState<HeaderPlatform>("binance");
  const [headerConnectOpen, setHeaderConnectOpen] = useState(false);
  const [headerConnection, setHeaderConnection] = useState<HeaderConnectionState>({
    status: "disconnected",
    platform: "binance",
  });
  const [headerActionMessage, setHeaderActionMessage] = useState("");
  const [headerCexCredentials, setHeaderCexCredentials] = useState<HeaderCexCredentialMap>(
    () => createEmptyHeaderCexCredentials()
  );
  /** Server-side vault session tokens — stored in sessionStorage, NOT localStorage */
  const [vaultTokens, setVaultTokens] = useState<Partial<Record<HeaderCexPlatform, string>>>({});
  const [cexTestnetMode, setCexTestnetMode] = useState<HeaderCexTestnetMap>(DEFAULT_CEX_TESTNET_MODE);
  const [newsTradeIntent, setNewsTradeIntent] = useState<NewsTradeIntent | null>(null);
  const [venueSymbols, setVenueSymbols] = useState<string[]>([]);
  const [quoteAsset, setQuoteAsset] = useState<"USDT" | "USDC">("USDT");
  const [activeVenueState, setActiveVenueState] = useState<ActiveVenueState>({
    venueId: "hyperliquid",
    venueType: "wallet",
    activeSymbol: (initialTicker || "BTC").toUpperCase(),
    connectionStatus: "disconnected",
  });
  const { checkNewsAgainstAlerts, checkPriceAlerts } = useAlerts();
  const headerControlRef = useRef<HTMLDivElement | null>(null);
  const headerPanelRef = useRef<HTMLDivElement | null>(null);
  const [headerAnchorRect, setHeaderAnchorRect] = useState<DOMRect | null>(null);
  const headerWalletSessionRef = useRef<ConnectedWalletSession | null>(null);
  const headerWalletListenerCleanupRef = useRef<(() => void) | null>(null);

  const [newsWidth, setNewsWidth] = useState(480);
  const [rightWidth, setRightWidth] = useState(390);
  const panelInitRef = useRef(false);

  const resizeNews = useCallback(
    (dx: number) => setNewsWidth((w) => Math.max(240, Math.min(580, w + dx))),
    []
  );
  const resizeRight = useCallback(
    (dx: number) => setRightWidth((w) => Math.max(280, Math.min(520, w - dx))),
    []
  );

  useEffect(() => {
    const syncViewport = () => {
      const vw = window.innerWidth;
      setViewportWidth(vw);
      if (!panelInitRef.current && vw >= 1280) {
        panelInitRef.current = true;
        setNewsWidth(Math.round(vw * 0.26));
        setRightWidth(Math.round(vw * 0.25));
      }
    };
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

  useEffect(() => {
    secureCexStorageRef.current = secureCexStorage;
  }, [secureCexStorage]);

  useEffect(() => {
    if (!secureCexStateReady) return;
    void secureCexStorageRef.current.setItem(SECURE_CEX_STORAGE_KEY, {
      version: 1,
      testnetMode: cexTestnetMode,
    });
  }, [cexTestnetMode, secureCexStateReady]);

  // NOTE: Raw CEX credentials are intentionally NOT persisted to localStorage.
  // Credentials are stored encrypted in device-local storage (AES-GCM) and can be
  // vaulted server-side via /api/vault/store. Session tokens persist in sessionStorage.

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
      headerWalletListenerCleanupRef.current?.();
      headerWalletListenerCleanupRef.current = null;
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
  const { ticker: activeVenueTicker, connectionState: activeVenueFeedState } = useVenueMarketData(
    activeVenueState.venueId,
    activeVenueState.activeSymbol
  );
  const backendVenueQuotes = useRealtimeSelector((state) => state.venueQuotes);
  const realtimeNews = useRealtimeSelector((state) => state.news);
  const realtimeWhales = useRealtimeSelector((state) => state.whales);
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
  const [venueOpenOrders, setVenueOpenOrders] = useState<Order[] | null>(null);
  const [venueRefreshTick, setVenueRefreshTick] = useState(0);
  const [venueTpSlMap, setVenueTpSlMap] = useState<Record<string, { tpPrice?: number; slPrice?: number }>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchVenueData = async () => {
      const isConnected =
        activeVenueState.connectionStatus === "connected" ||
        activeVenueState.connectionStatus === "saved_locally";

      if (!isConnected) {
        setVenueBalance(null);
        setVenuePositions(null);
        setVenueOpenOrders(null);
        setVenueTpSlMap({});
        return;
      }

      try {
        const connection = buildActiveVenueConnection();
        const adapter = getVenueAdapter(activeVenueState.venueId);
        const openOrdersPromise =
          (activeVenueState.venueId === "binance" ||
            activeVenueState.venueId === "okx" ||
            activeVenueState.venueId === "bybit") &&
          connection?.sessionToken
            ? apiFetch<{ orders?: Array<Record<string, unknown>> }>(`/api/${activeVenueState.venueId}`, {
                method: "POST",
                body: JSON.stringify({
                  type: "openOrders",
                  sessionToken: connection.sessionToken,
                }),
              })
                .then((payload) => (Array.isArray(payload?.orders) ? payload.orders : []))
                .catch(() => [])
            : Promise.resolve([]);

        const [balance, pos, openRows] = await Promise.all([
          adapter.getBalance(connection),
          adapter.getPositions(connection),
          openOrdersPromise,
        ]);
        if (!cancelled) {
          setVenueBalance(balance);
          // null = not fetched yet (show paper), array = real data (even if empty)
          setVenuePositions(pos);
          setVenueTpSlMap((prev) => {
            const next = { ...prev };
            for (const p of pos) {
              const key = `${p.symbol}_${p.side}`;
              if (p.tpPrice || p.slPrice) {
                next[key] = { tpPrice: p.tpPrice, slPrice: p.slPrice };
              }
            }
            return next;
          });
          const mappedOpenOrders: Order[] = (openRows || []).map((row, index) => {
            const ticker = String(row.ticker || row.symbol || "").toUpperCase().replace(/USDT$|USDC$/i, "");
            const amount = Number(row.amount || row.size || row.qty || 0) || 0;
            const price = Number(row.price || row.triggerPrice || row.stopPrice || 0) || 0;
            const leverage = Math.max(1, Number(row.leverage || 1) || 1);
            const rawType = String(row.type || row.orderType || "").toLowerCase();
            const orderType: "market" | "limit" | "stop" =
              rawType.includes("limit") ? "limit" : rawType.includes("stop") || rawType.includes("take_profit") ? "stop" : "market";
            const side: "long" | "short" =
              String(row.side || "").toLowerCase() === "sell" || String(row.side || "").toLowerCase() === "short" ? "short" : "long";
            const marginMode: "isolated" | "cross" =
              String(row.marginMode || "").toLowerCase() === "cross" ? "cross" : "isolated";
            const stamp = row.timestamp ?? row.time ?? row.createdTime ?? Date.now();
            return {
              id: String(row.id || row.orderId || `${ticker}-${index}`),
              ticker,
              side,
              type: orderType,
              status: "open",
              amount,
              price,
              total: Number(row.total || amount * price || 0),
              margin: Number(row.margin || (amount * price) / leverage || 0),
              leverage,
              marginMode,
              fee: Number(row.fee || 0),
              tpPrice: Number.isFinite(Number(row.tpPrice)) ? Number(row.tpPrice) : undefined,
              slPrice: Number.isFinite(Number(row.slPrice)) ? Number(row.slPrice) : undefined,
              timestamp: new Date(stamp as string | number),
            };
          });
          setVenueOpenOrders(mappedOpenOrders);
        }
      } catch {
        if (!cancelled) {
          setVenueBalance(null);
          setVenuePositions(null);
          setVenueOpenOrders(null);
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
        tpPrice: venueTpSlMap[`${p.symbol}_${p.side}`]?.tpPrice ?? p.tpPrice ?? undefined,
        slPrice: venueTpSlMap[`${p.symbol}_${p.side}`]?.slPrice ?? p.slPrice ?? undefined,
        timestamp: new Date(),
      };
    });
  }, [venuePositions, positions, wsPrices, venueTpSlMap]);
  const displayOrders: Order[] = useMemo(() => {
    if (venueOpenOrders !== null) return venueOpenOrders;
    return orders;
  }, [orders, venueOpenOrders]);

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

  const [watchSubTab, setWatchSubTab] = useState<"watchlist" | "alerts">("watchlist");

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1280;
  const showDesktopLayout = viewportWidth >= 1280;
  const showBottomPanel = !isMobile;
  const mobileChartHeight = viewportWidth < 390 ? 186 : viewportWidth < 430 ? 206 : 224;
  const mobileNewsPaneFlex = viewportWidth < 390 ? "0 0 56%" : "0 0 53%";
  const mobileTradePaneFlex = viewportWidth < 390 ? "0 0 44%" : "0 0 47%";
  const tabletRightPanelWidth = Math.max(304, Math.min(360, Math.round(viewportWidth * 0.36)));
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
  const selectedCexTestnetMode = selectedHeaderCexPlatform
    ? cexTestnetMode[selectedHeaderCexPlatform]
    : false;
  const walletAvailability = useMemo(() => {
    if (!selectedHeaderPlatform.wallets?.length) {
      return {} as Record<SupportedWalletLabel, boolean>;
    }
    const entries = selectedHeaderPlatform.wallets.map((wallet) => [wallet, isWalletInstalled(wallet)] as const);
    return Object.fromEntries(entries) as Record<SupportedWalletLabel, boolean>;
  }, [headerConnectOpen, selectedHeaderPlatform.wallets]);
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
  const fallbackTradableSymbols = useMemo(
    () =>
      (activeVenueState.venueId === "binance" ? wsQuotes.map((quote) => quote.symbol) : AVAILABLE_TICKERS)
        .map(normalizeVenueTicker)
        .filter(Boolean),
    [activeVenueState.venueId, wsQuotes],
  );
  const tradableSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          (venueSymbols.length > 0 ? venueSymbols : fallbackTradableSymbols)
            .map((value) => normalizeVenueTicker(value))
            .filter(Boolean),
        ),
      ),
    [fallbackTradableSymbols, venueSymbols],
  );
  const tradableSet = useMemo(() => new Set(tradableSymbols), [tradableSymbols]);
  const chartEventItems = useMemo(
    () =>
      [...realtimeNews, ...realtimeWhales]
        .filter((item) => item.ticker?.includes(activeVenueState.activeSymbol))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 40),
    [activeVenueState.activeSymbol, realtimeNews, realtimeWhales],
  );

  useEffect(() => {
    let cancelled = false;
    const loadVenueSymbols = async () => {
      try {
        const rows = await apiFetch<string[]>(
          `/api/venues/symbols?venue=${encodeURIComponent(activeVenueState.venueId)}&quote=${encodeURIComponent(quoteAsset)}`,
        );
        if (cancelled || !Array.isArray(rows)) return;
        const normalized = Array.from(new Set(rows.map((row) => normalizeVenueTicker(row)).filter(Boolean)));
        if (normalized.length > 0) {
          setVenueSymbols(normalized);
        }
      } catch {
        // Preserve previous symbols on transient failures.
      }
    };

    void loadVenueSymbols();
    const retryId = setInterval(() => {
      void loadVenueSymbols();
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(retryId);
    };
  }, [activeVenueState.venueId, quoteAsset]);

  useEffect(() => {
    if (tradableSymbols.length === 0) return;
    if (!tradableSet.has(activeVenueState.activeSymbol)) {
      setActiveVenueState((prev) => ({
        ...prev,
        activeSymbol: tradableSymbols[0],
      }));
    }
  }, [activeVenueState.activeSymbol, tradableSet, tradableSymbols]);

  const setActiveSymbol = useCallback((symbol: string) => {
    setActiveVenueState((prev) => ({
      ...prev,
      activeSymbol: normalizeVenueTicker(symbol) || "BTC",
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveScope = async () => {
      if (!hasSupabasePublicEnv()) {
        if (!cancelled) setSecureStorageScope("anon");
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setSecureStorageScope(user?.id || "anon");
        }
      } catch {
        if (!cancelled) setSecureStorageScope("anon");
      }
    };
    void resolveScope();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (hydratedSecureScopeRef.current === secureStorageScope) {
      return () => {
        cancelled = true;
      };
    }
    hydratedSecureScopeRef.current = secureStorageScope;
    const loadSecureCexState = async () => {
      const stored = await secureCexStorageRef.current.getItem(SECURE_CEX_STORAGE_KEY);
      if (cancelled) return;
      if (stored?.testnetMode) {
        setCexTestnetMode(stored.testnetMode);
      }
      setSecureCexStateReady(true);
    };
    setSecureCexStateReady(false);
    void loadSecureCexState();
    return () => {
      cancelled = true;
    };
  }, [secureStorageScope]);

  useEffect(() => {
    if (!headerConnectOpen) return;
    // Security/UX: never prefill raw API secrets when opening the modal.
    setHeaderCexCredentials(createEmptyHeaderCexCredentials());
  }, [headerConnectOpen]);

  const handleSelectItem = useCallback((item: NewsItem) => {
    setSelectedItem(item);
    if (item.ticker.length > 0) {
      const match = item.ticker
        .map((ticker) => normalizeVenueTicker(ticker))
        .find((ticker) => tradableSet.has(ticker));
      if (match) {
        setActiveSymbol(match);
        setRightTab("trade");
        setMobileWorkspaceTab("chart");
      }
    }
  }, [setActiveSymbol, tradableSet]);

  const handleTickerRoute = useCallback((ticker: string, item: NewsItem) => {
    setSelectedItem(item);
    const symbol = String(ticker || "")
      .split("-")[0]
      .replace(/(USDT|USDC|USD)$/i, "")
      .replace(/PERP$/i, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    if (symbol && tradableSet.has(symbol)) {
      setActiveSymbol(symbol);
    }
    setRightTab("trade");
    setMobileWorkspaceTab("chart");
  }, [setActiveSymbol, tradableSet]);

  const buildActiveVenueConnection = useCallback((): VenueConnectionInput | undefined => {
    if (activeVenueState.venueType === "cex") {
      const activeCexPlatform =
        activeVenueState.venueId === "binance" ||
        activeVenueState.venueId === "okx" ||
        activeVenueState.venueId === "bybit"
          ? activeVenueState.venueId
          : null;
      if (!activeCexPlatform) return undefined;
      const token = vaultTokens[activeCexPlatform];
      if (token) {
        // Preferred: vault token — raw keys stay on the server
        return { sessionToken: token };
      }
      return undefined;
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

      let result;
      try {
        result = await adapter.placeOrder(
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Order request failed.";
        return { ok: false, message };
      }

      if (result.ok) {
        if (tpPrice || slPrice) {
          const key = `${ticker}_${side}`;
          setVenueTpSlMap((prev) => ({
            ...prev,
            [key]: { tpPrice: tpPrice ?? undefined, slPrice: slPrice ?? undefined },
          }));
        }
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
    async (positionId: string, closePercent = 100) => {
      if (venuePositions) {
        const pos = displayPositions.find((p) => p.id === positionId);
        if (pos) {
          const connection = buildActiveVenueConnection();
          const venueId = activeVenueState.venueId;
          if ((venueId === "binance" || venueId === "okx" || venueId === "bybit") && !connection?.sessionToken) {
            window.alert(`No API session for active venue (${venueId.toUpperCase()}). Reconnect this exchange first.`);
            return;
          }
          const orderEndpoint =
            venueId === "binance" || venueId === "okx" || venueId === "bybit" || venueId === "hyperliquid"
              ? `/api/${venueId}/order`
              : null;
          if (!orderEndpoint) {
            closePosition(positionId);
            return;
          }
          try {
            const res = await fetch(buildApiUrl(orderEndpoint), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "closePosition",
                symbol: pos.ticker,
                side: pos.side,
                marginMode: pos.marginMode,
                closePercent,
                sessionToken: connection?.sessionToken,
              }),
            });
            const data = await res.json() as { ok?: boolean; error?: string };
            if (!data.ok) {
              console.error(`[ClosePosition] ${venueId} error:`, data.error);
              window.alert(`Close position failed: ${data.error ?? "Unknown error"}`);
              return;
            }
          } catch (err) {
            console.error("[ClosePosition] Network error:", err);
            window.alert(`Close position network error: ${(err as Error).message}`);
            return;
          }
          // Refresh positions after successful close
          setTimeout(() => setVenueRefreshTick((t) => t + 1), 1500);
          return;
        }
      }
      // Paper trading fallback
      closePosition(positionId, closePercent);
    },
    [venuePositions, displayPositions, buildActiveVenueConnection, closePosition, activeVenueState.venueId]
  );

  // Set TP/SL on a live Binance position
  const handleSetVenueTpSl = useCallback(
    async (positionId: string, tpPrice: number | undefined, slPrice: number | undefined) => {
      if (venuePositions) {
        const pos = displayPositions.find((p) => p.id === positionId);
        if (pos) {
          const connection = buildActiveVenueConnection();
          const venueId = activeVenueState.venueId;
          if ((venueId === "binance" || venueId === "okx" || venueId === "bybit") && !connection?.sessionToken) {
            window.alert(`No API session for active venue (${venueId.toUpperCase()}). Reconnect this exchange first.`);
            return;
          }
          const orderEndpoint =
            venueId === "binance" || venueId === "okx" || venueId === "bybit" || venueId === "hyperliquid"
              ? `/api/${venueId}/order`
              : null;
          if (!orderEndpoint) {
            updatePositionTpSl(positionId, tpPrice, slPrice);
            return;
          }
          const res = await fetch(buildApiUrl(orderEndpoint), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "tpsl",
                symbol: pos.ticker,
                side: pos.side,
                marginMode: pos.marginMode,
                tpPrice: tpPrice ?? null,
                slPrice: slPrice ?? null,
                sessionToken: connection?.sessionToken,
              }),
          });
          const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
          if (!res.ok || data.ok === false) {
            window.alert(`TP/SL update failed: ${data.error ?? `HTTP ${res.status}`}`);
            return;
          }
          setVenueTpSlMap((prev) => ({
            ...prev,
            [`${pos.ticker}_${pos.side}`]: { tpPrice: tpPrice ?? undefined, slPrice: slPrice ?? undefined },
          }));
          setTimeout(() => setVenueRefreshTick((t) => t + 1), 1500);
          return;
        }
      }
      // Paper trading fallback
      updatePositionTpSl(positionId, tpPrice, slPrice);
    },
    [venuePositions, displayPositions, buildActiveVenueConnection, updatePositionTpSl, activeVenueState.venueId]
  );

  const disconnectHeaderWallet = useCallback(async () => {
    headerWalletListenerCleanupRef.current?.();
    headerWalletListenerCleanupRef.current = null;
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
      headerWalletListenerCleanupRef.current?.();
      headerWalletListenerCleanupRef.current = null;
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
        headerWalletListenerCleanupRef.current = subscribeWalletSession(session, {
          onDisconnect: () => {
            headerWalletSessionRef.current = null;
            setHeaderConnection((prev) => ({
              status: "disconnected",
              platform: prev.platform,
              walletLabel: prev.walletLabel,
              address: undefined,
            }));
            if (headerPlatform === "hyperliquid") {
              setHlWallet("");
            }
          },
          onAddressChange: (nextAddress) => {
            setHeaderConnection((prev) => ({
              ...prev,
              status: "connected",
              address: nextAddress,
            }));
            if (headerPlatform === "hyperliquid") {
              setHlWallet(nextAddress);
            }
          },
        });
        if (process.env.NODE_ENV !== "production") { console.info("[TraderBross Header Wallet]", "connected", headerPlatform, walletLabel, session.address); }

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
        headerWalletListenerCleanupRef.current?.();
        headerWalletListenerCleanupRef.current = null;
        headerWalletSessionRef.current = null;
        if (process.env.NODE_ENV !== "production") { console.info("[TraderBross Header Wallet]", "failed", headerPlatform, walletLabel, error); }
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
          testnet: cexTestnetMode[cexPlatform] || undefined,
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
          [cexPlatform]: { apiKey: "", apiSecret: "", passphrase: "" },
        }));
        setHeaderConnection({ status: "saved_locally", platform: headerPlatform });
        setHeaderActionMessage(`${selectedHeaderPlatform.label} credentials secured in server vault.`);
      } else {
        setHeaderActionMessage(data.message ?? "Failed to store credentials.");
        setHeaderConnection({ status: "failed", platform: headerPlatform, error: data.message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vault unreachable.";
      const isProxy403 = message.includes("403");
      setHeaderActionMessage(
        isProxy403
          ? "Vault rejected request (403). Check PROXY_SHARED_SECRET and proxy marker settings."
          : "Network error — could not reach the credential vault."
      );
      setHeaderConnection({ status: "failed", platform: headerPlatform, error: message });
    }
  }, [cexTestnetMode, headerCexCredentials, headerPlatform, selectedHeaderPlatform]);

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
      [cexPlatform]: { apiKey: "", apiSecret: "", passphrase: "" },
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
            testnet: cexTestnetMode[selectedHeaderCexPlatform] || undefined,
          }),
        });
        if (storeData.ok && storeData.sessionToken) {
          effectiveToken = storeData.sessionToken;
          try { sessionStorage.setItem(`traderbross.vault-token.${selectedHeaderCexPlatform}.v1`, effectiveToken); } catch { /* ignore */ }
          setVaultTokens((prev) => ({ ...prev, [selectedHeaderCexPlatform]: effectiveToken! }));
          setHeaderCexCredentials((prev) => ({
            ...prev,
            [selectedHeaderCexPlatform]: { apiKey: "", apiSecret: "", passphrase: "" },
          }));
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
    cexTestnetMode,
    vaultTokens,
  ]);

  const renderNewsPanel = () => (
    <ErrorBoundary label="News Feed">
    <div className="panel-shell soft-divider flex h-full min-h-0 flex-col overflow-hidden border xl:rounded-l-xl xl:border-r-0">
      <NewsFeed
        onSelectItem={handleSelectItem}
        onTickerSelect={handleTickerRoute}
        onQuickTrade={handleNewsQuickTrade}
        selectedItem={selectedItem}
        onNewItem={(item) => checkNewsAgainstAlerts(item)}
      />
    </div>
    </ErrorBoundary>
  );

  /* Mobile-only trade panel — no tab bar overhead, just the form */
  const renderMobileTradePanel = () => (
    <div className="panel-shell soft-divider flex h-full min-h-0 flex-col overflow-hidden border">
      <TradingPanel
        activeVenueState={activeVenueState}
        selectedNews={selectedItem}
        newsTradeIntent={newsTradeIntent}
        availableTickers={tradableSymbols}
        quoteAsset={quoteAsset}
        onQuoteAssetChange={setQuoteAsset}
        balance={displayBalance}
        isDemoMode={venueBalance === null}
        positions={displayPositions}
        prices={activeVenuePriceMap}
        marketDataSourceLabel={activeVenueMarketLabel}
        onActiveSymbolChange={setActiveSymbol}
        onPlaceOrder={routeOrderThroughVenue}
        onConsumeNewsTradeIntent={() => setNewsTradeIntent(null)}
      />
    </div>
  );

  const renderChartPanel = (extraClassName = "") => (
    <div
      className={`panel-shell soft-divider flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border ${extraClassName}`}
    >
      <PriceChart
        key={`${activeVenueState.venueId}:${activeVenueState.activeSymbol}:${quoteAsset}`}
        activeVenue={activeVenueState.venueId}
        activeSymbol={activeVenueState.activeSymbol}
        availableTickers={tradableSymbols}
        quoteAsset={quoteAsset}
        marketDataSourceLabel={activeVenueMarketLabel}
        liveTickerPrice={
          activeVenueState.venueId === "binance" ||
          activeVenueState.venueId === "okx" ||
          activeVenueState.venueId === "bybit"
            ? getTickerDisplayPrice(activeVenueTicker) ?? undefined
            : undefined
        }
        liveFeedConnected={activeVenueFeedState === "connected"}
        selectedEvent={selectedItem}
        eventItems={chartEventItems}
        positions={displayPositions}
        orders={displayOrders}
        onUpdatePositionTpSl={handleSetVenueTpSl}
        onPlaceOrder={placeOrder}
        onTickerChange={setActiveSymbol}
      />
      {!isMobile && <OrderBookMini ticker={activeVenueState.activeSymbol} />}
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
        <div className="flex overflow-x-auto px-1.5 py-1.5 gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            { id: "trade"   as const, label: "Trade",   Icon: TrendingUp },
            { id: "dex"     as const, label: "DEX",     Icon: Zap        },
            { id: "signals" as const, label: "Signals", Icon: Activity   },
            { id: "watch"   as const, label: "Watch",   Icon: Eye        },
          ]).map(({ id, label, Icon }) => {
            const isActive = rightTab === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setRightTab(id)}
                data-active={isActive}
                className="right-panel-tab shrink-0"
              >
                <Icon className="tab-icon" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {rightTab === "trade" && (
        <TradingPanel
          activeVenueState={activeVenueState}
          selectedNews={selectedItem}
          newsTradeIntent={newsTradeIntent}
          availableTickers={tradableSymbols}
          quoteAsset={quoteAsset}
          onQuoteAssetChange={setQuoteAsset}
          balance={displayBalance}
          isDemoMode={venueBalance === null}
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

      {rightTab === "signals" && (
        <ErrorBoundary label="Signals">
          <div className="tab-content-enter min-h-0 flex-1 overflow-hidden">
            <SignalsPanel
              quotes={wsQuotes}
              activeTicker={activeVenueState.activeSymbol}
              onSelectTicker={(ticker) => {
                setActiveSymbol(ticker);
                setRightTab("trade");
              }}
            />
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
                  venueId={activeVenueState.venueId}
                  availableTickers={tradableSymbols}
                  quoteAsset={quoteAsset}
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

    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden bg-black" style={{ minHeight: "100svh", height: "100dvh" }}>
      <div className="panel-header brand-aura soft-divider status-glow relative z-40 flex shrink-0 items-center justify-center overflow-visible border-b px-2 py-0.5 sm:px-4 sm:py-1.5 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(212,161,31,0.55),transparent)]">
        {/* Left: Fear & Greed + page nav */}
        <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-4 flex items-center gap-2">
          <div className="hidden sm:block"><FearGreedPill /></div>
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
        <div className="relative z-10 flex items-center justify-center gap-1.5 px-2">
          <BrandMark />
          {/* Live dot — inline next to logo, no text */}
          {wsConnected && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full status-dot-online live-dot"
              title="Live feed connected"
            />
          )}
        </div>

        {/* Right: wallet connect */}
        <div ref={headerControlRef} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-4">
          <div className="panel-shell-alt flex items-center gap-1 rounded-2xl px-1.5 py-1 sm:gap-1.5 sm:px-2 sm:py-1.5">
            <button
              type="button"
              onClick={() => setQuoteAsset((prev) => (prev === "USDT" ? "USDC" : "USDT"))}
              className="terminal-chip hidden items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] sm:inline-flex"
              title="Toggle pair quote asset (USDT/USDC)"
            >
              <span className="text-zinc-500">Pair</span>
              <span className="text-[#f3ead7]">{quoteAsset}</span>
            </button>
            {/* Wallet icon-only on mobile, icon+text on desktop */}
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="brand-chip-active shimmer-on-hover inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] sm:gap-2 sm:px-3 sm:py-2"
            >
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
            {/* Platform label: shorter on mobile */}
            <button
              type="button"
              onClick={() => setHeaderConnectOpen((open) => !open)}
              className="terminal-chip shimmer-on-hover inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px]"
            >
              <span className="hidden md:inline text-zinc-500">{selectedHeaderPlatform.eyebrow}</span>
              <span className="hidden sm:inline text-[#f3ead7]">{selectedHeaderPlatform.label}</span>
              <span className="sm:hidden text-[#f3ead7]">
                {selectedHeaderPlatform.id === "hyperliquid" ? "HL"
                  : selectedHeaderPlatform.id === "dydx" ? "dYdX"
                  : selectedHeaderPlatform.label.slice(0, 3).toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Market Info Bar (desktop only) ── */}
      {isMobile && (
        <div
          className="shrink-0 border-b px-1.5 py-1"
          style={{ borderColor: "rgba(212,161,31,0.08)", background: "rgba(7,7,8,0.94)" }}
        >
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MOBILE_ROUTE_TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  tab.active
                    ? "border-[rgba(212,161,31,0.35)] bg-[rgba(212,161,31,0.12)] text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-[rgba(212,161,31,0.2)] hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="px-2 pt-1.5">
          <div className="panel-shell soft-divider overflow-hidden rounded-xl border terminal-glow-pulse">
            <div className="hidden sm:block">
              <MarketStatsBar />
            </div>
            <div className="hidden lg:block">
              <MarketSessionBar />
            </div>
          </div>
        </div>
      )}

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isMobile ? "pt-0 px-0 pb-0" : "pt-1.5 px-2 pb-2"}`}>

        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isMobile ? "gap-0" : "gap-2"}`}>
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
              {/* Tablet: chart top (55%), news+trade bottom (45%) */}
              <div className="min-h-0 overflow-hidden" style={{ flex: "0 0 57%" }}>
                {renderChartPanelWrapped("rounded-xl")}
              </div>
              <div className="flex min-h-0 overflow-hidden gap-2" style={{ flex: "0 0 calc(43% - 8px)" }}>
                <div className="min-h-0 flex-1 overflow-hidden">{renderNewsPanel()}</div>
                <div className="min-h-0 shrink-0 overflow-hidden" style={{ width: tabletRightPanelWidth }}>{renderRightPanel()}</div>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 overflow-hidden" style={{ height: mobileChartHeight }}>
                {renderChartPanel()}
              </div>
              <div
                className="flex min-h-0 flex-1 overflow-hidden"
                style={{ borderTop: "1px solid rgba(212,161,31,0.07)" }}
              >
                <div className="min-h-0 overflow-hidden" style={{ flex: mobileNewsPaneFlex }}>
                  {renderNewsPanel()}
                </div>
                <div
                  className="min-h-0 overflow-hidden"
                  style={{ flex: mobileTradePaneFlex, borderLeft: "1px solid rgba(212,161,31,0.07)" }}
                >
                  {renderMobileTradePanel()}
                </div>
              </div>
            </div>
          )}

          {showBottomPanel && (
            <div className={isMobile ? "" : "pt-2"}>
              <TradingActivityDrawer
                positions={displayPositions}
                orders={displayOrders}
                balance={displayBalance}
                equityHistory={equityHistory}
                onClosePosition={handleCloseVenuePosition}
                onCancelOrder={cancelOrder}
                onUpdatePositionTpSl={handleSetVenueTpSl}
                isLiveVenue={venuePositions !== null}
                venueName={venuePositions !== null ? activeVenueState.venueId.toUpperCase() : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar (desktop/tablet only) ───────────────────────────────────── */}
      {!isMobile && <div className="panel-header soft-divider flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1.5 sm:px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          {(["OKX", "Bybit", "HL", "dYdX"] as const).map((v) => {
            const venueMap: Record<string, string> = { OKX: "okx", Bybit: "bybit", HL: "hyperliquid", dYdX: "dydx" };
            const tooltipMap: Record<string, string> = {
              OKX: "OKX — CEX data feed",
              Bybit: "Bybit — CEX data feed",
              HL: "Hyperliquid — DEX perp trading",
              dYdX: "dYdX v4 — coming soon",
            };
            const isActive = activeVenueState.venueId === venueMap[v];
            const isConnected = isActive && activeVenueFeedState === "connected";
            const isConnecting = isActive && (activeVenueFeedState === "connecting" || activeVenueFeedState === "error");
            return (
              <div
                key={v}
                title={tooltipMap[v]}
                className={`hidden sm:flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                  isConnected
                    ? "bg-emerald-500/8 text-emerald-300"
                    : isConnecting
                      ? "bg-amber-500/10 text-amber-300"
                      : isActive
                        ? "bg-amber-500/10 text-amber-300"
                        : "text-zinc-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isConnected
                      ? "status-dot-online live-dot"
                      : isConnecting
                        ? "status-dot-pending"
                        : ""
                  }`}
                  style={!isConnected && !isConnecting ? { background: isActive ? "#d4a11f" : "#6b7280" } : undefined}
                />
                <span className={`text-[9px] tracking-[0.1em] font-${isActive ? "bold" : "normal"}`}>{v}</span>
              </div>
            );
          })}
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

        {/* Right: version badge */}
        <div className="flex shrink-0 items-center gap-2 text-[9px] text-zinc-700">
          <span
            className="rounded px-1.5 py-0.5 tracking-[0.12em] uppercase font-semibold"
            style={{
              background: "rgba(6,8,12,0.8)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "#3f3f4e",
            }}
          >
            TraderBross
          </span>
        </div>
      </div>}

      {/* ── Mobile Status Bar ─────────────────────────────────────────────── */}
      {isMobile && (
        <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-t" style={{ borderColor: "rgba(42,42,42,0.9)", background: "rgba(9,9,10,0.99)", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${wsConnected ? "status-dot-online live-dot" : "status-dot-offline"}`} />
            <span className="text-[8px] font-bold tracking-[0.16em] uppercase" style={{ color: wsConnected ? "#10b981" : "#ef4444" }}>
              {wsConnected ? "Live" : "Reconnecting"}
            </span>
          </div>
          <span className="text-[8px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#4b5563" }}>TraderBross</span>
        </div>
      )}

      {headerConnectOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[120] bg-transparent" />
            <div
              ref={headerPanelRef}
              className="panel-shell-alt fixed z-[130] max-h-[calc(100dvh-100px)] overflow-y-auto border p-3 shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
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
                        const walletReady = walletAvailability[walletLabel] ?? false;
                        const installUrl = walletInstallUrl(walletLabel);

                        return (
                          <button
                            key={walletLabel}
                            type="button"
                            onClick={() => connectHeaderWallet(walletLabel)}
                            disabled={headerConnection.status === "testing" || !walletReady}
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
                              {walletReady ? "Direct wallet request" : "Wallet not detected"}
                            </div>
                            {!walletReady && installUrl && (
                              <div className="mt-1 text-[9px] text-amber-300">
                                Install: {installUrl}
                              </div>
                            )}
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
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          name={`cex-${selectedHeaderCexPlatform}-id`}
                          data-lpignore="true"
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
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          name={`cex-${selectedHeaderCexPlatform}-secret`}
                          data-lpignore="true"
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
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          name={`cex-${selectedHeaderCexPlatform}-pass`}
                          data-lpignore="true"
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

                    {selectedHeaderCexPlatform && (
                      <label className="mt-2.5 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCexTestnetMode}
                          onChange={(e) =>
                            setCexTestnetMode((prev) => ({
                              ...prev,
                              [selectedHeaderCexPlatform]: e.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        <span className="text-[10px] text-amber-400/80">
                          {selectedHeaderCexPlatform === "okx" ? "Demo / Testnet mode" : "Testnet mode"}
                        </span>
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
                      {selectedHeaderCexPlatform &&
                      vaultTokens[selectedHeaderCexPlatform as HeaderCexPlatform] ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-500">Vault session</span>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-300">
                            Active
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-2 text-[10px] text-zinc-400">
                        {headerActionMessage || (
                          vaultTokens[selectedHeaderCexPlatform as HeaderCexPlatform]
                            ? "Credentials secured in server vault · device keeps encrypted local backup + session token."
                            : "Enter your API credentials and click Save to store them securely."
                        )}
                      </div>
                      {/* Security status */}
                      {vaultTokens[selectedHeaderCexPlatform as HeaderCexPlatform] ? (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2 py-1.5 text-[9px] text-emerald-400">
                          <span className="mt-0.5 shrink-0">🔒</span>
                          <span>Keys encrypted server-side; local backup is AES-GCM encrypted per device + user scope.</span>
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



