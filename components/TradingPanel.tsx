"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_TICKERS, NewsItem } from "@/lib/mock-data";
import type { ActiveVenueState } from "@/lib/active-venue";
import {
  Side,
  OrderType,
  MarginMode,
  Position,
  getBasePrice,
  calcLiqPrice,
  TAKER_FEE,
  MAKER_FEE,
} from "@/hooks/useTradingState";
import { TrendingUp, TargetIcon, Sparkles, Percent, Shield, Gauge } from "lucide-react";

type Props = {
  activeVenueState: ActiveVenueState;
  selectedNews?: NewsItem | null;
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
    slPrice?: number,
  ) => Promise<{ ok: boolean; message: string }>;
};

type TradeSuggestion = {
  bias: Side;
  orderType: OrderType;
  tp: number;
  sl: number;
  tpPct: number;
  slPct: number;
  confidenceLabel: string;
  note: string;
};

type PanelMode = "basic" | "advanced";

function fmt(n: number) {
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n.toFixed(2)}%`;
}

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125];
const TP_PRESETS = [0.75, 1.5, 2.5, 4];
const SL_PRESETS = [0.4, 0.8, 1.2, 2];

function getTradeSuggestion(item: NewsItem | null, ticker: string, price: number): TradeSuggestion | null {
  if (!item || !item.ticker.includes(ticker) || price <= 0) return null;

  const text = `${item.headline} ${item.summary}`.toLowerCase();
  let bias: Side = "long";

  if (
    item.sentiment === "bearish" ||
    text.includes("lawsuit") ||
    text.includes("hack") ||
    text.includes("liquidation") ||
    text.includes("outflow") ||
    text.includes("drops") ||
    text.includes("fall")
  ) {
    bias = "short";
  }

  if (
    item.sentiment === "bullish" ||
    text.includes("approval") ||
    text.includes("inflow") ||
    text.includes("buyback") ||
    text.includes("launches") ||
    text.includes("surge") ||
    text.includes("record")
  ) {
    bias = "long";
  }

  const orderType: OrderType =
    item.importance === "breaking" || item.importance === "market-moving" ? "market" : "limit";

  const tpPct =
    item.importance === "breaking" ? 2.8 :
    item.importance === "market-moving" ? 2.0 :
    item.importance === "watch" ? 1.3 :
    0.8;
  const slPct =
    item.importance === "breaking" ? 1.2 :
    item.importance === "market-moving" ? 0.9 :
    item.importance === "watch" ? 0.7 :
    0.5;

  return {
    bias,
    orderType,
    tpPct,
    slPct,
    tp: bias === "long" ? price * (1 + tpPct / 100) : price * (1 - tpPct / 100),
    sl: bias === "long" ? price * (1 - slPct / 100) : price * (1 + slPct / 100),
    confidenceLabel:
      item.importance === "breaking" ? "High conviction" :
      item.importance === "market-moving" ? "Fast momentum" :
      item.importance === "watch" ? "Watch setup" :
      "Low conviction",
    note: item.headline,
  };
}

function calcTargetPrice(side: Side, entry: number, percent: number, target: "tp" | "sl") {
  if (entry <= 0 || percent <= 0) return "";
  const multiplier =
    target === "tp"
      ? side === "long" ? 1 + percent / 100 : 1 - percent / 100
      : side === "long" ? 1 - percent / 100 : 1 + percent / 100;
  return (entry * multiplier).toString();
}

function calcTargetPercent(side: Side, entry: number, targetPrice: number, target: "tp" | "sl") {
  if (entry <= 0 || targetPrice <= 0) return "";
  const delta =
    target === "tp"
      ? side === "long" ? (targetPrice - entry) / entry : (entry - targetPrice) / entry
      : side === "long" ? (entry - targetPrice) / entry : (targetPrice - entry) / entry;
  if (!Number.isFinite(delta) || delta <= 0) return "";
  return (delta * 100).toFixed(2);
}

export default function TradingPanel({
  activeVenueState,
  selectedNews = null,
  balance,
  positions,
  prices,
  marketDataSourceLabel,
  onActiveSymbolChange,
  onPlaceOrder,
}: Props) {
  const [panelMode, setPanelMode] = useState<PanelMode>("advanced");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [side, setSide] = useState<Side>("long");
  const [marginMode, setMarginMode] = useState<MarginMode>("isolated");
  const [leverage, setLeverage] = useState(10);
  const [marginUSD, setMarginUSD] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [showLevSlider, setShowLevSlider] = useState(false);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const ticker = activeVenueState.activeSymbol;

  const currentPrice = prices[ticker] ?? getBasePrice(ticker);
  const execPrice = orderType === "market" ? currentPrice : parseFloat(limitPrice) || currentPrice;
  const margin = parseFloat(marginUSD) || 0;
  const notional = margin * leverage;
  const contractAmt = execPrice > 0 ? notional / execPrice : 0;
  const feeRate = orderType === "market" || orderType === "stop" ? TAKER_FEE : MAKER_FEE;
  const fee = notional * feeRate;
  const liqPrice = margin > 0 ? calcLiqPrice(side, execPrice, leverage) : null;
  const existingPos = positions.find((p) => p.ticker === ticker);
  const suggestedTrade = getTradeSuggestion(selectedNews, ticker, currentPrice);

  const tpNum = parseFloat(tpPrice) || 0;
  const slNum = parseFloat(slPrice) || 0;
  const tpPctNum = parseFloat(tpPercent) || 0;
  const slPctNum = parseFloat(slPercent) || 0;

  const tpError = tpNum > 0 && (
    (side === "long" && tpNum <= execPrice) || (side === "short" && tpNum >= execPrice)
  );
  const slError = slNum > 0 && (
    (side === "long" && slNum >= execPrice) || (side === "short" && slNum <= execPrice)
  );

  const rrRatio = useMemo(() => {
    if (tpNum <= 0 || slNum <= 0 || execPrice <= 0) return null;
    const reward = Math.abs(tpNum - execPrice);
    const risk = Math.abs(slNum - execPrice);
    if (risk <= 0) return null;
    return reward / risk;
  }, [tpNum, slNum, execPrice]);

  const applySuggestion = () => {
    if (!suggestedTrade) return;
    setSide(suggestedTrade.bias);
    setOrderType(suggestedTrade.orderType);
    setTpSlEnabled(true);
    setTpPercent(suggestedTrade.tpPct.toFixed(2));
    setSlPercent(suggestedTrade.slPct.toFixed(2));
    setTpPrice(suggestedTrade.tp.toString());
    setSlPrice(suggestedTrade.sl.toString());
    if (suggestedTrade.orderType === "limit") {
      setLimitPrice(currentPrice.toString());
    }
  };

  const updateTpFromPercent = (value: string) => {
    setTpPercent(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setTpPrice("");
      return;
    }
    setTpPrice(calcTargetPrice(side, execPrice, numeric, "tp"));
  };

  const updateSlFromPercent = (value: string) => {
    setSlPercent(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setSlPrice("");
      return;
    }
    setSlPrice(calcTargetPrice(side, execPrice, numeric, "sl"));
  };

  const updateTpFromPrice = (value: string) => {
    setTpPrice(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setTpPercent("");
      return;
    }
    setTpPercent(calcTargetPercent(side, execPrice, numeric, "tp"));
  };

  const updateSlFromPrice = (value: string) => {
    setSlPrice(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setSlPercent("");
      return;
    }
    setSlPercent(calcTargetPercent(side, execPrice, numeric, "sl"));
  };

  useEffect(() => {
    if (!tpSlEnabled) return;
    if (tpPctNum > 0) {
      setTpPrice(calcTargetPrice(side, execPrice, tpPctNum, "tp"));
    }
    if (slPctNum > 0) {
      setSlPrice(calcTargetPrice(side, execPrice, slPctNum, "sl"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, execPrice]);

  const handleSubmit = async () => {
    if (tpError || slError) {
      setSubmitFeedback({ type: "err", text: "Fix TP/SL inputs before submitting." });
      return;
    }
    if (margin <= 0) {
      setSubmitFeedback({ type: "err", text: "Enter a valid margin amount." });
      return;
    }
    if (activeVenueState.connectionStatus !== "connected") {
      setSubmitFeedback({
        type: "err",
        text: `Connect ${activeVenueState.venueId.toUpperCase()} before sending an order.`,
      });
      return;
    }

    setIsSubmittingOrder(true);
    setSubmitFeedback(null);
    const result = await onPlaceOrder(
      ticker,
      side,
      orderType,
      margin,
      leverage,
      marginMode,
      parseFloat(limitPrice) || undefined,
      tpSlEnabled && tpNum > 0 ? tpNum : undefined,
      tpSlEnabled && slNum > 0 ? slNum : undefined
    );
    setIsSubmittingOrder(false);
    if (result.ok) {
      setSubmitFeedback({ type: "ok", text: result.message });
      setMarginUSD("");
      setTpPrice("");
      setSlPrice("");
      setTpPercent("");
      setSlPercent("");
      return;
    }
    setSubmitFeedback({ type: "err", text: result.message });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[rgba(212,161,31,0.18)] bg-[linear-gradient(180deg,rgba(53,39,16,0.34),rgba(18,15,11,0.2))] p-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-amber-200" />
          </div>
          <div>
            <div className="brand-section-title text-xs font-bold uppercase">Execution</div>
            <div className="brand-subtle-text text-[10px]">Fast ticket with managed risk</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="terminal-chip hidden rounded-lg px-2 py-1 md:block">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Venue</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
              <span className="font-bold text-amber-200">{activeVenueState.venueId.toUpperCase()}</span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-zinc-400">
                {activeVenueState.connectionStatus.replaceAll("_", " ")}
              </span>
            </div>
          </div>
          <div className="terminal-chip hidden rounded-lg px-2 py-1 lg:block">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Market Data Source</div>
            <div className="mt-0.5 text-[10px] font-semibold text-[#f3ead7]">{marketDataSourceLabel}</div>
          </div>
          <div className="terminal-chip flex rounded-lg p-0.5">
            {(["basic", "advanced"] as PanelMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPanelMode(mode)}
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition ${
                  panelMode === mode ? "brand-chip-active" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="brand-badge brand-badge-success rounded-full px-2 py-0.5 text-[10px]">
            <span className="text-zinc-500">Avail </span>
            <span className="font-bold text-emerald-300">
              ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          {suggestedTrade && (
            <div className="panel-shell-alt rounded-2xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                      News Trade Setup
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-100">
                    {suggestedTrade.confidenceLabel} for {ticker}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
                    {suggestedTrade.note}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="brand-chip-active rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
                >
                  Apply
                </button>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5 text-[9px]">
                <div className="terminal-chip rounded-lg px-2 py-1">
                  <div className="text-zinc-500">Bias</div>
                  <div className={suggestedTrade.bias === "long" ? "text-emerald-300" : "text-red-300"}>
                    {suggestedTrade.bias.toUpperCase()}
                  </div>
                </div>
                <div className="terminal-chip rounded-lg px-2 py-1">
                  <div className="text-zinc-500">Type</div>
                  <div className="text-zinc-100">{suggestedTrade.orderType.toUpperCase()}</div>
                </div>
                <div className="terminal-chip rounded-lg px-2 py-1">
                  <div className="text-zinc-500">TP</div>
                  <div className="text-emerald-300">{fmtPct(suggestedTrade.tpPct)}</div>
                </div>
                <div className="terminal-chip rounded-lg px-2 py-1">
                  <div className="text-zinc-500">SL</div>
                  <div className="text-red-300">{fmtPct(suggestedTrade.slPct)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="panel-shell-alt rounded-2xl p-3">
            <div className="flex items-center justify-between gap-3">
              <select
                className="terminal-input rounded-xl px-3 py-2 text-xs text-amber-300 outline-none"
                value={ticker}
                onChange={(e) => onActiveSymbolChange(e.target.value)}
              >
                {AVAILABLE_TICKERS.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900">
                    {t}/USDT Perp
                  </option>
                ))}
              </select>

              <div className="text-right">
                <div className="text-sm font-bold text-white">${fmt(currentPrice)}</div>
                <div className="text-[10px] text-zinc-500">Live mark from {marketDataSourceLabel}</div>
                <div className="mt-0.5 text-[10px] text-amber-200">
                  {activeVenueState.venueId.toUpperCase()} · {activeVenueState.venueType.toUpperCase()}
                </div>
                {existingPos && (
                  <div
                    className={`mt-0.5 text-[10px] font-bold ${
                      existingPos.side === "long" ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {existingPos.side.toUpperCase()} {existingPos.leverage}x
                  </div>
                )}
              </div>
            </div>

            <div className={`mt-2 grid gap-1.5 ${panelMode === "advanced" ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="terminal-chip rounded-lg p-1.5">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Gauge className="h-3 w-3" /> Mode
                </div>
                <div className="mt-1 flex rounded-lg bg-black/20 p-0.5">
                  {(["isolated", "cross"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMarginMode(m)}
                      className={`flex-1 rounded-md px-1.5 py-0.5 text-[9px] uppercase transition ${
                        marginMode === m ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowLevSlider((v) => !v)}
                className="terminal-chip rounded-lg p-1.5 text-left transition hover:border-amber-400/20"
              >
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Gauge className="h-3 w-3" /> Leverage
                </div>
                <div className="mt-0.5 text-[13px] font-bold text-amber-300">{leverage}x</div>
              </button>

              {panelMode === "advanced" && (
                <div className="terminal-chip rounded-lg p-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Shield className="h-3 w-3" /> Est. Liq
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold text-amber-200">
                    {liqPrice ? `$${fmt(liqPrice)}` : "--"}
                  </div>
                </div>
              )}
            </div>

            {showLevSlider && panelMode === "advanced" && (
              <div className="mt-3 rounded-xl border border-white/6 bg-black/10 p-2.5">
                <div className="mb-2 flex justify-between text-[9px] text-zinc-500">
                  <span>1x</span>
                  <span className="font-bold text-amber-300">{leverage}x</span>
                  <span>125x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={125}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full cursor-pointer accent-amber-400"
                />
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {LEVERAGE_PRESETS.map((lv) => (
                    <button
                      key={lv}
                      onClick={() => {
                        setLeverage(lv);
                        setShowLevSlider(false);
                      }}
                      className={`min-w-0 rounded-md py-0.5 text-[8px] transition ${
                        leverage === lv
                          ? "bg-amber-500 font-bold text-black"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {lv}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel-shell-alt rounded-2xl p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {(["market", "limit", "stop"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`rounded-lg py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] transition ${
                    orderType === t
                      ? "brand-chip-active shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "terminal-chip text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSide("long")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                  side === "long"
                    ? "bg-[linear-gradient(180deg,#14805f,#0e5f48)] text-white shadow-[0_0_20px_rgba(16,185,129,0.16)]"
                    : "terminal-chip text-zinc-500 hover:text-emerald-300"
                }`}
              >
                Long
              </button>
              <button
                onClick={() => setSide("short")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                  side === "short"
                    ? "bg-[linear-gradient(180deg,#9b2f2f,#6c1f1f)] text-white shadow-[0_0_20px_rgba(239,68,68,0.14)]"
                    : "terminal-chip text-zinc-500 hover:text-red-300"
                }`}
              >
                Short
              </button>
            </div>

            {orderType !== "market" && (
              <div className="mt-3">
                <label className="mb-1 block text-[10px] text-zinc-500">
                  {orderType === "stop" ? "Stop Trigger (USDT)" : "Limit Price (USDT)"}
                </label>
                <input
                  type="number"
                  className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600"
                  placeholder={fmt(currentPrice)}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 flex justify-between">
                <label className="text-[10px] text-zinc-500">Margin (USDT)</label>
                <span className="text-[10px] text-zinc-600">Max ${balance.toFixed(2)}</span>
              </div>
              <input
                type="number"
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600"
                placeholder="0.00"
                value={marginUSD}
                onChange={(e) => setMarginUSD(e.target.value)}
              />
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => setMarginUSD(((balance * p) / 100).toFixed(2))}
                    className="terminal-chip rounded-md py-0.5 text-[8px] text-zinc-400 transition hover:text-zinc-200"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(panelMode === "advanced" || tpSlEnabled) && (
            <div className="panel-shell-alt rounded-2xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setTpSlEnabled((v) => !v)}
                  className={`flex items-center gap-1.5 text-[10px] font-medium transition ${
                    tpSlEnabled ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <TargetIcon className="h-3 w-3" />
                  TP / SL Engine
                  <span
                    className={`relative h-3 w-6 rounded-full transition ${
                      tpSlEnabled ? "bg-amber-500" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all ${
                        tpSlEnabled ? "left-3.5" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
                {tpSlEnabled && (
                  <span className="text-[9px] text-zinc-500">Percentage-based risk controls</span>
                )}
              </div>

              {tpSlEnabled && (
                <div className="mt-2.5 space-y-2.5">
                  <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1 text-[10px] text-emerald-300">
                        <Percent className="h-3 w-3" /> Take Profit
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {tpPctNum > 0 ? fmtPct(tpPctNum) : "Set target"}
                      </span>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-2">
                      <input
                        type="number"
                        className="terminal-input min-w-0 w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600"
                        placeholder="TP %"
                        value={tpPercent}
                        onChange={(e) => updateTpFromPercent(e.target.value)}
                      />
                      <input
                        type="number"
                        className={`terminal-input min-w-0 w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600 ${
                          tpError ? "border-red-600" : ""
                        }`}
                        placeholder={side === "long" ? `> ${fmt(execPrice)}` : `< ${fmt(execPrice)}`}
                        value={tpPrice}
                        onChange={(e) => updateTpFromPrice(e.target.value)}
                      />
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1">
                      {TP_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => updateTpFromPercent(preset.toString())}
                          className="terminal-chip min-w-0 rounded-md px-1 py-0.5 text-[8px] text-emerald-300"
                        >
                          +{preset}%
                        </button>
                      ))}
                    </div>
                    {tpError && (
                      <p className="mt-1 text-[9px] text-red-400">
                        TP must be {side === "long" ? "above" : "below"} entry
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-red-400/10 bg-red-400/[0.03] p-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1 text-[10px] text-red-300">
                        <Shield className="h-3 w-3" /> Stop Loss
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {slPctNum > 0 ? fmtPct(slPctNum) : "Set protection"}
                      </span>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-2">
                      <input
                        type="number"
                        className="terminal-input min-w-0 w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600"
                        placeholder="SL %"
                        value={slPercent}
                        onChange={(e) => updateSlFromPercent(e.target.value)}
                      />
                      <input
                        type="number"
                        className={`terminal-input min-w-0 w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-zinc-600 ${
                          slError ? "border-red-600" : ""
                        }`}
                        placeholder={side === "long" ? `< ${fmt(execPrice)}` : `> ${fmt(execPrice)}`}
                        value={slPrice}
                        onChange={(e) => updateSlFromPrice(e.target.value)}
                      />
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1">
                      {SL_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => updateSlFromPercent(preset.toString())}
                          className="terminal-chip min-w-0 rounded-md px-1 py-0.5 text-[8px] text-red-300"
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                    {slError && (
                      <p className="mt-1 text-[9px] text-red-400">
                        SL must be {side === "long" ? "below" : "above"} entry
                      </p>
                    )}
                  </div>

                  <div className="terminal-chip flex items-center justify-between rounded-xl px-3 py-2 text-[10px]">
                    <span className="text-zinc-500">Risk / Reward</span>
                    <span className={rrRatio && rrRatio >= 2 ? "text-emerald-300" : "text-zinc-200"}>
                      {rrRatio ? `${rrRatio.toFixed(2)} R` : "--"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {panelMode === "advanced" && margin > 0 && (
            <div className="panel-shell-alt rounded-2xl p-3 text-[10px]">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Order Summary
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Notional</span>
                  <span className="text-white">${notional.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Size</span>
                  <span className="text-white">{contractAmt.toFixed(6)} {ticker}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Entry</span>
                  <span className="text-white">${fmt(execPrice)}</span>
                </div>
                {liqPrice && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Est. Liq.</span>
                    <span className="font-bold text-amber-300">${fmt(liqPrice)}</span>
                  </div>
                )}
                {tpSlEnabled && tpNum > 0 && (
                  <div className="flex justify-between">
                    <span className="text-emerald-300">TP</span>
                    <span className="text-emerald-300">
                      ${fmt(tpNum)} {tpPctNum > 0 ? `(${fmtPct(tpPctNum)})` : ""}
                    </span>
                  </div>
                )}
                {tpSlEnabled && slNum > 0 && (
                  <div className="flex justify-between">
                    <span className="text-red-300">SL</span>
                    <span className="text-red-300">
                      ${fmt(slNum)} {slPctNum > 0 ? `(${fmtPct(slPctNum)})` : ""}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    Fee ({orderType === "limit" ? "Maker 0.02%" : "Taker 0.05%"})
                  </span>
                  <span className="text-zinc-300">${fee.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2">
                  <span className="text-zinc-400">Margin Required</span>
                  <span className={`font-bold ${margin + fee > balance ? "text-red-400" : "text-white"}`}>
                    ${(margin + fee).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {submitFeedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-[10px] ${
                submitFeedback.type === "ok"
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-400/20 bg-rose-500/10 text-rose-200"
              }`}
            >
              {submitFeedback.text}
            </div>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmittingOrder || margin <= 0 || margin + fee > balance || tpError || slError}
            className={`w-full rounded-xl py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              side === "long"
                ? "bg-[linear-gradient(180deg,#157a5d,#0e5f48)] text-white hover:brightness-110"
                : "bg-[linear-gradient(180deg,#942e2e,#6e2020)] text-white hover:brightness-110"
            }`}
          >
            {isSubmittingOrder
              ? `Submitting to ${activeVenueState.venueId.toUpperCase()}...`
              : side === "long"
                ? `Long ${ticker} ${leverage}x`
                : `Short ${ticker} ${leverage}x`}
            {orderType !== "market" && ` · ${orderType.toUpperCase()}`}
            {tpSlEnabled && (tpNum > 0 || slNum > 0) && " + TP/SL"}
          </button>
        </div>
      </div>
    </div>
  );
}
