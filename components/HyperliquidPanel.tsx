"use client";

import { Wallet, Zap, TrendingUp, TrendingDown, Loader2, AlertTriangle, RefreshCw, BarChart2 } from "lucide-react";
import { useHyperliquid } from "@/hooks/useHyperliquid";
import { signHLAction, buildMarketOrder, buildLimitOrder } from "@/lib/hyperliquid-sign";
import { useState } from "react";

type Props = {
  walletAddress?: string;
  onRequestConnect?: () => void;
};

type Tab = "markets" | "positions" | "trade";

export default function HyperliquidPanel({ walletAddress, onRequestConnect }: Props) {
  const [tab, setTab] = useState<Tab>("markets");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [leverage, setLeverage] = useState(10);
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { assets, assetIndex, account, wsConnected, loading, accountError, fetchAccount } = useHyperliquid(
    walletAddress || undefined
  );

  const selectedAssetData = assets.find((a) => a.name === selectedAsset);
  const execPrice = orderType === "market" ? (selectedAssetData?.markPx ?? 0) : parseFloat(limitPrice) || 0;
  const sizeNum = parseFloat(size) || 0;
  const notional = sizeNum * execPrice;
  const totalPnl = account?.positions.reduce((s, p) => s + p.pnl, 0) ?? 0;

  const placeOrder = async () => {
    if (!walletAddress || !size || parseFloat(size) <= 0) return;
    const idx = assetIndex[selectedAsset];
    if (idx === undefined) return;
    setSubmitting(true);
    setOrderMsg(null);
    try {
      const nonce = Date.now();
      const isBuy = orderSide === "buy";
      const action =
        orderType === "market"
          ? buildMarketOrder(idx, isBuy, sizeNum)
          : buildLimitOrder(idx, isBuy, sizeNum, parseFloat(limitPrice));
      const signature = await signHLAction(action, nonce);
      const res = await fetch("/api/hyperliquid/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, nonce, signature }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setOrderMsg({ type: "ok", text: "Order submitted successfully" });
        setSize("");
        fetchAccount();
      } else {
        setOrderMsg({ type: "err", text: data.response ?? "Order failed" });
      }
    } catch (err) {
      setOrderMsg({ type: "err", text: err instanceof Error ? err.message : "Signing failed" });
    }
    setSubmitting(false);
  };

  const fmt = (n: number) => {
    if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(5)}`;
  };
  const fmtBig = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">

      {/* ── Header ── */}
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-300" />
          <span className="brand-section-title text-xs">Hyperliquid</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
            wsConnected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-zinc-700/40 text-zinc-500"
          }`}>
            <span className={`h-1 w-1 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-zinc-600"}`} />
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>
        {walletAddress ? (
          <div className="flex items-center gap-2">
            <button onClick={fetchAccount} className="text-zinc-600 transition-colors hover:text-zinc-400">
              <RefreshCw className="h-3 w-3" />
            </button>
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] text-amber-300">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          </div>
        ) : (
          <button
            onClick={onRequestConnect}
            className="brand-chip-active inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
          >
            <Wallet className="h-3 w-3" />
            Connect
          </button>
        )}
      </div>

      {/* ── Account bar ── */}
      {walletAddress && account && (
        <div className="grid shrink-0 grid-cols-3 border-b border-[rgba(212,161,31,0.08)]">
          {[
            { label: "Equity", value: `$${account.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, color: "text-[var(--text-primary)]" },
            { label: "Available", value: `$${account.withdrawable.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, color: "text-amber-200" },
            { label: "Open P&L", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "text-emerald-300" : "text-red-300" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0c0d10] px-2 py-1.5 text-center">
              <div className="text-[8px] uppercase tracking-[0.18em] text-zinc-600">{s.label}</div>
              <div className={`mt-0.5 text-[11px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Account error ── */}
      {walletAddress && accountError && !account && (
        <div className="shrink-0 flex items-center gap-2 border-b border-red-400/10 bg-red-500/5 px-3 py-2 text-[10px] text-red-300">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="flex-1">{accountError}</span>
          <button onClick={fetchAccount} className="text-zinc-500 transition-colors hover:text-zinc-300">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── No wallet empty state ── */}
      {!walletAddress && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/10 bg-amber-500/5">
            <Zap className="h-6 w-6 text-amber-400/60" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#f3ead7]">Connect your wallet</div>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              Link an EVM wallet to view your Hyperliquid account, positions, and place orders.
            </p>
          </div>
          <button
            onClick={onRequestConnect}
            className="brand-chip-active rounded-xl px-5 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
          >
            <Wallet className="mr-1.5 inline h-3.5 w-3.5" />
            Open Wallet Panel
          </button>
        </div>
      )}

      {/* ── Tab nav (only when wallet connected) ── */}
      {walletAddress && (
        <>
          <div className="flex shrink-0 border-b border-zinc-800/60">
            {(["markets", "positions", "trade"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  tab === t
                    ? "border-b-2 border-amber-400/70 text-amber-200"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {t === "positions" ? `Positions${account?.positions.length ? ` (${account.positions.length})` : ""}` : t}
              </button>
            ))}
          </div>

          {/* ── Markets tab ── */}
          {tab === "markets" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-20 items-center justify-center gap-2 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading markets…</span>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex h-20 flex-col items-center justify-center gap-2 text-zinc-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[10px]">Failed to load</span>
                  <button onClick={fetchAccount} className="text-[9px] text-zinc-600 underline hover:text-zinc-400">Retry</button>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 grid grid-cols-4 border-b border-[rgba(212,161,31,0.07)] bg-[#0c0d10] px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-zinc-600">
                    <span>Market</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">24h</span>
                    <span className="text-right">Funding</span>
                  </div>
                  {assets.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => { setSelectedAsset(a.name); setTab("trade"); }}
                      className={`grid w-full grid-cols-4 border-b border-[rgba(255,255,255,0.03)] px-2 py-2 text-left transition-colors ${
                        selectedAsset === a.name
                          ? "bg-[rgba(212,161,31,0.06)]"
                          : "hover:bg-[rgba(255,255,255,0.02)]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {selectedAsset === a.name && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                        <span className="font-bold text-[#f3ead7]">{a.name}</span>
                      </div>
                      <span className="text-right tabular-nums text-[var(--text-primary)]">{fmt(a.markPx)}</span>
                      <span className={`text-right tabular-nums font-semibold ${a.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}%
                      </span>
                      <span className={`text-right tabular-nums text-[9px] ${a.fundingRate >= 0 ? "text-amber-200/80" : "text-red-300/80"}`}>
                        {a.fundingRate >= 0 ? "+" : ""}{a.fundingRate.toFixed(4)}%
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Positions tab ── */}
          {tab === "positions" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!account || account.positions.length === 0 ? (
                <div className="flex h-24 flex-col items-center justify-center gap-2">
                  <BarChart2 className="h-5 w-5 text-zinc-700" />
                  <span className="text-[11px] text-zinc-500">No open positions</span>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 grid grid-cols-4 border-b border-[rgba(212,161,31,0.07)] bg-[#0c0d10] px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-zinc-600">
                    <span>Market</span>
                    <span className="text-right">Size</span>
                    <span className="text-right">Entry</span>
                    <span className="text-right">P&L</span>
                  </div>
                  {account.positions.map((p, i) => (
                    <div key={i} className="grid grid-cols-4 border-b border-[rgba(255,255,255,0.03)] px-2 py-2">
                      <div className="flex items-center gap-1">
                        {p.side === "long"
                          ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                          : <TrendingDown className="h-3 w-3 text-red-400" />
                        }
                        <span className="font-bold text-[var(--text-primary)]">{p.coin}</span>
                      </div>
                      <span className="text-right tabular-nums text-zinc-300">{p.size.toFixed(3)}</span>
                      <span className="text-right tabular-nums text-zinc-400">${p.entryPx.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                      <span className={`text-right tabular-nums font-semibold ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Trade tab ── */}
          {tab === "trade" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-3 p-3">

                {/* Asset + price */}
                <div className="flex items-center justify-between rounded-xl border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.04)] px-3 py-2">
                  <div>
                    <select
                      className="bg-transparent text-[13px] font-bold text-amber-200 outline-none"
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                    >
                      {assets.map((a) => (
                        <option key={a.name} value={a.name} className="bg-zinc-900">{a.name}-PERP</option>
                      ))}
                    </select>
                    {selectedAssetData && (
                      <div className="text-[9px] text-zinc-500">
                        OI {fmtBig(selectedAssetData.openInterest * selectedAssetData.markPx)} · max {selectedAssetData.maxLeverage}x
                      </div>
                    )}
                  </div>
                  {selectedAssetData && (
                    <div className="text-right">
                      <div className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">
                        {fmt(selectedAssetData.markPx)}
                      </div>
                      <div className={`text-[9px] font-semibold ${selectedAssetData.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {selectedAssetData.change24h >= 0 ? "+" : ""}{selectedAssetData.change24h.toFixed(2)}%
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
                      className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                        orderType === t ? "brand-chip-active" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Side selector */}
                <div className="flex gap-1">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setOrderSide(s)}
                      className={`flex-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                        orderSide === s
                          ? s === "buy"
                            ? "bg-[linear-gradient(180deg,#1a8f6a,#116b50)] text-white shadow-[0_0_12px_rgba(26,143,106,0.25)]"
                            : "bg-[linear-gradient(180deg,#b03535,#7e2424)] text-white shadow-[0_0_12px_rgba(176,53,53,0.25)]"
                          : "terminal-chip text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {s === "buy" ? "Long / Buy" : "Short / Sell"}
                    </button>
                  ))}
                </div>

                {/* Limit price */}
                {orderType === "limit" && (
                  <div>
                    <label className="mb-1 block text-[9px] uppercase tracking-[0.18em] text-zinc-500">Limit Price (USD)</label>
                    <input
                      type="number"
                      placeholder={selectedAssetData ? fmt(selectedAssetData.markPx) : "0.00"}
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="terminal-input w-full rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] placeholder:text-zinc-600"
                    />
                  </div>
                )}

                {/* Size */}
                <div>
                  <label className="mb-1 block text-[9px] uppercase tracking-[0.18em] text-zinc-500">Size ({selectedAsset})</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="terminal-input w-full rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] placeholder:text-zinc-600"
                  />
                </div>

                {/* Leverage */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Leverage</span>
                    <span className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">{leverage}x</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={selectedAssetData?.maxLeverage ?? 50}
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full cursor-pointer accent-amber-400"
                  />
                  <div className="mt-0.5 flex justify-between text-[8px] text-zinc-600">
                    <span>1x</span>
                    <span className="text-zinc-600">Isolated</span>
                    <span>{selectedAssetData?.maxLeverage ?? 50}x</span>
                  </div>
                </div>

                {/* Order summary */}
                {sizeNum > 0 && execPrice > 0 && (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-2.5 text-[10px] space-y-1">
                    {[
                      ["Notional", `$${notional.toFixed(2)}`],
                      ["Est. Margin", `$${(notional / leverage).toFixed(2)}`],
                      ["Funding/h", selectedAssetData ? `${selectedAssetData.fundingRate >= 0 ? "+" : ""}${selectedAssetData.fundingRate.toFixed(4)}%` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-zinc-500">{label}</span>
                        <span className="tabular-nums text-[var(--text-primary)]">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={placeOrder}
                  disabled={submitting || !sizeNum || !walletAddress}
                  className={`w-full rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    orderSide === "buy"
                      ? "bg-[linear-gradient(180deg,#1a8f6a,#116b50)] text-white"
                      : "bg-[linear-gradient(180deg,#b03535,#7e2424)] text-white"
                  }`}
                >
                  {submitting
                    ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    : `${orderSide === "buy" ? "Long" : "Short"} ${selectedAsset} ${leverage}x`
                  }
                </button>

                {orderMsg && (
                  <div className={`rounded-xl border px-3 py-2 text-[10px] ${
                    orderMsg.type === "ok"
                      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                      : "border-red-400/20 bg-red-400/[0.06] text-red-300"
                  }`}>
                    {orderMsg.text}
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
