"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AVAILABLE_TICKERS, type NewsItem } from "@/lib/mock-data";
import type { ActiveVenueState } from "@/lib/active-venue";
import { buildApiUrl } from "@/lib/runtime-env";
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
import { createPortal } from "react-dom";
import OrderConfirmModal, { type OrderConfirmData } from "@/components/OrderConfirmModal";

type SubmitResult = { ok: boolean; message: string };

type Props = {
  activeVenueState: ActiveVenueState;
  selectedNews: NewsItem | null;
  newsTradeIntent?: (NewsTradePreset & { sourceItemId?: string }) | null;
  balance: number;
  isDemoMode?: boolean;
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

// Dynamic leverage presets computed from Binance exchange info
const DEFAULT_LEVERAGE_PRESETS = [2, 5, 10, 20, 50];
const LEVERAGE_PRESETS = DEFAULT_LEVERAGE_PRESETS; // used as fallback
const TPSL_PRESETS = [1, 2, 3, 5, 10];
const MARGIN_PCT_PRESETS = [5, 10, 25, 50];
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
  isDemoMode = false,
  positions,
  prices,
  marketDataSourceLabel,
  onActiveSymbolChange,
  onPlaceOrder,
  onConsumeNewsTradeIntent,
}: Props) {
  const [ticker, setTicker] = useState(activeVenueState.activeSymbol);
  const [ticketType, setTicketType] = useState<TicketType>("market");
  const [leverageBrackets, setLeverageBrackets] = useState<Record<string, number>>({});
  const leverageFetchedRef = useRef(false);
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
  const [confirmData, setConfirmData] = useState<OrderConfirmData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    setTicker(activeVenueState.activeSymbol);
  }, [activeVenueState.activeSymbol]);

  // Fetch leverage brackets once on mount (Binance only)
  useEffect(() => {
    if (leverageFetchedRef.current) return;
    leverageFetchedRef.current = true;
    fetch(buildApiUrl("/api/leverage-brackets"), { signal: AbortSignal.timeout(6000) })
      .then((r) => r.json())
      .then((data: Record<string, number>) => setLeverageBrackets(data))
      .catch(() => {});
  }, []);

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

  // Dynamic leverage presets based on coin's max leverage from Binance
  const maxLeverage = leverageBrackets[ticker] ?? 100;
  const dynamicLeveragePresets = useMemo(() => {
    if (maxLeverage <= 10) return [1, 2, 3, 5, maxLeverage];
    if (maxLeverage <= 20) return [2, 5, 10, 15, maxLeverage];
    if (maxLeverage <= 50) return [2, 5, 10, 20, maxLeverage];
    if (maxLeverage <= 75) return [5, 10, 20, 50, maxLeverage];
    return [5, 10, 20, 50, 100];
  }, [maxLeverage]);

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

  const statusColor =
    activeVenueState.connectionStatus === "connected"
      ? "bg-emerald-500"
      : activeVenueState.connectionStatus === "testing"
        ? "bg-amber-400"
        : "bg-red-500";

  const statusTextColor =
    activeVenueState.connectionStatus === "connected"
      ? "text-emerald-400"
      : activeVenueState.connectionStatus === "testing"
        ? "text-amber-400"
        : "text-red-400";

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

  // ── Input validation ──
  const validateOrder = (): string[] => {
    const errors: string[] = [];
    if (margin <= 0) errors.push("Margin must be greater than 0.");
    if (margin > balance) errors.push("Margin exceeds available balance.");
    if (margin < 1) errors.push("Minimum margin is $1.");
    if (leverage < 1 || leverage > 100) errors.push("Leverage must be between 1x and 100x.");
    if ((ticketType === "limit" || ticketType === "stop") && !limitPrice)
      errors.push("Limit/stop price is required.");
    if (ticketType === "limit") {
      const lp = parseFloat(limitPrice);
      if (lp <= 0) errors.push("Limit price must be positive.");
      if (side === "long" && lp > execPrice * 1.05)
        errors.push("Limit buy price is more than 5% above market — double-check.");
      if (side === "short" && lp < execPrice * 0.95)
        errors.push("Limit sell price is more than 5% below market — double-check.");
    }
    if (tpEnabled && tpPrice) {
      const tp = parseFloat(tpPrice);
      if (side === "long" && tp <= execPrice) errors.push("Take profit must be above entry for long.");
      if (side === "short" && tp >= execPrice) errors.push("Take profit must be below entry for short.");
    }
    if (slEnabled && slPrice) {
      const sl = parseFloat(slPrice);
      if (side === "long" && sl >= execPrice) errors.push("Stop loss must be below entry for long.");
      if (side === "short" && sl <= execPrice) errors.push("Stop loss must be above entry for short.");
    }
    return errors;
  };

  // ── Open confirm modal ──
  const handleSubmit = () => {
    setValidationErrors([]);
    const errors = validateOrder();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const rrRatio =
      tpEnabled && slEnabled && tpPercent && slPercent && parseFloat(slPercent) > 0
        ? (parseFloat(tpPercent) / parseFloat(slPercent)).toFixed(2)
        : undefined;

    setConfirmData({
      ticker,
      side,
      type: ticketType,
      marginUSD: margin,
      leverage,
      notional,
      execPrice,
      liqPrice,
      tpPrice: tpEnabled ? parseFloat(tpPrice) || undefined : undefined,
      slPrice: slEnabled ? parseFloat(slPrice) || undefined : undefined,
      tpPercent: tpEnabled ? tpPercent : undefined,
      slPercent: slEnabled ? slPercent : undefined,
      rrRatio,
      venue: activeVenueState.venueId,
      balance,
      riskPercent: (margin / balance) * 100,
    });
  };

  // ── Execute after confirmation ──
  const executeOrder = async () => {
    setConfirmData(null);
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
    <div className="flex h-full min-h-0 flex-col gap-px overflow-y-auto">

      {/* ── Header Bar: venue + status + balance ── */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-zinc-800/60 sm:gap-2 sm:px-3 sm:py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold tracking-widest text-zinc-200 uppercase sm:text-[11px]">
            {activeVenueState.venueId}
          </span>
          <span className="flex items-center gap-0.5 rounded-full border border-zinc-700/50 bg-zinc-900 px-1 py-0.5 sm:gap-1.5 sm:px-2">
            <span className={`h-1 w-1 rounded-full ${statusColor}`} />
            <span className={`text-[8px] capitalize ${statusTextColor} sm:text-[10px]`}>
              {activeVenueState.connectionStatus.replaceAll("_", " ")}
            </span>
          </span>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            {isDemoMode && (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-amber-400">
                PAPER
              </span>
            )}
          </div>
          <div className="text-[10px] font-semibold text-amber-300 sm:text-[12px]">
            ${balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* ── Market Summary ── */}
      <div className="px-1.5 py-0.5 border-b border-zinc-800/60 sm:px-3 sm:py-2.5">
        <div className="flex items-center justify-between gap-1">
          <select
            className="min-w-0 flex-1 rounded border border-zinc-700/50 bg-zinc-900 px-1 py-0.5 text-[9px] font-bold text-zinc-100 outline-none transition hover:border-zinc-600 sm:px-2.5 sm:py-1.5 sm:text-[12px] sm:rounded-lg"
            value={ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
          >
            {FUTURES_TICKERS.map((value) => (
              <option key={value} value={value} className="bg-zinc-950">
                {value}
              </option>
            ))}
          </select>
          <div className="shrink-0 text-right ml-1">
            <div className="text-[7px] uppercase tracking-widest text-zinc-600 sm:text-[9px]">Mark</div>
            <div className="text-[11px] font-bold tabular-nums text-zinc-100 sm:text-[18px]">${fmt(currentPrice)}</div>
          </div>
        </div>

        {existingPos && (
          <div className="mt-1 flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 text-[9px]">
            <span className={`font-semibold ${existingPos.side === "long" ? "text-emerald-400" : "text-red-400"}`}>
              {existingPos.side.toUpperCase()}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{existingPos.leverage}x</span>
          </div>
        )}
      </div>

      {/* ── Order Ticket ── */}
      <div className="flex flex-1 flex-col gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-3">

        {/* Order type tabs */}
        <div className="grid grid-cols-3 gap-0.5 rounded bg-zinc-900 p-0.5">
          {(["market", "limit", "stop"] as TicketType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTicketType(value)}
              className={`rounded py-0.5 text-[9px] font-medium capitalize transition-all sm:rounded-md sm:py-1.5 sm:text-[11px] ${
                ticketType === value
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Long / Short */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSide("long")}
            className={`min-h-[38px] rounded-lg py-1.5 text-[11px] font-bold transition-all sm:min-h-[44px] sm:py-2.5 sm:text-[13px] ${
              side === "long"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
                : "bg-zinc-900 text-zinc-600 hover:bg-zinc-800 hover:text-emerald-400"
            }`}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setSide("short")}
            className={`min-h-[38px] rounded-lg py-1.5 text-[11px] font-bold transition-all sm:min-h-[44px] sm:py-2.5 sm:text-[13px] ${
              side === "short"
                ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
                : "bg-zinc-900 text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
            }`}
          >
            Short
          </button>
        </div>

        {/* Limit / Stop price */}
        {(ticketType === "limit" || ticketType === "stop") && (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">
              {ticketType === "stop" ? "Trigger Price" : "Limit Price"}
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500"
              placeholder={fmt(currentPrice)}
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </div>
        )}

        {/* Margin + Leverage */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="mb-0.5 block text-[7px] uppercase tracking-widest text-zinc-600 sm:text-[10px]">Margin</label>
            <input
              type="number"
              className="w-full rounded border border-zinc-700/60 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[12px]"
              placeholder="0.00"
              value={marginUSD}
              onChange={(e) => setMarginUSD(e.target.value)}
            />
            <div className="mt-0.5 flex gap-0.5">
              {MARGIN_PCT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setMarginUSD(((balance * pct) / 100).toFixed(2))}
                  className="flex-1 rounded py-0.5 text-[7px] text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-0.5 flex items-center justify-between">
              <label className="text-[7px] uppercase tracking-widest text-zinc-600 sm:text-[10px]">Leverage</label>
              <span className="text-[9px] font-bold text-amber-300 sm:text-[11px]">{leverage}x</span>
            </div>
            {/* Drag slider */}
            <input
              type="range"
              min={1}
              max={maxLeverage > 0 ? Math.min(maxLeverage, 100) : 100}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full mb-0.5"
              style={{
                height: 3,
                accentColor: "#f0b90b",
                cursor: "pointer",
                borderRadius: 2,
              }}
            />
            {/* Quick preset dots */}
            <div className="flex justify-between">
              {dynamicLeveragePresets.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLeverage(value)}
                  className={`text-[7px] font-semibold transition-colors sm:text-[9px] ${
                    leverage === value
                      ? "text-amber-300"
                      : "text-zinc-700 hover:text-zinc-400"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode + Notional */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="mb-0.5 block text-[7px] uppercase tracking-widest text-zinc-600 sm:text-[10px]">Mode</label>
            <div className="grid grid-cols-2 gap-0.5 rounded bg-zinc-900 p-0.5">
              {(["isolated", "cross"] as MarginMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMarginMode(mode)}
                  className={`rounded py-0.5 text-[8px] font-medium capitalize transition-all sm:rounded-md sm:py-1 sm:text-[10px] ${
                    marginMode === mode
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-[7px] uppercase tracking-widest text-zinc-600 sm:text-[10px]">Notional</label>
            <div className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 sm:rounded-lg sm:px-2.5 sm:py-1.5">
              <div className="text-[10px] font-medium text-zinc-200 sm:text-[12px]">${fmt(notional)}</div>
              <div className="text-[8px] text-zinc-600 sm:text-[10px]">{fmt(quantity)} {ticker}</div>
            </div>
          </div>
        </div>

        {/* TP / SL accordion */}
        <div className="rounded border border-zinc-800/80 bg-zinc-900/40 sm:rounded-lg">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-400 transition-colors sm:px-3 sm:py-2.5 sm:text-[10px]"
          >
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="h-2.5 w-2.5 text-amber-400/80 sm:h-3 sm:w-3" />
              TP / SL
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 sm:h-3.5 sm:w-3.5 ${advancedOpen ? "rotate-180" : ""}`} />
          </button>

          {advancedOpen && (
            <div className="border-t border-zinc-800/60 px-3 pb-3 pt-2.5 space-y-2">
              {/* TP row */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTpEnabled((v) => !v)}
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                      tpEnabled
                        ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    TP
                  </button>
                  <input
                    type="number"
                    className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500 disabled:opacity-40"
                    disabled={!tpEnabled}
                    placeholder="Price"
                    value={tpPrice}
                    onChange={(e) => handleTpPriceChange(e.target.value)}
                  />
                  <input
                    type="number"
                    className="w-12 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-900 px-1.5 py-1.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500 disabled:opacity-40"
                    disabled={!tpEnabled}
                    placeholder="%"
                    value={tpPercent}
                    onChange={(e) => setTpPercent(e.target.value)}
                  />
                </div>
                {tpEnabled && (
                  <div className="flex gap-0.5 pl-8">
                    {TPSL_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTpPercent(String(pct))}
                        className={`flex-1 rounded py-0.5 text-[9px] transition ${
                          tpPercent === String(pct)
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SL row */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSlEnabled((v) => !v)}
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                      slEnabled
                        ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                        : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    SL
                  </button>
                  <input
                    type="number"
                    className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500 disabled:opacity-40"
                    disabled={!slEnabled}
                    placeholder="Price"
                    value={slPrice}
                    onChange={(e) => handleSlPriceChange(e.target.value)}
                  />
                  <input
                    type="number"
                    className="w-12 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-900 px-1.5 py-1.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-700 transition focus:border-zinc-500 disabled:opacity-40"
                    disabled={!slEnabled}
                    placeholder="%"
                    value={slPercent}
                    onChange={(e) => setSlPercent(e.target.value)}
                  />
                </div>
                {slEnabled && (
                  <div className="flex gap-0.5 pl-8">
                    {TPSL_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSlPercent(String(pct))}
                        className={`flex-1 rounded py-0.5 text-[9px] transition ${
                          slPercent === String(pct)
                            ? "bg-red-500/20 text-red-300"
                            : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* R/R Ratio */}
              {tpEnabled && slEnabled && tpPercent && slPercent && parseFloat(slPercent) > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[10px]">
                  <span className="text-zinc-600">Risk / Reward</span>
                  <span className={`font-bold ${
                    parseFloat(tpPercent) / parseFloat(slPercent) >= 2
                      ? "text-emerald-400"
                      : parseFloat(tpPercent) / parseFloat(slPercent) >= 1
                        ? "text-amber-300"
                        : "text-red-400"
                  }`}>
                    1 : {(parseFloat(tpPercent) / parseFloat(slPercent)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="rounded border border-zinc-800/60 bg-zinc-900/30 px-2 py-1.5 space-y-0.5 sm:rounded-lg sm:px-3 sm:py-2.5 sm:space-y-1">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
            <span className="text-zinc-600">Required</span>
            <span className="font-medium text-zinc-300">${fmt(requiredBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
            <span className="text-zinc-600">Fee ({(feeRate * 100).toFixed(3)}%)</span>
            <span className="font-medium text-zinc-300">${fmt(estimatedFee)}</span>
          </div>
          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
            <span className="text-zinc-600">Liq. Price</span>
            <span className="font-medium text-zinc-300">{liqPrice ? `$${fmt(liqPrice)}` : "—"}</span>
          </div>
          {(() => {
            if (!tpEnabled || !slEnabled || !tpPrice || !slPrice) return null;
            const tp = parseFloat(tpPrice);
            const sl = parseFloat(slPrice);
            const entry = execPrice;
            if (!tp || !sl || !entry || Math.abs(entry - sl) < 0.000001) return null;
            const rr = Math.abs((tp - entry) / (entry - sl));
            const rrStr = rr.toFixed(2);
            const rrColor = rr >= 1.5 ? "text-emerald-400" : rr >= 0.5 ? "text-amber-400" : "text-red-400";
            return (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-600">R/R Ratio</span>
                <span className={`font-semibold tabular-nums ${rrColor}`}>1 : {rrStr}</span>
              </div>
            );
          })()}
          <div className="flex items-center gap-1.5 pt-0.5 text-[9px] uppercase tracking-widest text-zinc-700">
            <Shield className="h-3 w-3 text-amber-500/60" />
            {riskNote}
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="space-y-1 rounded-lg border border-rose-500/20 bg-rose-500/6 px-3 py-2.5 panel-fade-in">
            {validationErrors.map((err) => (
              <div key={err} className="flex items-start gap-1.5 text-[10px] text-rose-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {err}
              </div>
            ))}
          </div>
        )}

        {/* Status message */}
        {submitMessage && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] panel-fade-in ${
              submitState === "failure"
                ? "border-red-500/20 bg-red-500/8 text-red-300"
                : submitState === "success"
                  ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
            }`}
          >
            {submitState === "submitting" && <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" />}
            {submitState === "success" && <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />}
            {submitState === "failure" && <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
            <span className="leading-relaxed">{submitMessage}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className={`w-full rounded-lg py-2 text-[12px] font-bold tracking-wide transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 sm:py-3 sm:text-[13px] ${
            side === "long"
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:bg-emerald-600"
              : "bg-red-500 text-white hover:bg-red-400 active:bg-red-600"
          }`}
        >
          {submitState === "submitting" ? (
            "Submitting…"
          ) : (
            <>
              <span className="sm:hidden">{side === "long" ? "Long ↑" : "Short ↓"}</span>
              <span className="hidden sm:inline">
                Review {side === "long" ? "Long" : "Short"} · {activeVenueState.venueId.toUpperCase()}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Order Confirm Modal */}
      {confirmData &&
        typeof document !== "undefined" &&
        createPortal(
          <OrderConfirmModal
            data={confirmData}
            onConfirm={executeOrder}
            onCancel={() => setConfirmData(null)}
          />,
          document.body
        )}
    </div>
  );
}
