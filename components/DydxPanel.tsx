"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ExternalLink,
  Wallet,
  ChevronDown,
  Activity,
} from "lucide-react";
import { getDydxReferralUrl } from "@/lib/dydx-order";

type Tab = "markets" | "positions" | "trade";

type DydxAsset = {
  name: string;
  ticker: string;
  markPx: number;
  fundingRate: number;
  openInterest: number;
  volume24h: number;
  change24h: number;
  maxLeverage: number;
};

type DydxPosition = {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number;
  pnl: number;
  roe: number;
  margin: number;
};

type DydxAccount = {
  balance: number;
  freeCollateral: number;
  positions: DydxPosition[];
};

function fmt(n: number, decimals = 2) {
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(decimals);
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

const DYDX_ADDR_KEY = "traderbross.dydx-address.v1";

export default function DydxPanel() {
  const [address, setAddress] = useState(() => {
    try { return sessionStorage.getItem(DYDX_ADDR_KEY) ?? ""; } catch { return ""; }
  });
  const [inputAddr, setInputAddr] = useState(() => {
    try { return sessionStorage.getItem(DYDX_ADDR_KEY) ?? ""; } catch { return ""; }
  });
  const [assets, setAssets] = useState<DydxAsset[]>([]);
  const [account, setAccount] = useState<DydxAccount | null>(null);
  const [loadingMkts, setLoadingMkts] = useState(true);
  const [acctError, setAcctError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [orderMsg, setOrderMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>("markets");

  const fetchMarkets = useCallback(async () => {
    setLoadingMkts(true);
    try {
      const res = await fetch("/api/dydx?type=markets");
      const data = await res.json();
      if (data.assets?.length) setAssets(data.assets);
    } catch { /* silent */ }
    setLoadingMkts(false);
  }, []);

  const fetchAccount = useCallback(async (addr: string) => {
    if (!addr.startsWith("dydx")) {
      setAcctError("Address must start with 'dydx'");
      return;
    }
    setAcctError("");
    try {
      const res = await fetch(`/api/dydx?type=account&address=${addr}`);
      const data = await res.json();
      if (data.error) setAcctError(data.error);
      else setAccount(data);
    } catch {
      setAcctError("Failed to fetch account");
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const saved = (() => { try { return sessionStorage.getItem(DYDX_ADDR_KEY); } catch { return null; } })();
    if (saved) fetchAccount(saved);
  }, [fetchMarkets, fetchAccount]);

  useEffect(() => {
    const id = setInterval(fetchMarkets, 30_000);
    return () => clearInterval(id);
  }, [fetchMarkets]);

  const handleConnect = () => {
    const addr = inputAddr.trim();
    if (!addr) return;
    setAddress(addr);
    try { sessionStorage.setItem(DYDX_ADDR_KEY, addr); } catch { /* ignore */ }
    fetchAccount(addr);
  };

  const handleDisconnect = () => {
    setAddress("");
    setAccount(null);
    setInputAddr("");
    try { sessionStorage.removeItem(DYDX_ADDR_KEY); } catch { /* ignore */ }
  };

  const currentAsset = assets.find((a) => a.name === selectedAsset);
  const execPrice = orderType === "market" ? (currentAsset?.markPx ?? 0) : parseFloat(limitPrice) || 0;
  const sizeNum = parseFloat(size) || 0;
  const notional = sizeNum * execPrice;

  const openPnl = account?.positions.reduce((sum, p) => sum + p.pnl, 0) ?? 0;
  const positionCount = account?.positions.length ?? 0;

  const handlePlaceOrder = () => {
    if (!sizeNum || !execPrice) return;
    const sideLabel = orderSide === "buy" ? "Long" : "Short";
    setOrderMsg({
      type: "ok",
      text: `${sideLabel} ${sizeNum} ${selectedAsset} @ $${fmt(execPrice)} · ${leverage}x leverage`,
    });
    setSize("");
    setTimeout(() => setOrderMsg(null), 5000);
  };

  const referralUrl = getDydxReferralUrl();

  // ── Empty state (no address connected) ───────────────────────────────────
  if (!address) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-amber-200" />
            <span className="brand-section-title text-xs">dYdX v4</span>
            <span className="brand-badge rounded-full px-1.5 py-0.5 text-[9px]">Cosmos Perps</span>
          </div>
          {referralUrl && (
            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Sign Up <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* Connect form */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(212,161,31,0.15)] bg-[rgba(212,161,31,0.06)]">
              <Wallet className="h-6 w-6 text-amber-200/60" />
            </div>
            <p className="text-xs font-bold text-[var(--text-primary)]">Connect dYdX Account</p>
            <p className="max-w-[200px] text-[10px] leading-relaxed text-zinc-500">
              Enter your dydx1… address to view positions and place orders on dYdX v4
            </p>
          </div>

          <div className="w-full space-y-2">
            <input
              type="text"
              placeholder="dydx1abc…"
              className="terminal-input w-full rounded-xl px-3 py-2.5 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
              value={inputAddr}
              onChange={(e) => setInputAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            {acctError && (
              <div className="flex items-center gap-1 text-[9px] text-red-300">
                <AlertCircle className="h-3 w-3" /> {acctError}
              </div>
            )}
            <button
              onClick={handleConnect}
              disabled={!inputAddr.trim()}
              className="brand-chip-active w-full rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Connected state ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs">dYdX v4</span>
          <span className="brand-badge rounded-full px-1.5 py-0.5 text-[9px]">Cosmos Perps</span>
        </div>
        <div className="flex items-center gap-2">
          {referralUrl && (
            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Sign Up <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <button onClick={fetchMarkets} className="text-zinc-600 transition-colors hover:text-amber-100">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMkts ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Account bar */}
      <div className="panel-shell-alt shrink-0 border-b px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[9px] text-amber-200/70 truncate max-w-[160px]">{address}</span>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-[9px] text-zinc-600 transition-colors hover:text-red-300"
          >
            Disconnect
          </button>
        </div>

        {account ? (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-[rgba(212,161,31,0.05)] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-600">Balance</div>
              <div className="text-[11px] font-bold text-[var(--text-primary)]">${fmt(account.balance)}</div>
            </div>
            <div className="rounded-lg bg-[rgba(212,161,31,0.05)] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-600">Available</div>
              <div className="text-[11px] font-bold text-[var(--text-primary)]">${fmt(account.freeCollateral)}</div>
            </div>
            <div className="rounded-lg bg-[rgba(212,161,31,0.05)] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-600">Open P&amp;L</div>
              <div className={`text-[11px] font-bold ${openPnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {openPnl >= 0 ? "+" : ""}${fmt(Math.abs(openPnl))}
              </div>
            </div>
          </div>
        ) : acctError ? (
          <div className="flex items-center gap-1 text-[9px] text-red-300">
            <AlertCircle className="h-3 w-3 shrink-0" /> {acctError}
            <button
              onClick={() => fetchAccount(address)}
              className="ml-auto text-amber-300 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="py-1 text-[9px] text-zinc-500">Loading account…</div>
        )}
      </div>

      {/* Tab nav */}
      <div className="panel-header soft-divider flex shrink-0 border-b">
        {(["markets", "positions", "trade"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`accent-tab relative flex-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] ${
              tab === t ? "text-amber-100" : "text-zinc-500"
            }`}
          >
            {t === "positions" && positionCount > 0 ? (
              <>
                Positions
                <span className="ml-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-400/20 px-0.5 text-[8px] text-amber-300">
                  {positionCount}
                </span>
              </>
            ) : t === "markets" ? "Markets" : t === "positions" ? "Positions" : "Trade"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Markets tab ── */}
        {tab === "markets" && (
          <div>
            {loadingMkts && assets.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">Loading markets…</div>
            ) : assets.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No market data</div>
            ) : (
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="sticky top-0 border-b border-[rgba(212,161,31,0.08)] bg-[#0c0d10] text-zinc-500">
                    <th className="px-2 py-1.5 text-left font-normal">Market</th>
                    <th className="px-2 py-1.5 text-right font-normal">Price</th>
                    <th className="px-2 py-1.5 text-right font-normal">24h%</th>
                    <th className="px-2 py-1.5 text-right font-normal">Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const isUp = a.change24h >= 0;
                    const isSelected = a.name === selectedAsset;
                    return (
                      <tr
                        key={a.name}
                        onClick={() => { setSelectedAsset(a.name); setTab("trade"); }}
                        className={`cursor-pointer border-b border-[rgba(212,161,31,0.05)] transition-colors ${
                          isSelected ? "bg-[rgba(212,161,31,0.06)]" : "hover:bg-[rgba(212,161,31,0.03)]"
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                            <span className="font-bold text-[#f3ead7]">{a.name}</span>
                            <span className="text-zinc-600">-USD</span>
                          </div>
                          <div className="text-[8px] text-zinc-600">Max {a.maxLeverage}x</div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-[var(--text-primary)]">
                          ${fmt(a.markPx)}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-bold ${isUp ? "text-emerald-300" : "text-red-300"}`}>
                          <div className="flex items-center justify-end gap-0.5">
                            {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {isUp ? "+" : ""}{a.change24h.toFixed(2)}%
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-right ${a.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}`}>
                          {a.fundingRate >= 0 ? "+" : ""}{(a.fundingRate * 100).toFixed(4)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Positions tab ── */}
        {tab === "positions" && (
          <div className="p-2">
            {!account || account.positions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Activity className="h-8 w-8 text-zinc-700" />
                <p className="text-[10px] text-zinc-500">No open positions</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 border-b border-[rgba(212,161,31,0.08)] pb-1 text-[8px] uppercase tracking-[0.15em] text-zinc-600">
                  <span className="px-1">Market</span>
                  <span className="px-1 text-right">Size</span>
                  <span className="px-1 text-right">Entry</span>
                  <span className="px-1 text-right">P&amp;L</span>
                </div>
                {account.positions.map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 border-b border-[rgba(212,161,31,0.05)] py-2 text-[10px]"
                  >
                    <div className="px-1">
                      <div className="font-bold text-[var(--text-primary)]">{p.coin}</div>
                      <span
                        className={`inline-block rounded px-1 py-0.5 text-[8px] font-bold ${
                          p.side === "long"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        {p.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="px-1 text-right text-zinc-300">{p.size.toFixed(4)}</div>
                    <div className="px-1 text-right text-zinc-400">${fmt(p.entryPx)}</div>
                    <div className={`px-1 text-right font-bold ${p.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                      <div className="text-[8px] font-normal text-zinc-600">{p.roe >= 0 ? "+" : ""}{p.roe.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Trade tab ── */}
        {tab === "trade" && (
          <div className="relative space-y-3 p-3">
            {/* Coming Soon overlay */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-[#0c0d10]/90 backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
                <Layers className="h-6 w-6 text-amber-300/60" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-[var(--text-primary)]">dYdX Trading</p>
                <p className="mt-1 text-[10px] text-zinc-500">Coming Soon</p>
              </div>
              <p className="max-w-[180px] text-center text-[9px] leading-relaxed text-zinc-600">
                Keplr wallet integration with STARK key signing is in development.
              </p>
            </div>

            {/* Asset selector + price */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  className="terminal-input w-full appearance-none rounded-xl py-2 pl-3 pr-8 text-[11px] font-bold text-amber-200 outline-none"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                >
                  {assets.map((a) => (
                    <option key={a.name} value={a.name} className="bg-zinc-900">
                      {a.name}-USD
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              </div>
              {currentAsset && (
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--text-primary)]">${fmt(currentAsset.markPx)}</div>
                  <div className={`text-[9px] ${currentAsset.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}`}>
                    {currentAsset.fundingRate >= 0 ? "+" : ""}{(currentAsset.fundingRate * 100).toFixed(4)}%
                    <span className="ml-0.5 text-zinc-600">8h</span>
                  </div>
                </div>
              )}
            </div>

            {/* Order type toggle */}
            <div className="terminal-chip flex gap-0.5 rounded-xl p-0.5">
              {(["market", "limit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
                    orderType === t ? "brand-chip-active" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Side buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setOrderSide("buy")}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                  orderSide === "buy"
                    ? "bg-[linear-gradient(180deg,#157a5d,#0e5f48)] text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]"
                    : "terminal-chip text-zinc-500 hover:text-emerald-300"
                }`}
              >
                Long / Buy
              </button>
              <button
                onClick={() => setOrderSide("sell")}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                  orderSide === "sell"
                    ? "bg-[linear-gradient(180deg,#942e2e,#6e2020)] text-white shadow-[0_0_16px_rgba(239,68,68,0.3)]"
                    : "terminal-chip text-zinc-500 hover:text-red-300"
                }`}
              >
                Short / Sell
              </button>
            </div>

            {/* Limit price */}
            {orderType === "limit" && (
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Limit Price (USD)</label>
                <input
                  type="number"
                  className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                  placeholder={currentAsset ? fmt(currentAsset.markPx) : "0.00"}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            {/* Size */}
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">Size ({selectedAsset})</label>
              <input
                type="number"
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                placeholder="0.00"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>

            {/* Leverage slider */}
            <div>
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="text-zinc-500">Leverage</span>
                <span className="font-bold text-amber-200">{leverage}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={currentAsset?.maxLeverage ?? 20}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full cursor-pointer accent-amber-400"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-zinc-600">
                <span>1x</span>
                <span>{currentAsset?.maxLeverage ?? 20}x</span>
              </div>
            </div>

            {/* Order summary */}
            {sizeNum > 0 && execPrice > 0 && (
              <div className="panel-shell-alt rounded-xl p-2.5 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Notional</span>
                  <span className="text-[var(--text-primary)]">${notional.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Est. Margin ({leverage}x)</span>
                  <span className="text-[var(--text-primary)]">${(notional / leverage).toFixed(2)}</span>
                </div>
                {currentAsset && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Funding (8h)</span>
                    <span className={currentAsset.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}>
                      {currentAsset.fundingRate >= 0 ? "+" : ""}{(currentAsset.fundingRate * 100).toFixed(4)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Order feedback */}
            {orderMsg && (
              <div
                className={`rounded-xl border p-2.5 text-[10px] ${
                  orderMsg.type === "ok"
                    ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300"
                    : "border-red-400/20 bg-red-400/[0.05] text-red-300"
                }`}
              >
                {orderMsg.text}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handlePlaceOrder}
              disabled={!sizeNum || !execPrice}
              className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                orderSide === "buy"
                  ? "bg-[linear-gradient(180deg,#157a5d,#0e5f48)] text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "bg-[linear-gradient(180deg,#942e2e,#6e2020)] text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]"
              }`}
            >
              {orderSide === "buy"
                ? `Long ${selectedAsset} ${leverage}x`
                : `Short ${selectedAsset} ${leverage}x`}
            </button>

            {/* Keplr note */}
            <p className="text-center text-[9px] text-zinc-600">
              Requires Keplr wallet for live order signing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
