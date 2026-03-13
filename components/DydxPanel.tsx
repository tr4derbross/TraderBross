"use client";

import { useState, useEffect, useCallback } from "react";
import { Layers, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

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

export default function DydxPanel() {
  const [address, setAddress] = useState("");
  const [inputAddr, setInputAddr] = useState("");
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
  const [tab, setTab] = useState<"markets" | "orders">("markets");

  const fetchMarkets = useCallback(async () => {
    setLoadingMkts(true);
    try {
      const res = await fetch("/api/dydx?type=markets");
      const data = await res.json();
      if (data.assets?.length) setAssets(data.assets);
    } catch {}
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
      if (data.error) {
        setAcctError(data.error);
      } else {
        setAccount(data);
      }
    } catch {
      setAcctError("Failed to fetch account");
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    const id = setInterval(fetchMarkets, 30_000);
    return () => clearInterval(id);
  }, [fetchMarkets]);

  const handleConnect = () => {
    const addr = inputAddr.trim();
    if (!addr) return;
    setAddress(addr);
    fetchAccount(addr);
  };

  const currentAsset = assets.find((a) => a.name === selectedAsset);
  const execPrice = orderType === "market" ? (currentAsset?.markPx ?? 0) : parseFloat(limitPrice) || 0;
  const sizeNum = parseFloat(size) || 0;
  const notional = sizeNum * execPrice;

  const handleMockOrder = () => {
    if (!sizeNum || !execPrice) return;
    setOrderMsg({
      type: "ok",
      text: `[Simulated] ${orderSide.toUpperCase()} ${sizeNum} ${selectedAsset} @ $${fmt(execPrice)} (${leverage}x) - dYdX v4 requires Keplr for live signing`,
    });
    setSize("");
    setTimeout(() => setOrderMsg(null), 5000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs">dYdX v4</span>
          <span className="brand-badge rounded-full px-1.5 py-0.5 text-[9px]">Cosmos perps</span>
        </div>
        <button onClick={fetchMarkets} className="text-zinc-600 transition-colors hover:text-amber-100">
          <RefreshCw className={`h-3.5 w-3.5 ${loadingMkts ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="panel-shell-alt shrink-0 border-b px-3 py-2">
        {!address ? (
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="dydx1abc... (view account)"
              className="terminal-input flex-1 rounded-xl px-3 py-2 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
              value={inputAddr}
              onChange={(e) => setInputAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <button
              onClick={handleConnect}
              disabled={!inputAddr.trim()}
              className="brand-chip-active rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Connect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Connected address</div>
              <div className="truncate font-mono text-[10px] text-amber-200">{address}</div>
            </div>
            <div className="text-right">
              {account && (
                <>
                  <div className="text-xs font-bold text-[var(--text-primary)]">${fmt(account.balance)}</div>
                  <div className="text-[9px] text-zinc-500">Free: ${fmt(account.freeCollateral)}</div>
                </>
              )}
              <button
                onClick={() => {
                  setAddress("");
                  setAccount(null);
                  setInputAddr("");
                }}
                className="mt-0.5 text-[9px] text-zinc-600 transition-colors hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        {acctError && (
          <div className="mt-1 flex items-center gap-1 text-[9px] text-red-300">
            <AlertCircle className="h-3 w-3" /> {acctError}
          </div>
        )}
      </div>

      <div className="panel-header soft-divider flex shrink-0 border-b">
        {(["markets", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`accent-tab flex-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] ${
              tab === t ? "text-amber-100" : "text-zinc-500"
            }`}
          >
            {t === "markets" ? "Markets" : "Trade"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "markets" && (
          <div>
            {loadingMkts && assets.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">Loading dYdX markets...</div>
            ) : assets.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No markets data</div>
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
                        onClick={() => {
                          setSelectedAsset(a.name);
                          setTab("orders");
                        }}
                        className={`cursor-pointer border-b border-[rgba(212,161,31,0.05)] transition-colors ${
                          isSelected ? "bg-[rgba(212,161,31,0.06)]" : "hover:bg-[rgba(212,161,31,0.03)]"
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {isSelected && <div className="h-1 w-1 rounded-full bg-amber-300" />}
                            <span className="font-bold text-[#f3ead7]">{a.name}</span>
                            <span className="text-zinc-600">-USD</span>
                          </div>
                          <div className="text-[8px] text-zinc-600">Max {a.maxLeverage}x</div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-[var(--text-primary)]">${fmt(a.markPx)}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${isUp ? "text-emerald-300" : "text-red-300"}`}>
                          <div className="flex items-center justify-end gap-0.5">
                            {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {isUp ? "+" : ""}
                            {a.change24h.toFixed(2)}%
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-right ${a.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}`}>
                          {a.fundingRate >= 0 ? "+" : ""}
                          {(a.fundingRate * 100).toFixed(4)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {account && account.positions.length > 0 && (
              <div className="mt-2 px-2">
                <div className="mb-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">Open Positions</div>
                {account.positions.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-[rgba(212,161,31,0.05)] py-1.5 text-[10px]"
                  >
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">{p.coin}</span>
                      <span
                        className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold ${
                          p.side === "long"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        {p.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-300">
                        {p.size.toFixed(4)} @ ${fmt(p.entryPx)}
                      </div>
                      <div className={p.pnl >= 0 ? "text-emerald-300" : "text-red-300"}>
                        {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-2.5 p-3">
            <div className="flex items-center justify-between">
              <select
                className="terminal-input rounded-xl px-3 py-2 text-xs text-amber-200 outline-none"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.name} value={a.name} className="bg-zinc-900">
                    {a.name}-USD Perp
                  </option>
                ))}
              </select>
              {currentAsset && (
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--text-primary)]">${fmt(currentAsset.markPx)}</div>
                  <div className="text-[9px] text-zinc-500">
                    Funding:{" "}
                    <span className={currentAsset.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}>
                      {currentAsset.fundingRate >= 0 ? "+" : ""}
                      {(currentAsset.fundingRate * 100).toFixed(4)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="terminal-chip flex gap-0.5 rounded-xl p-0.5">
              {(["market", "limit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`flex-1 rounded-lg py-1 text-[10px] uppercase transition ${
                    orderType === t ? "brand-chip-active" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setOrderSide("buy")}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  orderSide === "buy"
                    ? "bg-[linear-gradient(180deg,#157a5d,#0e5f48)] text-white"
                    : "terminal-chip text-zinc-500 hover:text-emerald-300"
                }`}
              >
                Long / Buy
              </button>
              <button
                onClick={() => setOrderSide("sell")}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  orderSide === "sell"
                    ? "bg-[linear-gradient(180deg,#942e2e,#6e2020)] text-white"
                    : "terminal-chip text-zinc-500 hover:text-red-300"
                }`}
              >
                Short / Sell
              </button>
            </div>

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

            {sizeNum > 0 && execPrice > 0 && (
              <div className="panel-shell-alt rounded-xl p-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Notional</span>
                  <span className="text-[var(--text-primary)]">${notional.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Est. Margin ({leverage}x)</span>
                  <span className="text-[var(--text-primary)]">${(notional / leverage).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Funding (8h)</span>
                  <span className={currentAsset && currentAsset.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}>
                    {currentAsset
                      ? `${currentAsset.fundingRate >= 0 ? "+" : ""}${(currentAsset.fundingRate * 100).toFixed(4)}%`
                      : "--"}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.05] p-2 text-[9px] text-zinc-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-200" />
                <span>
                  Real dYdX v4 trading requires a Cosmos STARK key through Keplr.
                  This panel simulates orders locally for workflow testing.
                </span>
              </div>
            </div>

            {orderMsg && (
              <div
                className={`rounded-xl border p-2 text-[9px] ${
                  orderMsg.type === "ok"
                    ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300"
                    : "border-red-400/20 bg-red-400/[0.05] text-red-300"
                }`}
              >
                {orderMsg.text}
              </div>
            )}

            <button
              onClick={handleMockOrder}
              disabled={!sizeNum || !execPrice}
              className={`w-full rounded-xl py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                orderSide === "buy"
                  ? "bg-[linear-gradient(180deg,#157a5d,#0e5f48)] text-white"
                  : "bg-[linear-gradient(180deg,#942e2e,#6e2020)] text-white"
              }`}
            >
              {orderSide === "buy"
                ? `Simulate Long ${selectedAsset} ${leverage}x`
                : `Simulate Short ${selectedAsset} ${leverage}x`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
