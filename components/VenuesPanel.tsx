"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  Circle,
  ExternalLink,
  Key,
  Wallet,
  Loader2,
  ChevronRight,
  ChevronDown,
  X,
  PlugZap,
  ShieldCheck,
  AlertTriangle,
  Trash2,
} from "lucide-react";

declare global {
  interface EthereumProvider {
    isMetaMask?: boolean;
    isRabby?: boolean;
    isCoinbaseWallet?: boolean;
    providers?: EthereumProvider[];
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    disconnect?: () => Promise<void> | void;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }

  interface SolanaProvider {
    isPhantom?: boolean;
    isSolflare?: boolean;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    connect: () => Promise<{ publicKey?: { toString: () => string } }>;
    disconnect?: () => Promise<void> | void;
  }

  interface Window {
    rabby?: EthereumProvider;
    coinbaseWalletExtension?: EthereumProvider;
    phantom?: {
      solana?: SolanaProvider;
    };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
  }
}

type VenueStatus = "not_configured" | "saved_locally" | "testing" | "connected" | "error";
type VenueType = "CEX" | "DEX";
type VenueId = "binance" | "okx" | "bybit" | "hyperliquid" | "dydx";

type VenueConnection = {
  status: VenueStatus;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  walletAddress?: string;
  walletProvider?: string;
  address?: string;
  errorMessage?: string;
  updatedAt?: number;
};

type Venue = {
  id: VenueId;
  name: string;
  type: VenueType;
  color: string;
  logo: string;
  url: string;
  apiDocsUrl?: string;
};

type Props = {
  hlWallet: string;
  onHlWalletChange: (addr: string) => void;
};

type PriceMap = Record<string, { price: number; changePct: number }>;
type ConnectionMap = Record<VenueId, VenueConnection>;
type WalletProviderKind = "evm" | "solana";
type WalletSession = {
  venueId: VenueId;
  providerLabel: string;
  providerKind: WalletProviderKind;
  provider: EthereumProvider | SolanaProvider;
  disconnectTargets?: Array<EthereumProvider | SolanaProvider>;
  cleanup: () => void;
};

const STORAGE_KEY = "traderbross.venue-connections.v1";
const ACTIVE_SESSION_KEY = "traderbross.venue-active-wallets.v1";
const REMOVED_SESSION_KEY = "traderbross.venue-removed-wallets.v1";
const OTHER_WALLET_OPTIONS = ["Phantom", "Rabby", "Solflare", "Coinbase Wallet", "WalletConnect"];
const WALLET_MARKS: Record<string, string> = {
  Phantom: "P",
  Rabby: "R",
  Solflare: "S",
  "Coinbase Wallet": "C",
  WalletConnect: "W",
};

const VENUES: Venue[] = [
  {
    id: "binance",
    name: "Binance",
    type: "CEX",
    color: "text-amber-200",
    logo: "B",
    url: "https://www.binance.com",
  },
  {
    id: "okx",
    name: "OKX",
    type: "CEX",
    color: "text-[#f3ead7]",
    logo: "O",
    url: "https://www.okx.com",
    apiDocsUrl: "https://www.okx.com/docs-v5/en/",
  },
  {
    id: "bybit",
    name: "Bybit",
    type: "CEX",
    color: "text-amber-100",
    logo: "B",
    url: "https://www.bybit.com",
    apiDocsUrl: "https://bybit-exchange.github.io/docs/v5/",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    type: "DEX",
    color: "text-[#f2deaa]",
    logo: "H",
    url: "https://app.hyperliquid.xyz",
  },
  {
    id: "dydx",
    name: "dYdX v4",
    type: "DEX",
    color: "text-[#e9d5a1]",
    logo: "D",
    url: "https://dydx.trade",
    apiDocsUrl: "https://docs.dydx.exchange/",
  },
];

const EMPTY_CONNECTIONS: ConnectionMap = {
  binance: { status: "not_configured" },
  okx: { status: "not_configured" },
  bybit: { status: "not_configured" },
  hyperliquid: { status: "not_configured" },
  dydx: { status: "not_configured" },
};

function maskValue(value?: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function getStatusMeta(status: VenueStatus) {
  switch (status) {
    case "connected":
      return {
        label: "Connected",
        badge: "brand-badge brand-badge-gold",
        icon: <CheckCircle className="h-3 w-3 text-amber-200" />,
      };
    case "saved_locally":
      return {
        label: "Saved locally",
        badge: "brand-badge",
        icon: <ShieldCheck className="h-3 w-3 text-zinc-300" />,
      };
    case "testing":
      return {
        label: "Testing connection",
        badge: "brand-badge",
        icon: <Loader2 className="h-3 w-3 animate-spin text-amber-200" />,
      };
    case "error":
      return {
        label: "Connection failed",
        badge: "brand-badge brand-badge-danger",
        icon: <AlertTriangle className="h-3 w-3 text-red-300" />,
      };
    default:
      return {
        label: "Not configured",
        badge: "brand-badge",
        icon: <Circle className="h-3 w-3 text-zinc-700" />,
      };
  }
}

function debugWalletLog(event: string, detail?: Record<string, unknown>) {
  console.info("[TraderBross Wallet]", event, detail ?? {});
}

function readSessionVenueList(key: string) {
  if (typeof window === "undefined") return [] as VenueId[];

  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as VenueId[]) : [];
  } catch {
    return [];
  }
}

function writeSessionVenueList(key: string, items: VenueId[]) {
  if (typeof window === "undefined") return;

  if (!items.length) {
    sessionStorage.removeItem(key);
    return;
  }

  sessionStorage.setItem(key, JSON.stringify(items));
}

function updateSessionVenueFlag(key: string, venueId: VenueId, enabled: boolean) {
  const current = new Set(readSessionVenueList(key));

  if (enabled) current.add(venueId);
  else current.delete(venueId);

  writeSessionVenueList(key, [...current]);
}

function writeActiveWalletSession(venueId: VenueId, providerLabel: string) {
  if (typeof window === "undefined") return;

  try {
    const current = JSON.parse(sessionStorage.getItem(ACTIVE_SESSION_KEY) ?? "{}") as Partial<Record<VenueId, string>>;
    current[venueId] = providerLabel;
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(current));
  } catch {
    // ignore session storage failures
  }
}

function clearActiveWalletSession(venueId: VenueId) {
  if (typeof window === "undefined") return;

  try {
    const current = JSON.parse(sessionStorage.getItem(ACTIVE_SESSION_KEY) ?? "{}") as Partial<Record<VenueId, string>>;
    delete current[venueId];

    if (Object.keys(current).length === 0) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }

    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(current));
  } catch {
    // ignore session storage failures
  }
}

function isEvmLikeAddress(value?: string) {
  return Boolean(value && /^0x[a-zA-Z0-9]{8,}$/.test(value));
}

function isSolanaLikeAddress(value?: string) {
  return Boolean(value && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value));
}

function isDydxLikeAddress(value?: string) {
  return Boolean(value && (value.startsWith("dydx") || isEvmLikeAddress(value) || isSolanaLikeAddress(value)));
}

function getInjectedEthereumProvider(wallet: string) {
  const root = window.ethereum as EthereumProvider | undefined;
  const providers = root?.providers?.length ? root.providers : root ? [root] : [];
  const uniqueProviders = [...new Set<EthereumProvider>([...providers, window.rabby, window.coinbaseWalletExtension].filter(Boolean) as EthereumProvider[])];

  switch (wallet) {
    case "MetaMask":
      return (
        uniqueProviders.find(
          (provider: EthereumProvider) => provider.isMetaMask && !provider.isRabby && !provider.isCoinbaseWallet
        ) ?? null
      );
    case "Rabby":
      return (
        window.rabby ??
        uniqueProviders.find((provider: EthereumProvider) => provider.isRabby) ??
        null
      );
    case "Coinbase Wallet":
      return (
        window.coinbaseWalletExtension ??
        uniqueProviders.find((provider: EthereumProvider) => provider.isCoinbaseWallet) ??
        null
      );
    default:
      return null;
  }
}

async function connectEvmWallet(wallet: string) {
  const provider = getInjectedEthereumProvider(wallet);
  if (!provider) {
    throw new Error(`${wallet} is not available in this browser.`);
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts?.[0];
  if (!address) {
    throw new Error(`No wallet address returned from ${wallet}.`);
  }

  return { address, provider, disconnectTargets: [provider] };
}

async function connectSolanaWallet(wallet: string) {
  const candidates =
    wallet === "Phantom"
      ? [
          window.phantom?.solana,
          window.solana?.isPhantom ? window.solana : undefined,
          window.solflare?.isPhantom ? window.solflare : undefined,
        ]
      : wallet === "Solflare"
        ? [
            window.solflare,
            window.solana?.isSolflare ? window.solana : undefined,
            window.phantom?.solana?.isSolflare ? window.phantom.solana : undefined,
          ]
        : [];
  const disconnectTargets = [...new Set<SolanaProvider>(candidates.filter(Boolean) as SolanaProvider[])];
  const provider = disconnectTargets[0] ?? null;

  if (!provider) {
    throw new Error(`${wallet} is not available in this browser.`);
  }

  const response = await provider.connect();
  const address = response.publicKey?.toString();

  if (!address) {
    throw new Error(`No wallet address returned from ${wallet}.`);
  }

  return { address, provider, disconnectTargets };
}

export default function VenuesPanel({ hlWallet, onHlWalletChange }: Props) {
  const [connections, setConnections] = useState<ConnectionMap>(EMPTY_CONNECTIONS);
  const [prices, setPrices] = useState<Record<string, PriceMap>>({}); 
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [activeVenueId, setActiveVenueId] = useState<VenueId | null>(null);
  const [selectedDexId, setSelectedDexId] = useState<VenueId>("hyperliquid");
  const [form, setForm] = useState<VenueConnection>({ status: "not_configured" });
  const walletSessionsRef = useRef<Partial<Record<VenueId, WalletSession>>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<ConnectionMap>;
      const removedVenues = new Set(readSessionVenueList(REMOVED_SESSION_KEY));
      const merged: ConnectionMap = { ...EMPTY_CONNECTIONS, ...parsed };
      const normalized = { ...merged };

      (["hyperliquid", "dydx"] as const).forEach((venueId) => {
        if (removedVenues.has(venueId)) {
          normalized[venueId] = { status: "not_configured" };
          return;
        }

        if (normalized[venueId].status === "connected") {
          normalized[venueId] = {
            ...normalized[venueId],
            status: "saved_locally",
            errorMessage: undefined,
          };
        }
      });

      setConnections(normalized);
      if (removedVenues.has("hyperliquid")) {
        onHlWalletChange("");
      }
    } catch {
      // ignore malformed local storage
    }
  }, [onHlWalletChange]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch {
      // ignore local storage failures
    }
  }, [connections]);

  useEffect(() => {
    if (
      hlWallet &&
      walletSessionsRef.current.hyperliquid &&
      connections.hyperliquid.walletAddress !== hlWallet
    ) {
      setConnections((prev) => ({
        ...prev,
        hyperliquid: {
          ...prev.hyperliquid,
          walletAddress: hlWallet,
          status: prev.hyperliquid.status === "connected" ? "connected" : "saved_locally",
        },
      }));
    }
  }, [hlWallet, connections.hyperliquid.walletAddress]);

  useEffect(() => {
    return () => {
      Object.values(walletSessionsRef.current).forEach((session) => session?.cleanup());
      walletSessionsRef.current = {};
    };
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingPrices(true);
      const [bnRes, okxRes, bybitRes] = await Promise.allSettled([
        fetch("/api/prices?type=quotes").then((r) => r.json()),
        fetch("/api/okx?type=quotes").then((r) => r.json()),
        fetch("/api/bybit?type=quotes").then((r) => r.json()),
      ]);

      const toMap = (quotes: Array<{ symbol: string; price: number; changePct: number }>): PriceMap =>
        Object.fromEntries((quotes || []).map((q) => [q.symbol, { price: q.price, changePct: q.changePct }]));

      setPrices({
        Binance: bnRes.status === "fulfilled" ? toMap(bnRes.value) : {},
        OKX: okxRes.status === "fulfilled" ? toMap(okxRes.value) : {},
        Bybit: bybitRes.status === "fulfilled" ? toMap(bybitRes.value) : {},
      });
      setLoadingPrices(false);
    };

    fetchAll();
    const id = setInterval(fetchAll, 15_000);
    return () => clearInterval(id);
  }, []);

  const activeVenue = useMemo(
    () => VENUES.find((venue) => venue.id === activeVenueId) ?? null,
    [activeVenueId]
  );
  const dexVenues = useMemo(() => VENUES.filter((venue) => venue.type === "DEX"), []);
  const cexVenues = useMemo(() => VENUES.filter((venue) => venue.type === "CEX"), []);
  const selectedDexVenue = useMemo(
    () => dexVenues.find((venue) => venue.id === selectedDexId) ?? dexVenues[0],
    [dexVenues, selectedDexId]
  );

  const openDrawer = (venue: Venue) => {
    setActiveVenueId(venue.id);
    setForm(connections[venue.id]);
  };

  const closeDrawer = () => {
    setActiveVenueId(null);
    setForm({ status: "not_configured" });
  };

  const updateConnection = (venueId: VenueId, updater: VenueConnection | ((prev: VenueConnection) => VenueConnection)) => {
    setConnections((prev) => ({
      ...prev,
      [venueId]: typeof updater === "function" ? updater(prev[venueId]) : updater,
    }));
  };

  const syncWalletConnection = (venueId: VenueId, providerLabel: string, address: string, status: VenueStatus = "connected") => {
    const payload: VenueConnection =
      venueId === "hyperliquid"
        ? {
            walletAddress: address,
            walletProvider: providerLabel,
            status,
            updatedAt: Date.now(),
          }
        : {
            address,
            walletProvider: providerLabel,
            status,
            updatedAt: Date.now(),
          };

    updateConnection(venueId, payload);

    if (activeVenueId === venueId) {
      setForm(payload);
    }

    if (venueId === "hyperliquid") {
      onHlWalletChange(address);
    }
  };

  const clearWalletSession = async (
    venueId: VenueId,
    options?: { markRemoved?: boolean; keepError?: string; source?: string }
  ) => {
    const markRemoved = options?.markRemoved ?? true;
    const source = options?.source ?? "clear";
    const existingSession = walletSessionsRef.current[venueId];

    if (existingSession) {
      const disconnectTargets = existingSession.disconnectTargets?.length
        ? existingSession.disconnectTargets
        : [existingSession.provider];

      try {
        for (const target of disconnectTargets) {
          if (typeof target.disconnect === "function") {
            await target.disconnect();
            debugWalletLog("provider_disconnect_called", {
              source,
              venueId,
              provider: existingSession.providerLabel,
            });
            continue;
          }

          if (
            existingSession.providerKind === "evm" &&
            "request" in target &&
            typeof target.request === "function"
          ) {
            try {
              await target.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }],
              });
              debugWalletLog("provider_permissions_revoked", {
                source,
                venueId,
                provider: existingSession.providerLabel,
              });
            } catch {
              debugWalletLog("provider_disconnect_not_supported", {
                source,
                venueId,
                provider: existingSession.providerLabel,
              });
            }
          }
        }
      } catch (error) {
        debugWalletLog("provider_disconnect_failed", {
          source,
          venueId,
          provider: existingSession.providerLabel,
          message: error instanceof Error ? error.message : "unknown",
        });
      } finally {
        existingSession.cleanup();
        delete walletSessionsRef.current[venueId];
      }
    }

    clearActiveWalletSession(venueId);
    updateSessionVenueFlag(REMOVED_SESSION_KEY, venueId, markRemoved);

    const resetState: VenueConnection = options?.keepError
      ? { status: "error", errorMessage: options.keepError, updatedAt: Date.now() }
      : { status: "not_configured" };

    updateConnection(venueId, resetState);

    if (activeVenueId === venueId) {
      setForm(resetState);
    }

    if (venueId === "hyperliquid") {
      onHlWalletChange("");
    }

    debugWalletLog("wallet_state_cleared", {
      source,
      venueId,
      markRemoved,
    });
  };

  const attachWalletSession = (
    venueId: VenueId,
    providerLabel: string,
    providerKind: WalletProviderKind,
    provider: EthereumProvider | SolanaProvider,
    disconnectTargets?: Array<EthereumProvider | SolanaProvider>
  ) => {
    const cleanups: Array<() => void> = [];
    const subscribe = (event: string, handler: (...args: unknown[]) => void) => {
      if (typeof provider.on === "function") {
        provider.on(event, handler);
        cleanups.push(() => {
          if (typeof provider.removeListener === "function") provider.removeListener(event, handler);
          else if (typeof provider.off === "function") provider.off(event, handler);
        });
      }
    };

    if (providerKind === "evm") {
      subscribe("accountsChanged", (...args: unknown[]) => {
        const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
        debugWalletLog("accounts_changed", { venueId, provider: providerLabel, count: accounts.length });

        if (!accounts.length) {
          void clearWalletSession(venueId, { markRemoved: true, source: "accounts_changed" });
          return;
        }

        syncWalletConnection(venueId, providerLabel, accounts[0], "connected");
      });

      subscribe("chainChanged", (...args: unknown[]) => {
        debugWalletLog("chain_changed", { venueId, provider: providerLabel, chain: String(args[0] ?? "") });
      });

      subscribe("disconnect", () => {
        void clearWalletSession(venueId, { markRemoved: true, source: "provider_disconnect_event" });
      });

      subscribe("providerChanged", (...args: unknown[]) => {
        debugWalletLog("provider_changed", { venueId, provider: providerLabel, payload: String(args[0] ?? "") });
      });
    } else {
      subscribe("disconnect", () => {
        void clearWalletSession(venueId, { markRemoved: true, source: "provider_disconnect_event" });
      });

      subscribe("accountChanged", (...args: unknown[]) => {
        const nextAddress =
          typeof args[0] === "string"
            ? (args[0] as string)
            : typeof (args[0] as { toString?: () => string } | undefined)?.toString === "function"
              ? (args[0] as { toString: () => string }).toString()
              : "";

        debugWalletLog("account_changed", { venueId, provider: providerLabel, hasAddress: Boolean(nextAddress) });

        if (!nextAddress) {
          void clearWalletSession(venueId, { markRemoved: true, source: "account_changed" });
          return;
        }

        syncWalletConnection(venueId, providerLabel, nextAddress, "connected");
      });
    }

    walletSessionsRef.current[venueId]?.cleanup();
    walletSessionsRef.current[venueId] = {
      venueId,
      providerLabel,
      providerKind,
      provider,
      disconnectTargets,
      cleanup: () => {
        cleanups.forEach((cleanup) => cleanup());
      },
    };

    writeActiveWalletSession(venueId, providerLabel);
    updateSessionVenueFlag(REMOVED_SESSION_KEY, venueId, false);
    debugWalletLog("wallet_session_attached", { venueId, provider: providerLabel, providerKind });
  };

  const saveConnection = () => {
    if (!activeVenue) return;

    if (activeVenue.type === "CEX") {
      const hasRequired = Boolean(form.apiKey?.trim() && form.apiSecret?.trim());
      updateConnection(activeVenue.id, {
        ...connections[activeVenue.id],
        apiKey: form.apiKey?.trim(),
        apiSecret: form.apiSecret?.trim(),
        passphrase: form.passphrase?.trim(),
        status: hasRequired ? "saved_locally" : "not_configured",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      return;
    }

    if (activeVenue.id === "hyperliquid") {
      const walletAddress = form.walletAddress?.trim();
      updateSessionVenueFlag(REMOVED_SESSION_KEY, activeVenue.id, false);
      updateConnection(activeVenue.id, {
        ...connections.hyperliquid,
        walletAddress,
        status: walletAddress ? "saved_locally" : "not_configured",
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      onHlWalletChange(walletAddress ?? "");
      return;
    }

    const address = form.address?.trim();
    updateSessionVenueFlag(REMOVED_SESSION_KEY, activeVenue.id, false);
    updateConnection(activeVenue.id, {
      ...connections.dydx,
      address,
      status: address ? "saved_locally" : "not_configured",
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  };

  const testConnection = async () => {
    if (!activeVenue) return;

    updateConnection(activeVenue.id, (prev) => ({
      ...prev,
      ...form,
      status: "testing",
      errorMessage: undefined,
    }));

    await new Promise((resolve) => setTimeout(resolve, 900));

    const next = { ...form };
    let success = false;
    let errorMessage = "";
    let finalStatus: VenueStatus = "error";

    if (activeVenue.type === "CEX") {
      success = Boolean(next.apiKey?.trim() && next.apiSecret?.trim() && next.apiKey!.length >= 8);
      if (!success) errorMessage = "Missing or invalid API credentials.";
      finalStatus = success ? "connected" : "error";
    } else if (activeVenue.id === "hyperliquid") {
      success = isEvmLikeAddress(next.walletAddress?.trim()) || isSolanaLikeAddress(next.walletAddress?.trim());
      if (!success) errorMessage = "Use a valid wallet address like 0x... or a supported base58 wallet.";
      finalStatus = walletSessionsRef.current.hyperliquid ? "connected" : success ? "saved_locally" : "error";
    } else {
      success = isDydxLikeAddress(next.address?.trim());
      if (!success) errorMessage = "Use a valid dYdX or wallet-style address placeholder.";
      finalStatus = walletSessionsRef.current.dydx ? "connected" : success ? "saved_locally" : "error";
    }

    const payload: VenueConnection = {
      ...connections[activeVenue.id],
      ...next,
      status: finalStatus,
      errorMessage: success ? undefined : errorMessage,
      updatedAt: Date.now(),
    };

    updateConnection(activeVenue.id, payload);
    setForm(payload);

    if (success) {
      updateSessionVenueFlag(REMOVED_SESSION_KEY, activeVenue.id, false);
    }

    if (activeVenue.id === "hyperliquid" && finalStatus === "connected") {
      onHlWalletChange(success ? payload.walletAddress ?? "" : "");
    }
  };

  const removeConnection = () => {
    if (!activeVenue) return;

    if (activeVenue.type === "DEX") {
      void clearWalletSession(activeVenue.id, { markRemoved: true, source: "manual_remove" });
      return;
    }

    updateConnection(activeVenue.id, { status: "not_configured" });
    setForm({ status: "not_configured" });
  };

  const connectInjectedWallet = async (providerLabel: string) => {
    if (!activeVenue || activeVenue.type !== "DEX") return;

    await clearWalletSession(activeVenue.id, { markRemoved: false, source: "switch_wallet" });

    const testingState: VenueConnection = {
      status: "testing",
      errorMessage: undefined,
    };
    updateConnection(activeVenue.id, testingState);
    setForm(testingState);

    try {
      const result =
        providerLabel === "MetaMask" || providerLabel === "Rabby" || providerLabel === "Coinbase Wallet"
          ? await connectEvmWallet(providerLabel)
          : providerLabel === "Phantom" || providerLabel === "Solflare"
            ? await connectSolanaWallet(providerLabel)
            : (() => {
                throw new Error(`${providerLabel} integration is not available yet.`);
              })();

      attachWalletSession(
        activeVenue.id,
        providerLabel,
        providerLabel === "MetaMask" || providerLabel === "Rabby" || providerLabel === "Coinbase Wallet" ? "evm" : "solana",
        result.provider,
        result.disconnectTargets
      );

      syncWalletConnection(activeVenue.id, providerLabel, result.address, "connected");
      debugWalletLog("wallet_connected", {
        venueId: activeVenue.id,
        provider: providerLabel,
        address: result.address.slice(0, 10),
      });
    } catch (error) {
      const failed: VenueConnection = {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Wallet connection failed.",
        updatedAt: Date.now(),
      };
      updateConnection(activeVenue.id, failed);
      setForm(failed);
      clearActiveWalletSession(activeVenue.id);
      debugWalletLog("wallet_connect_failed", {
        venueId: activeVenue.id,
        provider: providerLabel,
        message: failed.errorMessage,
      });
    }
  };

  const compareTickers = ["BTC", "ETH", "SOL"];
  const venuesWithData = ["Binance", "OKX", "Bybit"];

  const fmtPrice = (price: number) =>
    price >= 1000
      ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : price >= 1
        ? `$${price.toFixed(3)}`
        : `$${price.toFixed(5)}`;

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto text-xs">
        <div className="panel-header soft-divider shrink-0 border-b px-3 py-2">
          <span className="brand-section-title text-xs">Venue Connections</span>
        </div>

        <div className="divide-y divide-[rgba(212,161,31,0.06)]">
          <div className="bg-[rgba(212,161,31,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            Centralized (CEX)
          </div>
          {cexVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              connection={connections[venue.id]}
              onOpen={() => openDrawer(venue)}
            />
          ))}

          <DexWorkspace
            venues={dexVenues}
            selectedVenue={selectedDexVenue}
            connection={connections[selectedDexVenue.id]}
            onSelectVenue={(venueId) => setSelectedDexId(venueId)}
            onOpenConnection={() => openDrawer(selectedDexVenue)}
          />
        </div>

        <div className="mt-2 border-t border-[rgba(212,161,31,0.08)]">
          <div className="bg-[rgba(212,161,31,0.04)] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            Price Comparison
          </div>
          {loadingPrices ? (
            <div className="flex items-center gap-2 px-3 py-3 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(212,161,31,0.06)]">
                  <td className="px-3 py-1 text-[9px] text-zinc-500">Ticker</td>
                  {venuesWithData.map((venue) => (
                    <td key={venue} className="px-2 py-1 text-right text-[9px] text-zinc-500">
                      {venue}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareTickers.map((ticker) => {
                  const rows = venuesWithData.map((venue) => prices[venue]?.[ticker]);
                  const validPrices = rows.filter(Boolean).map((row) => row!.price);
                  const minPrice = Math.min(...validPrices);
                  const maxPrice = Math.max(...validPrices);

                  return (
                    <tr key={ticker} className="border-b border-[rgba(212,161,31,0.05)]">
                      <td className="px-3 py-1 font-bold text-[#f3ead7]">{ticker}</td>
                      {rows.map((row, index) => {
                        if (!row) {
                          return (
                            <td key={index} className="px-2 py-1 text-right text-zinc-700">
                              -
                            </td>
                          );
                        }

                        const isBest = row.price === minPrice && minPrice !== maxPrice;

                        return (
                          <td
                            key={index}
                            className={`px-2 py-1 text-right tabular-nums ${
                              isBest ? "font-bold text-amber-200" : "text-zinc-300"
                            }`}
                          >
                            {fmtPrice(row.price)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="px-3 py-1 text-[9px] text-zinc-600">Gold highlight = most competitive quote</p>
        </div>
      </div>

      {activeVenue && (
        <ConnectionDrawer
          venue={activeVenue}
          form={form}
          onChange={setForm}
          onClose={closeDrawer}
          onSave={saveConnection}
          onTest={testConnection}
          onRemove={removeConnection}
          onConnectWallet={connectInjectedWallet}
        />
      )}
    </>
  );
}

function DexWorkspace({
  venues,
  selectedVenue,
  connection,
  onSelectVenue,
  onOpenConnection,
}: {
  venues: Venue[];
  selectedVenue: Venue;
  connection: VenueConnection;
  onSelectVenue: (venueId: VenueId) => void;
  onOpenConnection: () => void;
}) {
  const statusMeta = getStatusMeta(connection.status);
  const note = getVenueNote(selectedVenue, connection);
  const connectedValue = selectedVenue.id === "hyperliquid" ? connection.walletAddress : connection.address;

  return (
    <div className="mt-2 border-t border-[rgba(212,161,31,0.06)]">
      <div className="flex items-center justify-between bg-[rgba(212,161,31,0.04)] px-3 py-2">
        <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Decentralized (DEX)</span>
        <button
          type="button"
          onClick={onOpenConnection}
          className="brand-chip-active rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em]"
        >
          Cuzdan Bagla
        </button>
      </div>

      <div className="flex gap-1.5 px-3 py-2">
        {venues.map((venue) => {
          const active = venue.id === selectedVenue.id;
          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => onSelectVenue(venue.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                active
                  ? "border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.12)] text-amber-200"
                  : "border-[rgba(255,255,255,0.06)] bg-[#111317] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {venue.name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenConnection}
        className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded-2xl border border-[rgba(212,161,31,0.08)] bg-[rgba(255,255,255,0.01)] px-3 py-3 text-left transition-colors hover:bg-[rgba(212,161,31,0.03)]"
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,161,31,0.12)] bg-[#111317] text-[12px] font-bold ${selectedVenue.color}`}
        >
          {selectedVenue.logo}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#f3ead7]">{selectedVenue.name}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] ${statusMeta.badge}`}>
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500">{note}</p>
          <div className="mt-2 flex items-center gap-2 text-[9px] text-zinc-400">
            <Wallet className="h-3 w-3" />
            <span>{maskValue(connectedValue)}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-zinc-600">
              Baglantiyi Yonet <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

function VenueCard({
  venue,
  connection,
  onOpen,
}: {
  venue: Venue;
  connection: VenueConnection;
  onOpen: () => void;
}) {
  const statusMeta = getStatusMeta(connection.status);
  const note = getVenueNote(venue, connection);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(212,161,31,0.03)]"
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,161,31,0.12)] bg-[#111317] text-[11px] font-bold ${venue.color}`}
      >
        {venue.logo}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#f3ead7]">{venue.name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${
              venue.type === "CEX" ? "brand-badge brand-badge-gold" : "brand-badge"
            }`}
          >
            {venue.type}
          </span>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] ${statusMeta.badge}`}>
            {statusMeta.icon}
            {statusMeta.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[9px] text-zinc-500">{note}</p>
        <div className="mt-1 flex items-center gap-2">
          {venue.type === "CEX" ? (
            <span className="flex items-center gap-0.5 text-[9px] text-zinc-400">
              <Key className="h-2.5 w-2.5" /> {maskValue(connection.apiKey)}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[9px] text-zinc-400">
              <Wallet className="h-2.5 w-2.5" /> {maskValue(connection.walletAddress ?? connection.address)}
            </span>
          )}
          <a
            href={venue.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex items-center gap-0.5 text-[9px] text-zinc-600 hover:text-zinc-400"
          >
            <ExternalLink className="h-2.5 w-2.5" /> Open
          </a>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
        </div>
      </div>
    </button>
  );
}

function ConnectionDrawer({
  venue,
  form,
  onChange,
  onClose,
  onSave,
  onTest,
  onRemove,
  onConnectWallet,
}: {
  venue: Venue;
  form: VenueConnection;
  onChange: (next: VenueConnection) => void;
  onClose: () => void;
  onSave: () => void;
  onTest: () => void;
  onRemove: () => void;
  onConnectWallet: (providerLabel: string) => Promise<void>;
}) {
  const statusMeta = getStatusMeta(form.status);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletConnected = venue.type === "DEX" && form.status === "connected" && Boolean(form.walletProvider);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [venue.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]">
      <button type="button" aria-label="Close drawer" className="flex-1" onClick={onClose} />

      <div className="panel-shell relative h-full w-full max-w-md border-l border-[rgba(212,161,31,0.14)] p-4">
        <div className="panel-header soft-divider flex items-center justify-between rounded-2xl border px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200">{venue.type} Connection</div>
            <div className="mt-1 text-lg font-semibold text-[#f5efe1]">{venue.name}</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/8 p-2 text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[rgba(212,161,31,0.1)] bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${statusMeta.badge}`}>
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-6 text-zinc-400">
            Credentials are stored locally on this device for MVP only. Real exchange-side trading
            execution is not enabled from this panel yet.
          </p>
        </div>

        {venue.type === "CEX" ? (
          <div className="mt-4 space-y-3">
            <Field
              label="API Key"
              value={form.apiKey ?? ""}
              onChange={(value) => onChange({ ...form, apiKey: value })}
              placeholder={`${venue.name} API key`}
            />
            <Field
              label="API Secret"
              value={form.apiSecret ?? ""}
              onChange={(value) => onChange({ ...form, apiSecret: value })}
              placeholder={`${venue.name} API secret`}
            />
            {venue.id === "okx" && (
              <Field
                label="Passphrase"
                value={form.passphrase ?? ""}
                onChange={(value) => onChange({ ...form, passphrase: value })}
                placeholder="Optional / required by venue"
              />
            )}
          </div>
        ) : venue.id === "hyperliquid" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[rgba(212,161,31,0.1)] bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-amber-200">
                <PlugZap className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-[0.18em]">Wallet-style placeholder</span>
              </div>
              <p className="text-[11px] leading-6 text-zinc-400">
                Hyperliquid uses wallet connectivity rather than CEX API credentials. Connected
                wallets are saved locally automatically for MVP state handling.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onConnectWallet("MetaMask")}
                className="brand-chip-active rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em]"
              >
                MetaMask
              </button>
              <WalletMenu
                open={walletMenuOpen}
                onToggle={() => setWalletMenuOpen((prev) => !prev)}
                onSelect={async (wallet) => {
                  setWalletMenuOpen(false);
                  await onConnectWallet(wallet);
                }}
              />
            </div>
            {form.walletProvider && (
              <p className="text-[10px] text-zinc-500">
                Connected provider: <span className="text-zinc-300">{form.walletProvider}</span>
              </p>
            )}
            <Field
              label="Wallet Address"
              value={form.walletAddress ?? ""}
              onChange={(value) => onChange({ ...form, walletAddress: value })}
              placeholder="0x... or base58 wallet address"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[rgba(212,161,31,0.1)] bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-amber-200">
                <Wallet className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-[0.18em]">Address / wallet placeholder</span>
              </div>
              <p className="text-[11px] leading-6 text-zinc-400">
                dYdX v4 is handled as an address or wallet-style connection flow for MVP, ready for
                deeper wallet integration later. Connected wallets are saved locally automatically.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onConnectWallet("MetaMask")}
                className="brand-chip-active rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em]"
              >
                MetaMask
              </button>
              <WalletMenu
                open={walletMenuOpen}
                onToggle={() => setWalletMenuOpen((prev) => !prev)}
                onSelect={async (wallet) => {
                  setWalletMenuOpen(false);
                  await onConnectWallet(wallet);
                }}
              />
            </div>
            {form.walletProvider && (
              <p className="text-[10px] text-zinc-500">
                Connected provider: <span className="text-zinc-300">{form.walletProvider}</span>
              </p>
            )}
            <Field
              label="Address"
              value={form.address ?? ""}
              onChange={(value) => onChange({ ...form, address: value })}
              placeholder="dydx1... or 0x..."
            />
          </div>
        )}

        {form.errorMessage && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[11px] text-red-300">
            {form.errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!walletConnected && (
            <button
              onClick={onSave}
              className="brand-chip-active rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
            >
              {venue.type === "DEX" ? "Save Manual Address" : "Save"}
            </button>
          )}
          <button
            onClick={onTest}
            className="terminal-chip rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
          >
            {venue.type === "DEX" ? "Verify Connection" : "Test Connection"}
          </button>
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-xl border border-red-400/12 bg-red-400/[0.05] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove Connection
          </button>
        </div>
        {walletConnected && (
          <p className="mt-3 text-[10px] text-zinc-500">
            Wallet connections are saved locally as soon as the provider approves access.
          </p>
        )}
      </div>
    </div>
  );
}

function WalletMenu({
  open,
  onToggle,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  onSelect: (wallet: string) => Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onToggle]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="terminal-chip flex w-full items-center justify-between rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-100"
      >
        <span>Other Wallet</span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-full min-w-[170px] overflow-hidden rounded-xl border border-[rgba(212,161,31,0.14)] bg-[#111317] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          {OTHER_WALLET_OPTIONS.map((wallet) => (
            <button
              key={wallet}
              type="button"
              onClick={() => void onSelect(wallet)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-200 transition-colors hover:bg-[rgba(212,161,31,0.08)] hover:text-[#f3ead7]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.06)] text-[9px] font-bold text-amber-200">
                  {WALLET_MARKS[wallet] ?? wallet.slice(0, 1)}
                </span>
                <span className="truncate">{wallet}</span>
              </span>
              <Wallet className="h-3 w-3 shrink-0 text-zinc-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="terminal-input w-full rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
      />
    </label>
  );
}

function getVenueNote(venue: Venue, connection: VenueConnection) {
  switch (connection.status) {
    case "connected":
      if (venue.type === "CEX") return "Credentials tested and restored locally.";
      if (venue.id === "hyperliquid") {
        return connection.walletAddress
          ? `${connection.walletProvider ?? "Wallet"} • ${connection.walletAddress.slice(0, 8)}... connected`
          : "Wallet connected.";
      }
      return connection.address
        ? `${connection.walletProvider ?? "Wallet"} • ${connection.address.slice(0, 12)}... connected`
        : "Address connected.";
    case "saved_locally":
      if (venue.type === "CEX") return "Credentials saved in browser storage.";
      if (venue.id === "hyperliquid") {
        return connection.walletAddress
          ? `${connection.walletProvider ?? "Wallet"} • ${connection.walletAddress.slice(0, 8)}... saved locally`
          : "Wallet placeholder saved locally.";
      }
      return connection.address
        ? `${connection.walletProvider ?? "Wallet"} • ${connection.address.slice(0, 12)}... saved locally`
        : "Address saved locally.";
    case "testing":
      return "Testing local connection placeholder...";
    case "error":
      return connection.errorMessage || "Connection test failed.";
    default:
      return venue.type === "CEX"
        ? "Open to add API credentials for MVP local storage."
        : venue.id === "hyperliquid"
          ? "Open to store a wallet-style placeholder connection."
          : "Open to add a dYdX address placeholder.";
  }
}
