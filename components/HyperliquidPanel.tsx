"use client";

import { useState } from "react";
import { useHyperliquid } from "@/hooks/useHyperliquid";
import { signHLAction, buildMarketOrder, buildLimitOrder } from "@/lib/hyperliquid-sign";
import type { EthereumProvider } from "@/lib/wallet-connect";
import { Wallet, Zap, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default function HyperliquidPanel() {
  const [wallet, setWallet] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { assets, assetIndex, account, wsConnected, loading } = useHyperliquid(wallet || undefined);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setWallet(accounts[0]);
    } catch {}
    setConnecting(false);
  };

  const placeOrder = async () => {
    if (!wallet || !size || parseFloat(size) <= 0) return;
    const idx = assetIndex[selectedAsset];
    if (idx === undefined) return;

    setSubmitting(true);
    setOrderMsg(null);

    try {
      const nonce = Date.now();
      const isBuy = orderSide === "buy";
      const sizeNum = parseFloat(size);
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
        setOrderMsg({ type: "ok", text: "Order placed successfully" });
        setSize("");
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
    if (n >= 1) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(5)}`;
  };

  const fmtBig = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toFixed(0)}`;
  };

  const selectedAssetData = assets.find((a) => a.name === selectedAsset);

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="panel-header soft-divider flex items-center justify-between border-b px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs">Hyperliquid</span>
          <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-emerald-300" : "bg-zinc-600"}`} />
        </div>
        {!wallet ? (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="brand-chip-active inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50"
          >
            {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
            {connecting ? "Connecting..." : "Connect"}
          </button>
        ) : (
          <span className="font-mono text-[9px] text-amber-200">
            {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </span>
        )}
      </div>

      {wallet && account && (
        <div className="grid grid-cols-2 gap-px border-b border-[rgba(212,161,31,0.08)] bg-[rgba(212,161,31,0.06)] shrink-0">
          <div className="bg-[#0c0d10] px-3 py-1.5">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Equity</div>
            <div className="font-bold text-[var(--text-primary)]">
              ${account.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-[#0c0d10] px-3 py-1.5">
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Withdrawable</div>
            <div className="font-bold text-amber-200">
              ${account.withdrawable.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-16 items-center justify-center text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div className="sticky top-0 grid grid-cols-4 border-b border-[rgba(212,161,31,0.08)] bg-[#0c0d10] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              <span>Perp</span>
              <span className="text-right">Mark</span>
              <span className="text-right">24h</span>
              <span className="text-right">Fund/h</span>
            </div>

            {assets.map((a) => (
              <button
                key={a.name}
                onClick={() => setSelectedAsset(a.name)}
                className={`grid w-full grid-cols-4 border-b border-[rgba(212,161,31,0.05)] px-2 py-1.5 text-left transition-colors ${
                  selectedAsset === a.name
                    ? "bg-[rgba(212,161,31,0.06)]"
                    : "hover:bg-[rgba(212,161,31,0.03)]"
                }`}
              >
                <span className="font-bold text-[#f3ead7]">{a.name}</span>
                <span className="text-right tabular-nums text-[var(--text-primary)]">{fmt(a.markPx)}</span>
                <span
                  className={`text-right tabular-nums ${a.change24h >= 0 ? "text-emerald-300" : "text-red-300"}`}
                >
                  {a.change24h >= 0 ? "+" : ""}
                  {a.change24h.toFixed(2)}%
                </span>
                <span
                  className={`text-right tabular-nums ${a.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}`}
                >
                  {a.fundingRate >= 0 ? "+" : ""}
                  {a.fundingRate.toFixed(4)}%
                </span>
              </button>
            ))}

            {account && account.positions.length > 0 && (
              <>
                <div className="sticky top-6 border-b border-[rgba(212,161,31,0.08)] bg-[#0c0d10] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                  Positions
                </div>
                {account.positions.map((p, i) => (
                  <div key={i} className="grid grid-cols-3 border-b border-[rgba(212,161,31,0.05)] px-2 py-1.5 text-[10px]">
                    <div className="flex items-center gap-1">
                      {p.side === "long" ? (
                        <TrendingUp className="h-3 w-3 text-emerald-300" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-300" />
                      )}
                      <span className="font-bold text-[var(--text-primary)]">{p.coin}</span>
                    </div>
                    <span className="text-right text-zinc-300">{p.size.toFixed(4)}</span>
                    <span className={`text-right ${p.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="panel-header soft-divider shrink-0 border-t p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-200">{selectedAsset}-PERP</span>
          {selectedAssetData && (
            <span className="text-[9px] text-zinc-500">
              OI: {fmtBig(selectedAssetData.openInterest * selectedAssetData.markPx)} - {selectedAssetData.maxLeverage}x max
            </span>
          )}
        </div>

        <div className="terminal-chip flex gap-1 rounded-xl p-0.5">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase transition ${
                orderType === t ? "brand-chip-active" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          type="number"
          placeholder={`Size (${selectedAsset})`}
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="terminal-input w-full rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] placeholder:text-zinc-600"
        />

        {orderType === "limit" && (
          <input
            type="number"
            placeholder="Limit Price (USD)"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="terminal-input w-full rounded-xl px-3 py-2 outline-none text-[var(--text-primary)] placeholder:text-zinc-600"
          />
        )}

        <div className="flex gap-1">
          <button
            onClick={() => {
              setOrderSide("buy");
              placeOrder();
            }}
            disabled={!wallet || submitting}
            className="flex-1 rounded-xl bg-[linear-gradient(180deg,#157a5d,#0e5f48)] py-1.5 text-[11px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && orderSide === "buy" ? "..." : "Long / Buy"}
          </button>
          <button
            onClick={() => {
              setOrderSide("sell");
              placeOrder();
            }}
            disabled={!wallet || submitting}
            className="flex-1 rounded-xl bg-[linear-gradient(180deg,#942e2e,#6e2020)] py-1.5 text-[11px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && orderSide === "sell" ? "..." : "Short / Sell"}
          </button>
        </div>

        {!wallet && <p className="text-center text-[9px] text-zinc-500">Connect MetaMask to submit orders</p>}

        {orderMsg && (
          <div
            className={`rounded-xl border px-2 py-1 text-[10px] ${
              orderMsg.type === "ok"
                ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300"
                : "border-red-400/20 bg-red-400/[0.05] text-red-300"
            }`}
          >
            {orderMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
