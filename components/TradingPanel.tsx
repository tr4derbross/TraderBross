"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CandlestickChart,
  CheckCircle2,
  Gauge,
  Layers3,
  Loader2,
  Newspaper,
  ShieldAlert,
  Target,
  Wallet2,
} from "lucide-react";
import type { NewsItem } from "@/lib/mock-data";
import type { ActiveVenueState } from "@/lib/active-venue";
import type { MarginMode, OrderType, Position, Side } from "@/hooks/useTradingState";
import type { NewsTradePreset } from "@/lib/news-trade";
import { getBasePrice, MAKER_FEE, TAKER_FEE } from "@/hooks/useTradingState";

type Props = {
  activeVenueState: ActiveVenueState;
  selectedNews?: NewsItem | null;
  newsTradeIntent?: (NewsTradePreset & { sourceItemId: string }) | null;
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
  ) => Promise<{ ok: boolean; message: string }>;
  onConsumeNewsTradeIntent?: () => void;
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

const LEVERAGE_PRESETS = [5, 10, 20, 30];
const TP_PRESETS = [1, 2, 3];
const SL_PRESETS = [0.5, 1, 1.5];

function toFixedPrice(value: number) {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

function connectionTone(status: ActiveVenueState["connectionStatus"]) {
  switch (status) {
    case "connected":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "testing":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "failed":
      return "border-rose-400/20 bg-rose-500/10 text-rose-200";
    case "saved_locally":
      return "border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.1)] text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-zinc-400";
  }
}

function connectionLabel(status: ActiveVenueState["connectionStatus"]) {
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
  const ticker = activeVenueState.activeSymbol;
  const currentPrice = prices[ticker] ?? getBasePrice(ticker);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [side, setSide] = useState<Side>("long");
  const [marginMode, setMarginMode] = useState<MarginMode>("isolated");
  const [leverage, setLeverage] = useState(10);
  const [marginUSD, setMarginUSD] = useState(250);
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");
  const [tpPriceInput, setTpPriceInput] = useState("");
  const [slPriceInput, setSlPriceInput] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    setLimitPrice(currentPrice);
  }, [ticker, currentPrice]);

  useEffect(() => {
    if (!newsTradeIntent || newsTradeIntent.symbol !== ticker) return;

    setSide(newsTradeIntent.side);
    setOrderType(newsTradeIntent.orderType);

    if (newsTradeIntent.tpPercent) {
      setTpEnabled(true);
      updateTpPercent(newsTradeIntent.tpPercent);
    } else {
      setTpEnabled(false);
      setTpPercent("");
      setTpPriceInput("");
    }

    if (newsTradeIntent.slPercent) {
      setSlEnabled(true);
      updateSlPercent(newsTradeIntent.slPercent);
    } else {
      setSlEnabled(false);
      setSlPercent("");
      setSlPriceInput("");
    }

    onConsumeNewsTradeIntent?.();
  }, [newsTradeIntent, onConsumeNewsTradeIntent, ticker]);

  const effectivePrice = orderType === "market" ? currentPrice : limitPrice || currentPrice;
  const feeRate = orderType === "limit" ? MAKER_FEE : TAKER_FEE;
  const feeEstimate = marginUSD * leverage * feeRate;
  const notional = marginUSD * leverage;
  const quantity = effectivePrice > 0 ? notional / effectivePrice : 0;
  const availableAfterFees = balance - marginUSD - feeEstimate;

  const openPosition = useMemo(
    () => positions.find((position) => position.ticker === ticker),
    [positions, ticker]
  );

  const rewardPercent = tpEnabled ? Number(tpPercent || 0) : 0;
  const riskPercent = slEnabled ? Number(slPercent || 0) : 0;
  const riskReward =
    rewardPercent > 0 && riskPercent > 0 ? (rewardPercent / riskPercent).toFixed(2) : "--";

  const tpPrice = tpEnabled && tpPriceInput ? Number(tpPriceInput) : undefined;
  const slPrice = slEnabled && slPriceInput ? Number(slPriceInput) : undefined;

  const tpError =
    tpPrice !== undefined &&
    ((side === "long" && tpPrice <= effectivePrice) || (side === "short" && tpPrice >= effectivePrice));
  const slError =
    slPrice !== undefined &&
    ((side === "long" && slPrice >= effectivePrice) || (side === "short" && slPrice <= effectivePrice));

  const updateTpPercent = (percent: number) => {
    setTpPercent(String(percent));
    const nextPrice =
      side === "long"
        ? effectivePrice * (1 + percent / 100)
        : effectivePrice * (1 - percent / 100);
    setTpPriceInput(nextPrice.toFixed(2));
  };

  const updateSlPercent = (percent: number) => {
    setSlPercent(String(percent));
    const nextPrice =
      side === "long"
        ? effectivePrice * (1 - percent / 100)
        : effectivePrice * (1 + percent / 100);
    setSlPriceInput(nextPrice.toFixed(2));
  };

  const handleTpPriceChange = (value: string) => {
    setTpPriceInput(value);
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || effectivePrice <= 0) {
      setTpPercent("");
      return;
    }
    const pct =
      side === "long"
        ? ((parsed - effectivePrice) / effectivePrice) * 100
        : ((effectivePrice - parsed) / effectivePrice) * 100;
    setTpPercent(pct > 0 ? pct.toFixed(2) : "");
  };

  const handleSlPriceChange = (value: string) => {
    setSlPriceInput(value);
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || effectivePrice <= 0) {
      setSlPercent("");
      return;
    }
    const pct =
      side === "long"
        ? ((effectivePrice - parsed) / effectivePrice) * 100
        : ((parsed - effectivePrice) / effectivePrice) * 100;
    setSlPercent(pct > 0 ? pct.toFixed(2) : "");
  };

  const handleSubmit = async () => {
    if (marginUSD <= 0) {
      setSubmitFeedback({ tone: "error", message: "Enter a valid margin amount." });
      return;
    }

    if ((orderType === "limit" || orderType === "stop") && (!limitPrice || limitPrice <= 0)) {
      setSubmitFeedback({ tone: "error", message: "Set a valid trigger price." });
      return;
    }

    if (tpError || slError) {
      setSubmitFeedback({ tone: "error", message: "TP/SL levels are invalid for the selected side." });
      return;
    }

    if (activeVenueState.connectionStatus !== "connected") {
      setSubmitFeedback({
        tone: "error",
        message: `${activeVenueState.venueId.toUpperCase()} must be connected before submitting.`,
      });
      return;
    }

    setIsSubmittingOrder(true);
    setSubmitFeedback({
      tone: "info",
      message: `Submitting to ${activeVenueState.venueId.toUpperCase()}...`,
    });

    try {
      const result = await onPlaceOrder(
        ticker,
        side,
        orderType,
        marginUSD,
        leverage,
        marginMode,
        orderType === "market" ? undefined : limitPrice,
        tpPrice,
        slPrice
      );

      setSubmitFeedback({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (error) {
      setSubmitFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Order routing failed.",
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="panel-header soft-divider shrink-0 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] p-2 text-amber-200">
                <CandlestickChart className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Execution
                </div>
                <div className="truncate text-sm font-semibold text-[#f5efe1]">
                  {ticker} Perp Setup
                </div>
              </div>
            </div>
            <p className="mt-2 max-w-[26rem] text-[11px] leading-5 text-zinc-400">
              Venue-aware execution workspace aligned to the active platform and market data source.
            </p>
          </div>

          <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2 text-right">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Connection Status</div>
            <div
              className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${connectionTone(
                activeVenueState.connectionStatus
              )}`}
            >
              {connectionLabel(activeVenueState.connectionStatus)}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              <Layers3 className="h-3.5 w-3.5 text-amber-200" />
              Execution Venue
            </div>
            <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
              {activeVenueState.venueId.toUpperCase()}
            </div>
          </div>
          <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              <Activity className="h-3.5 w-3.5 text-amber-200" />
              Market Data Source
            </div>
            <div className="mt-1 truncate text-[12px] font-semibold text-[#f3ead7]">
              {marketDataSourceLabel}
            </div>
          </div>
          <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              <Wallet2 className="h-3.5 w-3.5 text-amber-200" />
              Available Balance
            </div>
            <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
              ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <section className="rounded-2xl border border-white/6 bg-[rgba(10,12,16,0.88)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Market
                </div>
                <div className="mt-1 text-[13px] font-semibold text-[#f5efe1]">
                  Symbol and live mark
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.08)] px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Live Mark</div>
                <div className="mt-1 text-[14px] font-semibold text-[#f3ead7]">
                  ${toFixedPrice(currentPrice)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1.15fr_1fr]">
              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Symbol
                </span>
                <select
                  value={ticker}
                  onChange={(event) => onActiveSymbolChange(event.target.value)}
                  className="terminal-input w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] outline-none"
                >
                  {Object.keys(prices)
                    .sort()
                    .map((symbol) => (
                      <option key={symbol} value={symbol}>
                        {symbol}USD
                      </option>
                    ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Notional</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                    ${notional.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Size</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                    {quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/6 bg-[rgba(10,12,16,0.88)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Order Setup
                </div>
                <div className="mt-1 text-[13px] font-semibold text-[#f5efe1]">
                  Structured execution controls
                </div>
              </div>
              <div className="rounded-full border border-white/6 bg-black/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-zinc-400">
                {activeVenueState.venueType === "cex" ? "CEX" : "DEX"} routing
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Order Type
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["market", "limit", "stop"] as OrderType[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOrderType(value)}
                        className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                          orderType === value
                            ? "border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.12)] text-amber-100"
                            : "border-white/6 bg-black/20 text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Side
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSide("long")}
                      className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                        side === "long"
                          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-100"
                          : "border-white/6 bg-black/20 text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      Long
                    </button>
                    <button
                      type="button"
                      onClick={() => setSide("short")}
                      className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                        side === "short"
                          ? "border-rose-400/20 bg-rose-500/12 text-rose-100"
                          : "border-white/6 bg-black/20 text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      Short
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Margin (USD)
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    value={marginUSD}
                    onChange={(event) => setMarginUSD(Number(event.target.value))}
                    className="terminal-input w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Trigger / Limit Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={orderType === "market"}
                    value={orderType === "market" ? currentPrice.toFixed(2) : limitPrice}
                    onChange={(event) => setLimitPrice(Number(event.target.value))}
                    className="terminal-input w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] outline-none disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Leverage
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {LEVERAGE_PRESETS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLeverage(value)}
                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                          leverage === value
                            ? "border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.12)] text-amber-100"
                            : "border-white/6 bg-black/20 text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        {value}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Margin Mode
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["isolated", "cross"] as MarginMode[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMarginMode(value)}
                        className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                          marginMode === value
                            ? "border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.12)] text-amber-100"
                            : "border-white/6 bg-black/20 text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/6 bg-[rgba(10,12,16,0.88)] p-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-200" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  TP / SL Engine
                </div>
                <div className="mt-1 text-[13px] font-semibold text-[#f5efe1]">
                  Risk management controls
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-100">
                    <Target className="h-4 w-4" />
                    Take Profit
                  </div>
                  <button
                    type="button"
                    onClick={() => setTpEnabled((value) => !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      tpEnabled
                        ? "border-emerald-400/20 bg-emerald-500/20"
                        : "border-white/10 bg-white/5"
                    }`}
                    aria-pressed={tpEnabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full transition-transform ${
                        tpEnabled
                          ? "translate-x-[22px] bg-emerald-200"
                          : "translate-x-[3px] bg-zinc-500"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={tpPercent}
                    onChange={(event) => updateTpPercent(Number(event.target.value))}
                    placeholder="TP %"
                    disabled={!tpEnabled}
                    className="terminal-input min-w-0 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] outline-none disabled:opacity-45"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tpPriceInput}
                    onChange={(event) => handleTpPriceChange(event.target.value)}
                    placeholder={`> ${toFixedPrice(effectivePrice)}`}
                    disabled={!tpEnabled}
                    className={`terminal-input min-w-0 rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none ${
                      tpError ? "border-rose-400/25 text-rose-200" : "text-[var(--text-primary)]"
                    } disabled:opacity-45`}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TP_PRESETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateTpPercent(value)}
                      disabled={!tpEnabled}
                      className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5 text-[10px] font-bold text-zinc-200 hover:bg-white/[0.04] disabled:opacity-40"
                    >
                      +{value}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-rose-100">
                    <AlertTriangle className="h-4 w-4" />
                    Stop Loss
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlEnabled((value) => !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      slEnabled
                        ? "border-rose-400/20 bg-rose-500/20"
                        : "border-white/10 bg-white/5"
                    }`}
                    aria-pressed={slEnabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full transition-transform ${
                        slEnabled
                          ? "translate-x-[22px] bg-rose-200"
                          : "translate-x-[3px] bg-zinc-500"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slPercent}
                    onChange={(event) => updateSlPercent(Number(event.target.value))}
                    placeholder="SL %"
                    disabled={!slEnabled}
                    className="terminal-input min-w-0 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] outline-none disabled:opacity-45"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={slPriceInput}
                    onChange={(event) => handleSlPriceChange(event.target.value)}
                    placeholder={`< ${toFixedPrice(effectivePrice)}`}
                    disabled={!slEnabled}
                    className={`terminal-input min-w-0 rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none ${
                      slError ? "border-rose-400/25 text-rose-200" : "text-[var(--text-primary)]"
                    } disabled:opacity-45`}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {SL_PRESETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSlPercent(value)}
                      disabled={!slEnabled}
                      className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5 text-[10px] font-bold text-zinc-200 hover:bg-white/[0.04] disabled:opacity-40"
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Risk / Reward
                </div>
                <div className="text-[12px] font-semibold text-[#f3ead7]">{riskReward}</div>
              </div>
            </div>
          </section>

          {selectedNews && (
            <section className="rounded-2xl border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.05)] p-3">
              <div className="flex items-start gap-2">
                <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    News Context
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12px] font-semibold text-[#f5efe1]">
                    {selectedNews.headline}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-400">
                    {selectedNews.source} | {selectedNews.ticker.join(", ")}
                  </div>
                </div>
              </div>
            </section>
          )}

          {selectedNews && (
            <section className="rounded-2xl border border-[rgba(212,161,31,0.12)] bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Quick News Trade
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-[#f5efe1]">
                    Fast preset aligned to the selected headline
                  </div>
                </div>
                <span className="rounded-full border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-100">
                  {side.toUpperCase()} {ticker}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Preset Type</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                    {orderType.toUpperCase()} reaction
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">TP Preset</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                    {tpEnabled && tpPercent ? `${tpPercent}%` : "Manual / Off"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">SL Preset</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                    {slEnabled && slPercent ? `${slPercent}%` : "Manual / Off"}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/6 bg-[rgba(10,12,16,0.88)] p-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-amber-200" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Summary
                </div>
                <div className="mt-1 text-[13px] font-semibold text-[#f5efe1]">
                  Execution readiness
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Entry Price</div>
                <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                  ${toFixedPrice(effectivePrice)}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Fees</div>
                <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                  ${feeEstimate.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Post-Trade Buffer</div>
                <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                  ${availableAfterFees.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Open Position</div>
                <div className="mt-1 text-[12px] font-semibold text-[#f3ead7]">
                  {openPosition ? `${openPosition.side.toUpperCase()} @ ${toFixedPrice(openPosition.entryPrice)}` : "None"}
                </div>
              </div>
            </div>

            {submitFeedback && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] ${
                  submitFeedback.tone === "success"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : submitFeedback.tone === "info"
                      ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                      : "border-rose-400/20 bg-rose-500/10 text-rose-100"
                }`}
              >
                {submitFeedback.tone === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : submitFeedback.tone === "info" ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{submitFeedback.message}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                isSubmittingOrder ||
                marginUSD <= 0 ||
                availableAfterFees < 0 ||
                tpError ||
                slError
              }
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${
                side === "long"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
                  : "bg-gradient-to-r from-rose-500 to-rose-400 text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
              }`}
            >
              {isSubmittingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmittingOrder
                ? `Submitting to ${activeVenueState.venueId.toUpperCase()}`
                : `${side === "long" ? "Open Long" : "Open Short"} | ${ticker}`}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
