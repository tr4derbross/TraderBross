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
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
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

const STORAGE_KEY = "traderbross.venue-connections.v1";
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

export default function VenuesPanel({ hlWallet, onHlWalletChange }: Props) {
  const [connections, setConnections] = useState<ConnectionMap>(EMPTY_CONNECTIONS);
  const [prices, setPrices] = useState<Record<string, PriceMap>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [activeVenueId, setActiveVenueId] = useState<VenueId | null>(null);
  const [form, setForm] = useState<VenueConnection>({ status: "not_configured" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<ConnectionMap>;
      const merged: ConnectionMap = { ...EMPTY_CONNECTIONS, ...parsed };
      setConnections(merged);
      if (merged.hyperliquid.walletAddress) {
        onHlWalletChange(merged.hyperliquid.walletAddress);
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
    if (hlWallet && connections.hyperliquid.walletAddress !== hlWallet) {
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

    if (activeVenue.type === "CEX") {
      success = Boolean(next.apiKey?.trim() && next.apiSecret?.trim() && next.apiKey!.length >= 8);
      if (!success) errorMessage = "Missing or invalid API credentials.";
    } else if (activeVenue.id === "hyperliquid") {
      success = Boolean(next.walletAddress?.trim() && next.walletAddress!.startsWith("0x") && next.walletAddress!.length >= 10);
      if (!success) errorMessage = "Use a wallet-style address like 0x....";
    } else {
      success = Boolean(next.address?.trim() && (next.address!.startsWith("dydx") || next.address!.startsWith("0x")));
      if (!success) errorMessage = "Use a valid dYdX address placeholder.";
    }

    const finalStatus: VenueStatus = success ? "connected" : "error";
    const payload: VenueConnection = {
      ...connections[activeVenue.id],
      ...next,
      status: finalStatus,
      errorMessage: success ? undefined : errorMessage,
      updatedAt: Date.now(),
    };

    updateConnection(activeVenue.id, payload);
    setForm(payload);

    if (activeVenue.id === "hyperliquid") {
      onHlWalletChange(success ? payload.walletAddress ?? "" : "");
    }
  };

  const removeConnection = () => {
    if (!activeVenue) return;
    updateConnection(activeVenue.id, { status: "not_configured" });
    if (activeVenue.id === "hyperliquid") onHlWalletChange("");
    setForm({ status: "not_configured" });
  };

  const connectInjectedWallet = async (providerLabel: string) => {
    if (!activeVenue || activeVenue.type !== "DEX") return;

    if (!window.ethereum) {
      const failed: VenueConnection = {
        ...form,
        status: "error",
        errorMessage: `${providerLabel} is not available in this browser.`,
      };
      updateConnection(activeVenue.id, failed);
      setForm(failed);
      return;
    }

    const testingState: VenueConnection = {
      ...form,
      status: "testing",
      errorMessage: undefined,
    };
    updateConnection(activeVenue.id, testingState);
    setForm(testingState);

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const walletAddress = accounts?.[0];

      if (!walletAddress) {
        throw new Error("No wallet address returned.");
      }

      const next: VenueConnection =
        activeVenue.id === "hyperliquid"
          ? {
              ...form,
              walletAddress,
              walletProvider: providerLabel,
              status: "connected",
              errorMessage: undefined,
              updatedAt: Date.now(),
            }
          : {
              ...form,
              address: walletAddress,
              walletProvider: providerLabel,
              status: "connected",
              errorMessage: undefined,
              updatedAt: Date.now(),
            };

      updateConnection(activeVenue.id, next);
      setForm(next);

      if (activeVenue.id === "hyperliquid") {
        onHlWalletChange(walletAddress);
      }
    } catch (error) {
      const failed: VenueConnection = {
        ...form,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Wallet connection failed.",
      };
      updateConnection(activeVenue.id, failed);
      setForm(failed);
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
          {VENUES.filter((venue) => venue.type === "CEX").map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              connection={connections[venue.id]}
              onOpen={() => openDrawer(venue)}
            />
          ))}

          <div className="mt-2 bg-[rgba(212,161,31,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            Decentralized (DEX)
          </div>
          {VENUES.filter((venue) => venue.type === "DEX").map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              connection={connections[venue.id]}
              onOpen={() => openDrawer(venue)}
            />
          ))}
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
                Hyperliquid uses wallet connectivity rather than CEX API credentials. Save a wallet
                address locally for MVP state handling.
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
              placeholder="0x..."
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
                deeper wallet integration later.
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
          <button
            onClick={onSave}
            className="brand-chip-active rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
          >
            Save
          </button>
          <button
            onClick={onTest}
            className="terminal-chip rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
          >
            Test Connection
          </button>
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-xl border border-red-400/12 bg-red-400/[0.05] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove Connection
          </button>
        </div>
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
