"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X, TrendingUp, TrendingDown } from "lucide-react";

export interface OrderConfirmData {
  ticker: string;
  side: "long" | "short";
  type: "market" | "limit" | "stop";
  marginUSD: number;
  leverage: number;
  notional: number;
  execPrice: number;
  liqPrice: number | null;
  tpPrice?: number;
  slPrice?: number;
  tpPercent?: string;
  slPercent?: string;
  rrRatio?: string;
  venue: string;
  balance: number;
  riskPercent: number; // margin / balance * 100
}

interface Props {
  data: OrderConfirmData;
  onConfirm: () => void;
  onCancel: () => void;
}

function fmt(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function OrderConfirmModal({ data, onConfirm, onCancel }: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Auto-focus confirm button; allow keyboard confirm / escape
    confirmBtnRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, onConfirm]);

  const isLong = data.side === "long";
  const riskHigh = data.riskPercent > 20;
  const riskMedium = data.riskPercent > 10;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="panel-shell-alt relative z-10 w-full max-w-sm rounded-2xl border p-4 shadow-[0_24px_64px_rgba(0,0,0,0.6)] slide-up">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500">
              Confirm Order · {data.venue.toUpperCase()}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-sm font-bold ${
                  isLong ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {isLong ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isLong ? "Long" : "Short"} {data.ticker}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                {data.leverage}x · {data.type}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/8 p-1.5 text-zinc-500 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Risk warning */}
        {riskHigh && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-[11px] text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>High risk:</strong> This order uses {data.riskPercent.toFixed(1)}% of your
              balance. Consider reducing position size.
            </span>
          </div>
        )}
        {!riskHigh && riskMedium && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5 text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Moderate risk: {data.riskPercent.toFixed(1)}% of balance at stake.
            </span>
          </div>
        )}

        {/* Order details grid */}
        <div className="space-y-1 rounded-xl border border-white/6 bg-black/20 p-3">
          {[
            { label: "Entry Price", value: `$${fmt(data.execPrice)}` },
            { label: "Margin", value: `$${fmt(data.marginUSD)}`, highlight: true },
            { label: "Notional", value: `$${fmt(data.notional)}` },
            {
              label: "Liquidation",
              value: data.liqPrice ? `$${fmt(data.liqPrice)}` : "—",
              danger: true,
            },
            ...(data.tpPrice
              ? [{ label: `Take Profit${data.tpPercent ? ` (+${data.tpPercent}%)` : ""}`, value: `$${fmt(data.tpPrice)}`, success: true }]
              : []),
            ...(data.slPrice
              ? [{ label: `Stop Loss${data.slPercent ? ` (-${data.slPercent}%)` : ""}`, value: `$${fmt(data.slPrice)}`, danger: true }]
              : []),
            ...(data.rrRatio ? [{ label: "Risk / Reward", value: `1 : ${data.rrRatio}` }] : []),
          ].map(({ label, value, highlight, danger, success }) => (
            <div key={label} className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">{label}</span>
              <span
                className={`font-medium ${
                  danger
                    ? "text-rose-400"
                    : success
                      ? "text-emerald-400"
                      : highlight
                        ? "text-amber-200"
                        : "text-zinc-200"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Balance impact */}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-[10px]">
          <span className="text-zinc-600">Balance after margin lock</span>
          <span className="font-semibold text-zinc-300">
            ${fmt(data.balance - data.marginUSD)}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/8 bg-white/[0.02] py-2.5 text-[11px] font-semibold text-zinc-400 transition hover:border-white/16 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-[11px] font-bold transition active:scale-[0.98] ${
              isLong
                ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                : "bg-rose-500 text-white hover:bg-rose-400"
            }`}
          >
            Confirm {isLong ? "Long" : "Short"}
          </button>
        </div>

        <p className="mt-2.5 text-center text-[9px] text-zinc-700">
          Press <kbd className="rounded border border-white/10 px-1">Enter</kbd> to confirm ·{" "}
          <kbd className="rounded border border-white/10 px-1">Esc</kbd> to cancel
        </p>
      </div>
    </div>
  );
}
