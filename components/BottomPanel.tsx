"use client";

import { useState, useMemo } from "react";
import { Position, Order, calcPnl, calcRoe, EquityPoint } from "@/hooks/useTradingState";
import { X, ChevronUp, ChevronDown, TrendingUp, PencilLine } from "lucide-react";

type Props = {
  positions: Position[];
  orders: Order[];
  balance: number;
  equityHistory: EquityPoint[];
  onClosePosition: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onUpdatePositionTpSl: (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => void;
};

function fmt(n: number) {
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function calcPercentFromPrice(position: Position, targetPrice?: number) {
  if (!targetPrice || targetPrice <= 0 || position.entryPrice <= 0) return "";
  const delta =
    position.side === "long"
      ? Math.abs((targetPrice - position.entryPrice) / position.entryPrice)
      : Math.abs((position.entryPrice - targetPrice) / position.entryPrice);
  if (!Number.isFinite(delta) || delta <= 0) return "";
  return (delta * 100).toFixed(2);
}

function calcPriceFromPercent(position: Position, percent: string, target: "tp" | "sl") {
  const value = parseFloat(percent);
  if (!Number.isFinite(value) || value <= 0 || position.entryPrice <= 0) return "";

  const multiplier =
    target === "tp"
      ? position.side === "long"
        ? 1 + value / 100
        : 1 - value / 100
      : position.side === "long"
        ? 1 - value / 100
        : 1 + value / 100;

  return (position.entryPrice * multiplier).toString();
}

const TP_PERCENT_PRESETS = ["1", "2", "3"];
const SL_PERCENT_PRESETS = ["0.5", "1", "1.5"];

function EquityChart({ history }: { history: EquityPoint[] }) {
  const W = 780;
  const H = 130;
  const PAD = { t: 10, r: 20, b: 28, l: 60 };

  const data = useMemo(() => {
    if (history.length < 2) return null;

    const values = history.map((h) => h.value);
    const times = history.map((h) => h.time);

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rangeV = maxV - minV || 1;
    const rangeT = times[times.length - 1] - times[0] || 1;

    const pts = history.map((h, i) => {
      const x = PAD.l + ((h.time - times[0]) / rangeT) * (W - PAD.l - PAD.r);
      const y = H - PAD.b - ((h.value - minV) / rangeV) * (H - PAD.t - PAD.b);
      return { x, y, v: h.value, t: h.time, i };
    });

    const gridLines = Array.from({ length: 4 }, (_, i) => {
      const fraction = i / 3;
      const y = H - PAD.b - fraction * (H - PAD.t - PAD.b);
      const val = minV + fraction * rangeV;
      return { y, val };
    });

    const step = Math.floor(history.length / Math.min(history.length, 5));
    const timeLabels = history
      .filter((_, i) => i % step === 0 || i === history.length - 1)
      .map((h) => ({
        x: PAD.l + ((h.time - times[0]) / rangeT) * (W - PAD.l - PAD.r),
        label: new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));

    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = path + ` L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`;

    const lastVal = values[values.length - 1];
    const firstVal = values[0];
    const isUp = lastVal >= firstVal;
    const color = isUp ? "#34d399" : "#f87171";

    return { pts, path, area, gridLines, timeLabels, lastVal, firstVal, isUp, color };
  }, [history]);

  if (!data || history.length < 2) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-zinc-600">
        <TrendingUp className="h-6 w-6 text-zinc-700" />
        <span>P&amp;L history will appear after 2 data points (sampled every 10s)</span>
      </div>
    );
  }

  const { pts, path, area, gridLines, timeLabels, lastVal, firstVal, isUp, color } = data;
  const changePct = ((lastVal - firstVal) / firstVal) * 100;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-2 pt-1">
      <div className="mb-1 flex items-center gap-4 text-[10px]">
        <span className="text-zinc-500">Equity</span>
        <span className="font-bold text-white">${fmt(lastVal)}</span>
        <span className={`font-bold ${isUp ? "text-emerald-300" : "text-red-300"}`}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(3)}%
        </span>
        <span className="text-zinc-600">vs session start ${fmt(firstVal)}</span>
        <span className="ml-auto text-zinc-600">{history.length} points</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#27272a" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.l - 4} y={g.y + 3.5} fill="#52525b" fontSize="9" textAnchor="end">
              ${fmt(g.val)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#areaGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" />

        {pts.length > 0 && (
          <circle
            cx={pts[pts.length - 1].x}
            cy={pts[pts.length - 1].y}
            r="3"
            fill={color}
            stroke="#09090b"
            strokeWidth="1.5"
          />
        )}

        {timeLabels.map((tl, i) => (
          <text key={i} x={tl.x} y={H - 6} fill="#52525b" fontSize="8" textAnchor="middle">
            {tl.label}
          </text>
        ))}

        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#3f3f46" strokeWidth="1" />
      </svg>
    </div>
  );
}

export default function BottomPanel({
  positions,
  orders,
  balance,
  equityHistory,
  onClosePosition,
  onCancelOrder,
  onUpdatePositionTpSl,
}: Props) {
  const [tab, setTab] = useState<"positions" | "openorders" | "history" | "pnl">("positions");
  const [collapsed, setCollapsed] = useState(false);
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [draftTp, setDraftTp] = useState("");
  const [draftSl, setDraftSl] = useState("");
  const [draftTpPercent, setDraftTpPercent] = useState("");
  const [draftSlPercent, setDraftSlPercent] = useState("");

  const openOrders = orders.filter((o) => o.status === "open");
  const history = orders.filter((o) => o.status === "filled" || o.status === "cancelled");
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + calcPnl(p), 0);

  const openTpSlEditor = (position: Position) => {
    setEditingPosId(position.id);
    setDraftTp(position.tpPrice?.toString() ?? "");
    setDraftSl(position.slPrice?.toString() ?? "");
    setDraftTpPercent(calcPercentFromPrice(position, position.tpPrice));
    setDraftSlPercent(calcPercentFromPrice(position, position.slPrice));
  };

  const closeTpSlEditor = () => {
    setEditingPosId(null);
    setDraftTp("");
    setDraftSl("");
    setDraftTpPercent("");
    setDraftSlPercent("");
  };

  const saveTpSl = (position: Position) => {
    const nextTp = draftTp.trim() ? parseFloat(draftTp) : undefined;
    const nextSl = draftSl.trim() ? parseFloat(draftSl) : undefined;

    const tpValid =
      nextTp === undefined ||
      (position.side === "long" ? nextTp > position.entryPrice : nextTp < position.entryPrice);
    const slValid =
      nextSl === undefined ||
      (position.side === "long" ? nextSl < position.entryPrice : nextSl > position.entryPrice);

    if (!tpValid || !slValid) return;

    onUpdatePositionTpSl(
      position.id,
      Number.isFinite(nextTp ?? NaN) ? nextTp : undefined,
      Number.isFinite(nextSl ?? NaN) ? nextSl : undefined
    );
    closeTpSlEditor();
  };

  const updateTpPrice = (position: Position, value: string) => {
    setDraftTp(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setDraftTpPercent("");
      return;
    }
    setDraftTpPercent(calcPercentFromPrice(position, numeric));
  };

  const updateSlPrice = (position: Position, value: string) => {
    setDraftSl(value);
    const numeric = parseFloat(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      setDraftSlPercent("");
      return;
    }
    setDraftSlPercent(calcPercentFromPrice(position, numeric));
  };

  const updateTpPercent = (position: Position, value: string) => {
    setDraftTpPercent(value);
    if (!value.trim()) {
      setDraftTp("");
      return;
    }
    setDraftTp(calcPriceFromPercent(position, value, "tp"));
  };

  const updateSlPercent = (position: Position, value: string) => {
    setDraftSlPercent(value);
    if (!value.trim()) {
      setDraftSl("");
      return;
    }
    setDraftSl(calcPriceFromPercent(position, value, "sl"));
  };

  return (
    <div
      className={`panel-shell soft-divider shrink-0 flex flex-col rounded-xl border transition-all duration-200 ${
        collapsed ? "h-8" : "h-[220px]"
      }`}
    >
      <div className="panel-header soft-divider flex h-10 shrink-0 items-center gap-1 rounded-t-xl border-b px-3">
        <div className="mr-4 flex gap-0">
          {(
            [
              { key: "positions", label: `Positions (${positions.length})` },
              { key: "openorders", label: `Open Orders (${openOrders.length})` },
              { key: "history", label: "History" },
              { key: "pnl", label: "P&L Chart" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setCollapsed(false);
              }}
              className={`border-b-2 px-3 py-0.5 text-[11px] transition-colors ${
                tab === key && !collapsed
                  ? "border-[rgba(212,161,31,0.72)] text-[#f5efe1]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!collapsed && positions.length > 0 && tab !== "pnl" && (
          <div className="ml-2 flex items-center gap-3 text-[10px]">
            <span className="text-zinc-500">Unrealized PnL:</span>
            <span className={totalUnrealizedPnL >= 0 ? "font-bold text-emerald-300" : "font-bold text-red-300"}>
              {totalUnrealizedPnL >= 0 ? "+" : ""}${totalUnrealizedPnL.toFixed(2)}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">
            Balance:{" "}
            <span className="font-bold text-amber-100">
              ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>
          <button onClick={() => setCollapsed((c) => !c)} className="text-zinc-600 hover:text-zinc-400">
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={`flex-1 overflow-auto ${tab === "pnl" ? "flex flex-col" : ""}`}>
          {tab === "positions" && (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="sticky top-0 border-b border-zinc-800/60 bg-zinc-950 text-zinc-500">
                  {["Symbol", "Side", "Size", "Notional", "Entry Price", "Mark Price", "Liq. Price", "TP / SL", "Margin", "PnL (ROE%)", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-zinc-600">
                      No open positions
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => {
                    const p = calcPnl(pos);
                    const r = calcRoe(pos);
                    const notional = pos.amount * pos.currentPrice;
                    return (
                      <tr key={pos.id} className="border-b border-zinc-800/30 hover:bg-zinc-900/30">
                        <td className="px-3 py-1.5 font-bold text-white">{pos.ticker}/USDT</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              pos.side === "long" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
                            }`}
                          >
                            {pos.side.toUpperCase()} {pos.leverage}x
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-white">
                          {pos.amount.toFixed(6)} {pos.ticker}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-300">${notional.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-zinc-300">${fmt(pos.entryPrice)}</td>
                        <td className="px-3 py-1.5 text-white">${fmt(pos.currentPrice)}</td>
                        <td className="px-3 py-1.5 text-amber-400">${fmt(pos.liquidationPrice)}</td>
                        <td className="px-3 py-1.5 text-[10px]">
                          <div className="flex flex-col gap-0.5">
                            {pos.tpPrice ? (
                              <span className="text-emerald-300">TP: ${fmt(pos.tpPrice)}</span>
                            ) : (
                              <span className="text-zinc-700">TP: --</span>
                            )}
                            {pos.slPrice ? (
                              <span className="text-red-300">SL: ${fmt(pos.slPrice)}</span>
                            ) : (
                              <span className="text-zinc-700">SL: --</span>
                            )}
                          </div>
                          <div className="mt-1">
                            {editingPosId === pos.id ? (
                              <div className="space-y-1 rounded-lg border border-[rgba(212,161,31,0.14)] bg-black/20 p-2">
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="number"
                                    value={draftTpPercent}
                                    onChange={(e) => updateTpPercent(pos, e.target.value)}
                                    placeholder="TP %"
                                    className="w-full rounded-md border border-white/8 bg-[#101216] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-600"
                                  />
                                  <input
                                    type="number"
                                    value={draftTp}
                                    onChange={(e) => updateTpPrice(pos, e.target.value)}
                                    placeholder={`TP ${pos.side === "long" ? ">" : "<"} ${fmt(pos.entryPrice)}`}
                                    className="w-full rounded-md border border-white/8 bg-[#101216] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-600"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {TP_PERCENT_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      onClick={() => updateTpPercent(pos, preset)}
                                      className="rounded-md border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.05)] px-2 py-1 text-[9px] text-amber-100 transition hover:bg-[rgba(212,161,31,0.1)]"
                                    >
                                      TP {preset}%
                                    </button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="number"
                                    value={draftSlPercent}
                                    onChange={(e) => updateSlPercent(pos, e.target.value)}
                                    placeholder="SL %"
                                    className="w-full rounded-md border border-white/8 bg-[#101216] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-600"
                                  />
                                  <input
                                    type="number"
                                    value={draftSl}
                                    onChange={(e) => updateSlPrice(pos, e.target.value)}
                                    placeholder={`SL ${pos.side === "long" ? "<" : ">"} ${fmt(pos.entryPrice)}`}
                                    className="w-full rounded-md border border-white/8 bg-[#101216] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-600"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {SL_PERCENT_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      onClick={() => updateSlPercent(pos, preset)}
                                      className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] text-zinc-200 transition hover:bg-white/[0.06]"
                                    >
                                      SL {preset}%
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => saveTpSl(pos)}
                                    className="flex-1 rounded-md bg-[rgba(212,161,31,0.88)] px-2 py-1 text-[9px] font-bold text-black transition hover:brightness-105"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={closeTpSlEditor}
                                    className="rounded-md border border-white/8 px-2 py-1 text-[9px] text-zinc-300 transition hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openTpSlEditor(pos)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[rgba(212,161,31,0.14)] text-amber-200 transition hover:bg-[rgba(212,161,31,0.06)]"
                                title="Edit TP / SL"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-zinc-300">${pos.margin.toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          <span className={p >= 0 ? "text-emerald-300" : "text-red-300"}>
                            {p >= 0 ? "+" : ""}${p.toFixed(2)}&nbsp;
                            <span className="text-[10px]">
                              ({r >= 0 ? "+" : ""}
                              {r.toFixed(2)}%)
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="rounded border border-red-800 px-2 py-0.5 text-[10px] text-red-300 transition-colors hover:border-red-600 hover:text-red-200"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {tab === "openorders" && (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="sticky top-0 border-b border-zinc-800/60 bg-zinc-950 text-zinc-500">
                  {["Time", "Symbol", "Type", "Side", "Lev", "Price", "Amount", "Notional", "Status", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-600">
                      No open orders
                    </td>
                  </tr>
                ) : (
                  openOrders.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-800/30 hover:bg-zinc-900/30">
                      <td className="px-3 py-1.5 text-zinc-500">
                        {new Date(order.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-white">{order.ticker}/USDT</td>
                      <td className="px-3 py-1.5 capitalize text-zinc-400">{order.type}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            order.side === "long" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
                          }`}
                        >
                          {order.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-amber-400">{order.leverage}x</td>
                      <td className="px-3 py-1.5 text-white">${fmt(order.price)}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{order.amount.toFixed(6)}</td>
                      <td className="px-3 py-1.5 text-zinc-300">${order.total.toFixed(2)}</td>
                      <td className="px-3 py-1.5">
                        <span className="text-[10px] text-amber-200">Pending</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => onCancelOrder(order.id)} className="text-zinc-500 hover:text-red-300">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "history" && (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="sticky top-0 border-b border-zinc-800/60 bg-zinc-950 text-zinc-500">
                  {["Time", "Symbol", "Type", "Side", "Lev", "Fill Price", "Amount", "Notional", "Fee", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-600">
                      No order history
                    </td>
                  </tr>
                ) : (
                  history.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-800/30 hover:bg-zinc-900/30">
                      <td className="px-3 py-1.5 text-zinc-500">
                        {new Date(order.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-white">{order.ticker}/USDT</td>
                      <td className="px-3 py-1.5 capitalize text-zinc-400">{order.type}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            order.side === "long" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
                          }`}
                        >
                          {order.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-amber-400">{order.leverage}x</td>
                      <td className="px-3 py-1.5 text-white">${fmt(order.price)}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{order.amount.toFixed(6)}</td>
                      <td className="px-3 py-1.5 text-zinc-300">${order.total.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-zinc-500">${order.fee.toFixed(4)}</td>
                      <td className="px-3 py-1.5">
                        <span className={order.status === "filled" ? "text-amber-200" : "text-zinc-500"}>
                          {order.status === "filled" ? "Filled" : "Cancelled"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "pnl" && <EquityChart history={equityHistory} />}
        </div>
      )}
    </div>
  );
}
