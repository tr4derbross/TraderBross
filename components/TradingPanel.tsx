"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_TICKERS, type NewsItem } from "@/lib/mock-data";
import type { ActiveVenueState } from "@/lib/active-venue";
import type { NewsTradePreset } from "@/lib/news-trade";
import {
  type MarginMode,
  type OrderType,
  type Position,
  type Side,
  calcLiqPrice,
  getBasePrice,
  MAKER_FEE,
  TAKER_FEE,
} from "@/hooks/useTradingState";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Shield, SlidersHorizontal } from "lucide-react";

type SubmitResult = { ok: boolean; message: string };

type Props = {
  activeVenueState: ActiveVenueState;
  selectedNews: NewsItem | null;
  newsTradeIntent?: (NewsTradePreset & { sourceItemId?: string }) | null;
  balance: number;
  positions: Position[];
  prices: Record<string, number>;
  marketDataSourceLabel: string;
  onActiveSymbolChange: (symbol: string) => void;
  onPlaceOrder: (
    ticker: string,
    side: Side,
    type: OrderType,
    marginAmount: number,
    leverage: number,
    marginMode: MarginMode,
    limitPrice?: number,
    tpPrice?: number,
    slPrice?: number
  ) => Promise<SubmitResult>;
  onConsumeNewsTradeIntent: () => void;
};

type TicketType = "market" | "limit" | "stop";
type SubmitState = "idle" | "submitting" | "success" | "failure";

const LEVERAGE_PRESETS = [2, 5, 10, 20, 50];
const FUTURES_TICKERS = AVAILABLE_TICKERS.filter((ticker) => !["COIN", "MSTR"].includes(ticker));

function fmt(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function calcPercentFromPrice(side: Side, entryPrice: number, targetPrice?: number) {
  if (!targetPrice || !Number.isFinite(targetPrice) || targetPrice <= 0 || entryPrice <= 0) return "";
  const delta =
    side === "long"
      ? Math.abs((targetPrice - entryPrice) / entryPrice)
      : Math.abs((entryPrice - targetPrice) / entryPrice);
  if (!Number.isFinite(delta) || delta <= 0) return "";
  return (delta * 100).toFixed(2);
}

function calcPriceFromPercent(side: Side, entryPrice: number, percent: string, target: "tp" | "sl") {
  const value = parseFloat(percent);
  if (!Number.isFinite(value) || value <= 0 || entryPrice <= 0) return "";
  const multiplier =
    target === "tp"
      ? side === "long"
        ? 1 + value / 100
        : 1 - value / 100
      : side === "long"
        ? 1 - value / 100
        : 1 + value / 100;
  return (entryPrice * multiplier).toFixed(6);
}

export default function TradingPanel({
  activeVenueState,
  selectedNews,
  newsTradeIntent,
  balance,
  positions,
  prices,
  marketDataSourceLabel,
  onActiveSymbolChange,
  onPlaceOrder,
  onConsumeNewsTradeIntent,
}: Props) {
  const [ticker, setTicker] = useState(activeVenueState.activeSymbol);
  const [ticketType, setTicketType] = useState<TicketType>("market");
  const [side, setSide] = useState<Side>("long");
  const [marginMode, setMarginMode] = useState<MarginMode>("isolated");
  const [leverage, setLeverage] = useState(10);
  const [marginUSD, setMarginUSD] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    setTicker(activeVenueState.activeSymbol);
  }, [activeVenueState.activeSymbol]);

  useEffect(() => {
    if (!newsTradeIntent) return;

    setTicker(newsTradeIntent.symbol);
    onActiveSymbolChange(newsTradeIntent.symbol);
    setSide(newsTradeIntent.side);
    setTicketType(
      newsTradeIntent.orderType === "limit"
        ? "limit"
        : newsTradeIntent.orderType === "stop"
          ? "stop"
          : "market"
    );
    setAdvancedOpen(Boolean(newsTradeIntent.tpPercent || newsTradeIntent.slPercent));

    if (newsTradeIntent.tpPercent) {
      setTpEnabled(true);
      setTpPercent(String(newsTradeIntent.tpPercent));
    }

    if (newsTradeIntent.slPercent) {
      setSlEnabled(true);
      setSlPercent(String(newsTradeIntent.slPercent));
    }

    setSubmitMessage(newsTradeIntent.rationale);
    setSubmitState("idle");
    onConsumeNewsTradeIntent();
  }, [newsTradeIntent, onActiveSymbolChange, onConsumeNewsTradeIntent]);

  const currentPrice = prices[ticker] ?? getBasePrice(ticker);
  const execPrice =
    ticketType === "limit" || ticketType === "stop" ? parseFloat(limitPrice) || currentPrice : currentPrice;
  const margin = parseFloat(marginUSD) || 0;
  const notional = margin * leverage;
  const quantity = execPrice > 0 ? notional / execPrice : 0;
  const feeRate = ticketType === "market" ? TAKER_FEE : MAKER_FEE;
  const estimatedFee = notional * feeRate;
  const requiredBalance = margin + estimatedFee;
  const existingPos = positions.find((position) => position.ticker === ticker);
  const liqPrice = margin > 0 ? calcLiqPrice(side, execPrice, leverage) : null;
  const statusTone =
    activeVenueState.connectionStatus === "connected"
      ? "text-emerald-300"
      : activeVenueState.connectionStatus === "testing"
        ? "text-amber-300"
        : "text-red-300";

  useEffect(() => {
    if (!tpEnabled) {
      setTpPrice("");
      setTpPercent("");
      return;
    }

    if (tpPercent) setTpPrice(calcPriceFromPercent(side, execPrice, tpPercent, "tp"));
  }, [tpEnabled, tpPercent, side, execPrice]);

  useEffect(() => {
    if (!slEnabled) {
      setSlPrice("");
      setSlPercent("");
      return;
    }

    if (slPercent) setSlPrice(calcPriceFromPercent(side, execPrice, slPercent, "sl"));
  }, [slEnabled, slPercent, side, execPrice]);

  const riskNote = useMemo(() => {
    if (leverage >= 25 || requiredBalance > balance * 0.5) return "Elevated risk profile.";
    if (leverage >= 10 || requiredBalance > balance * 0.25) return "Balanced active setup.";
    return "Controlled sizing profile.";
  }, [balance, leverage, requiredBalance]);

  const handleTickerChange = (value: string) => {
    setTicker(value);
    onActiveSymbolChange(value);
  };

  const handleTpPriceChange = (value: string) => {
    setTpPrice(value);
    const numeric = parseFloat(value);
    setTpPercent(value && Number.isFinite(numeric) ? calcPercentFromPrice(side, execPrice, numeric) : "");
  };

  const handleSlPriceChange = (value: string) => {
    setSlPrice(value);
    const numeric = parseFloat(value);
    setSlPercent(value && Number.isFinite(numeric) ? calcPercentFromPrice(side, execPrice, numeric) : "");
  };

  const submitDisabled =
    submitState === "submitting" ||
    margin <= 0 ||
    requiredBalance > balance ||
    ((ticketType === "limit" || ticketType === "stop") && !limitPrice);

  const handleSubmit = async () => {
    setSubmitState("submitting");
    setSubmitMessage("");

    const result = await onPlaceOrder(
      ticker,
      side,
      ticketType,
      margin,
      leverage,
      marginMode,
      ticketType === "market" ? undefined : parseFloat(limitPrice) || undefined,
      tpEnabled ? parseFloat(tpPrice) || undefined : undefined,
      slEnabled ? parseFloat(slPrice) || undefined : undefined
    );

    if (result.ok) {
      setSubmitState("success");
      setSubmitMessage(result.message);
      setMarginUSD("");
      if (ticketType !== "market") setLimitPrice("");
      return;
    }

    setSubmitState("failure");
    setSubmitMessage(result.message);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <section className="tb-panel-soft p-3">
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          <span>Execution</span>
          <span className={statusTone}>{activeVenueState.connectionStatus.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4">
          <div>
            <div className="tb-kpi-label">Execution Venue</div>
            <div className="tb-kpi-value">{activeVenueState.venueId.toUpperCase()}</div>
          </div>
          <div>
            <div className="tb-kpi-label">Market Data Source</div>
            <div className="tb-kpi-value truncate text-[10px] text-zinc-300">{marketDataSourceLabel}</div>
          </div>
          <div>
            <div className="tb-kpi-label">Connection Status</div>
            <div className={`tb-kpi-value ${statusTone}`}>{activeVenueState.connectionStatus.replaceAll("_", " ")}</div>
          </div>
          <div>
            <div className="tb-kpi-label">Balance</div>
            <div className="tb-kpi-value text-amber-200">${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </section>

      <section className="tb-panel-soft mt-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="tb-section-title">Market Summary</div>
            <div className="mt-2 flex items-center gap-2">
              <select className="tb-select min-w-0 flex-1" value={ticker} onChange={(e) => handleTickerChange(e.target.value)}>
                {FUTURES_TICKERS.map((value) => (
                  <option key={value} value={value} className="bg-zinc-950">
                    {value}/USDT Perp
                  </option>
                ))}
              </select>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {marginMode}
              </span>
            </div>
            {selectedNews && (
              <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">{selectedNews.headline}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Mark Price</div>
            <div className="mt-1 text-xl font-semibold text-zinc-100">${fmt(currentPrice)}</div>
            <div className="mt-1 text-[11px] text-zinc-500">{activeVenueState.venueType === "cex" ? "Perpetual" : "Venue Context"}</div>
          </div>
        </div>

        {existingPos && (
          <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 text-[11px] text-zinc-300">
            Open {existingPos.side.toUpperCase()} | {existingPos.leverage}x | {fmt(existingPos.amount)} {ticker}
          </div>
        )}
      </section>

      <section className="tb-panel mt-3 flex-1 p-3">
        <div className="tb-section-title">Order Ticket</div>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-zinc-950/80 p-1">
          {(["market", "limit", "stop"] as TicketType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTicketType(value)}
              className={`tb-segment ${ticketType === value ? "tb-segment-active" : ""}`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("long")}
            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              side === "long"
                ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-200"
                : "border-zinc-800 bg-zinc-950/70 text-zinc-500 hover:text-emerald-200"
            }`}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setSide("short")}
            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              side === "short"
                ? "border-red-500/70 bg-red-500/15 text-red-200"
                : "border-zinc-800 bg-zinc-950/70 text-zinc-500 hover:text-red-200"
            }`}
          >
            Short
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="tb-section-title">Margin</label>
            <input type="number" className="tb-input mt-1" placeholder="0.00 USDT" value={marginUSD} onChange={(e) => setMarginUSD(e.target.value)} />
          </div>
          <div>
            <label className="tb-section-title">Leverage</label>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {LEVERAGE_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLeverage(value)}
                  className={`tb-chip text-[10px] ${leverage === value ? "tb-chip-active" : ""}`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="tb-section-title">Mode</label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-950/80 p-1">
              {(["isolated", "cross"] as MarginMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMarginMode(mode)}
                  className={`tb-segment ${marginMode === mode ? "tb-segment-active" : ""}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="tb-section-title">Notional</label>
            <div className="tb-input mt-1 flex items-center justify-between text-sm text-zinc-200">
              <span>${fmt(notional)}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{fmt(quantity)} {ticker}</span>
            </div>
          </div>
        </div>

        {(ticketType === "limit" || ticketType === "stop") && (
          <div className="mt-3">
            <label className="tb-section-title">{ticketType === "stop" ? "Trigger Price" : "Limit Price"}</label>
            <input type="number" className="tb-input mt-1" placeholder={`${fmt(currentPrice)}`} value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-200" />
              TP / SL and Advanced
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </button>

          {advancedOpen && (
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-[auto,1fr] items-center gap-2">
                <button type="button" onClick={() => setTpEnabled((v) => !v)} className={`tb-chip ${tpEnabled ? "tb-chip-active" : ""}`}>TP</button>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="tb-input" disabled={!tpEnabled} placeholder="TP price" value={tpPrice} onChange={(e) => handleTpPriceChange(e.target.value)} />
                  <input type="number" className="tb-input" disabled={!tpEnabled} placeholder="TP %" value={tpPercent} onChange={(e) => setTpPercent(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-[auto,1fr] items-center gap-2">
                <button type="button" onClick={() => setSlEnabled((v) => !v)} className={`tb-chip ${slEnabled ? "tb-chip-active" : ""}`}>SL</button>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="tb-input" disabled={!slEnabled} placeholder="SL price" value={slPrice} onChange={(e) => handleSlPriceChange(e.target.value)} />
                  <input type="number" className="tb-input" disabled={!slEnabled} placeholder="SL %" value={slPercent} onChange={(e) => setSlPercent(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-3 text-[11px] text-zinc-400">
          <div className="flex items-center justify-between"><span>Required Balance</span><span className="text-zinc-200">${fmt(requiredBalance)}</span></div>
          <div className="mt-1 flex items-center justify-between"><span>Estimated Fee</span><span className="text-zinc-200">${fmt(estimatedFee)}</span></div>
          <div className="mt-1 flex items-center justify-between"><span>Liquidation</span><span className="text-zinc-200">{liqPrice ? `$${fmt(liqPrice)}` : "-"}</span></div>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <Shield className="h-3.5 w-3.5 text-amber-200" />
            {riskNote}
          </div>
        </div>

        {submitMessage && (
          <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${submitState === "failure" ? "border-red-500/25 bg-red-500/10 text-red-200" : submitState === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 bg-zinc-950/60 text-zinc-300"}`}>
            <div className="flex items-center gap-2">
              {submitState === "submitting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitState === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {submitState === "failure" && <AlertTriangle className="h-3.5 w-3.5" />}
              <span>{submitMessage}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            side === "long"
              ? "bg-emerald-500/90 text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500"
              : "bg-red-500/90 text-white hover:bg-red-400 disabled:bg-zinc-800 disabled:text-zinc-500"
          }`}
        >
          {submitState === "submitting" ? "Submitting..." : `${side === "long" ? "Open Long" : "Open Short"} on ${activeVenueState.venueId.toUpperCase()}`}
        </button>
      </section>
    </div>
  );
}
