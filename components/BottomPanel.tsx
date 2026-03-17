"use client";

import { useState, useMemo } from "react";
import { Position, Order, calcPnl, calcRoe, EquityPoint } from "@/hooks/useTradingState";
import { X, ChevronUp, TrendingUp, TrendingDown, PencilLine, AlertTriangle } from "lucide-react";

type Props = {
  positions: Position[];
  orders: Order[];
  balance: number;
  equityHistory: EquityPoint[];
  onClosePosition: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onUpdatePositionTpSl: (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => void;
  drawerMode?: "half" | "full";
  isLiveVenue?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
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
      ? position.side === "long" ? 1 + value / 100 : 1 - value / 100
      : position.side === "long" ? 1 - value / 100 : 1 + value / 100;
  return (position.entryPrice * multiplier).toString();
}

const TP_PERCENT_PRESETS = ["1", "2", "3", "5"];
const SL_PERCENT_PRESETS = ["0.5", "1", "1.5", "2"];

/* ─── Equity Chart ──────────────────────────────────────────────────────────── */
function EquityChart({ history }: { history: EquityPoint[] }) {
  const W = 780;
  const H = 140;
  const PAD = { t: 12, r: 24, b: 32, l: 64 };

  const data = useMemo(() => {
    if (history.length < 2) return null;

    const values = history.map((h) => h.value);
    const times  = history.map((h) => h.time);

    const minV   = Math.min(...values);
    const maxV   = Math.max(...values);
    const rangeV = maxV - minV || 1;
    const rangeT = times[times.length - 1] - times[0] || 1;

    const pts = history.map((h) => ({
      x: PAD.l + ((h.time - times[0]) / rangeT) * (W - PAD.l - PAD.r),
      y: H - PAD.b - ((h.value - minV) / rangeV) * (H - PAD.t - PAD.b),
      v: h.value,
    }));

    const gridLines = Array.from({ length: 4 }, (_, i) => {
      const fraction = i / 3;
      const y   = H - PAD.b - fraction * (H - PAD.t - PAD.b);
      const val = minV + fraction * rangeV;
      return { y, val };
    });

    const step = Math.floor(history.length / Math.min(history.length, 6));
    const timeLabels = history
      .filter((_, i) => i % step === 0 || i === history.length - 1)
      .map((h) => ({
        x:     PAD.l + ((h.time - times[0]) / rangeT) * (W - PAD.l - PAD.r),
        label: new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));

    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = path + ` L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`;

    const lastVal  = values[values.length - 1];
    const firstVal = values[0];
    const isUp     = lastVal >= firstVal;
    const color    = isUp ? "#34d399" : "#f87171";

    return { pts, path, area, gridLines, timeLabels, lastVal, firstVal, isUp, color };
  }, [history]);

  if (!data || history.length < 2) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-zinc-600">
        <TrendingUp className="h-7 w-7 text-zinc-700" />
        <span className="text-[11px] tracking-wide">P&amp;L history appears after 2 data points · sampled every 10 s</span>
      </div>
    );
  }

  const { pts, path, area, gridLines, timeLabels, lastVal, firstVal, isUp, color } = data;
  const changePct  = ((lastVal - firstVal) / firstVal) * 100;
  const changeDollar = lastVal - firstVal;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-3 pt-2 pb-1">
      {/* Header stats */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
        <span className="text-zinc-500 uppercase tracking-[0.12em]">Equity</span>
        <span className="font-bold text-white tabular-nums">${fmt(lastVal)}</span>

        <span
          className="flex items-center gap-1 rounded-md px-2 py-0.5 font-bold tabular-nums"
          style={{
            background: isUp ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${isUp ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            color: isUp ? "#34d399" : "#f87171",
          }}
        >
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%
          &nbsp;
          ({changeDollar >= 0 ? "+" : ""}${fmt(changeDollar)})
        </span>

        <span className="text-zinc-600">vs session start ${fmt(firstVal)}</span>
        <span className="ml-auto text-zinc-700 tabular-nums">{history.length} pts</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="equityAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y}
              stroke="#1e1e22" strokeWidth="1" strokeDasharray="3,5"
            />
            <text x={PAD.l - 6} y={g.y + 3.5} fill="#3f3f46" fontSize="9" textAnchor="end">
              ${fmt(g.val)}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b}
          stroke="#27272a" strokeWidth="1"
        />

        {/* Area + Line */}
        <path d={area} fill="url(#equityAreaGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" />

        {/* Live dot */}
        {pts.length > 0 && (
          <>
            <circle
              cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
              r="4" fill={color} opacity="0.25"
            />
            <circle
              cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
              r="2.5" fill={color} stroke="#09090b" strokeWidth="1.5"
              filter="url(#glow)"
            />
          </>
        )}

        {/* Time labels */}
        {timeLabels.map((tl, i) => (
          <text key={i} x={tl.x} y={H - 8} fill="#3f3f46" fontSize="8" textAnchor="middle">
            {tl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────────────── */
function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="text-[12px] text-zinc-600">—</span>
          </div>
          <span className="text-[11px] text-zinc-600">{label}</span>
        </div>
      </td>
    </tr>
  );
}

/* ─── Table header cell ─────────────────────────────────────────────────────── */
function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
      {children}
    </th>
  );
}

/* ─── BottomPanel ───────────────────────────────────────────────────────────── */
export default function BottomPanel({
  positions,
  orders,
  balance,
  equityHistory,
  onClosePosition,
  onCancelOrder,
  onUpdatePositionTpSl,
  drawerMode = "half",
  isLiveVenue = false,
  onCollapse,
  onExpand,
}: Props) {
  const [tab, setTab] = useState<"positions" | "openorders" | "history" | "pnl">("positions");
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [draftTp, setDraftTp]           = useState("");
  const [draftSl, setDraftSl]           = useState("");
  const [draftTpPercent, setDraftTpPercent] = useState("");
  const [draftSlPercent, setDraftSlPercent] = useState("");

  const openOrders = orders.filter((o) => o.status === "open");
  const history    = orders.filter((o) => o.status === "filled" || o.status === "cancelled");
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + calcPnl(p), 0);
  const pnlPositive = totalUnrealizedPnL >= 0;

  /* ─── TP/SL editor helpers ─── */
  const openTpSlEditor = (position: Position) => {
    setEditingPosId(position.id);
    setDraftTp(position.tpPrice?.toString() ?? "");
    setDraftSl(position.slPrice?.toString() ?? "");
    setDraftTpPercent(calcPercentFromPrice(position, position.tpPrice));
    setDraftSlPercent(calcPercentFromPrice(position, position.slPrice));
  };

  const closeTpSlEditor = () => {
    setEditingPosId(null);
    setDraftTp(""); setDraftSl(""); setDraftTpPercent(""); setDraftSlPercent("");
  };

  const saveTpSl = (position: Position) => {
    const nextTp = draftTp.trim() ? parseFloat(draftTp) : undefined;
    const nextSl = draftSl.trim() ? parseFloat(draftSl) : undefined;
    const tpValid = nextTp === undefined || (position.side === "long" ? nextTp > position.entryPrice : nextTp < position.entryPrice);
    const slValid = nextSl === undefined || (position.side === "long" ? nextSl < position.entryPrice : nextSl > position.entryPrice);
    if (!tpValid || !slValid) return;
    onUpdatePositionTpSl(position.id, Number.isFinite(nextTp ?? NaN) ? nextTp : undefined, Number.isFinite(nextSl ?? NaN) ? nextSl : undefined);
    closeTpSlEditor();
  };

  const updateTpPrice = (position: Position, value: string) => {
    setDraftTp(value);
    const n = parseFloat(value);
    setDraftTpPercent(!value || !Number.isFinite(n) || n <= 0 ? "" : calcPercentFromPrice(position, n));
  };
  const updateSlPrice = (position: Position, value: string) => {
    setDraftSl(value);
    const n = parseFloat(value);
    setDraftSlPercent(!value || !Number.isFinite(n) || n <= 0 ? "" : calcPercentFromPrice(position, n));
  };
  const updateTpPercent = (position: Position, value: string) => {
    setDraftTpPercent(value);
    setDraftTp(!value.trim() ? "" : calcPriceFromPercent(position, value, "tp"));
  };
  const updateSlPercent = (position: Position, value: string) => {
    setDraftSlPercent(value);
    setDraftSl(!value.trim() ? "" : calcPriceFromPercent(position, value, "sl"));
  };

  /* ─── Tab definitions ─── */
  const tabDefs = [
    { key: "positions"  as const, label: "Positions",    count: positions.length     },
    { key: "openorders" as const, label: "Open Orders",  count: openOrders.length    },
    { key: "history"    as const, label: "History",      count: history.length       },
    { key: "pnl"        as const, label: "P&L Chart",    count: null                 },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "rgba(7,9,13,0.98)" }}>

      {/* ── Tab bar ── */}
      <div
        className="flex h-10 shrink-0 items-center gap-0 border-b px-2"
        style={{ borderColor: "rgba(255,255,255,0.055)" }}
      >
        <div className="flex flex-1 items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabDefs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[10px] font-semibold transition-colors"
              style={{ color: tab === key ? "#f5efe1" : "#52525b" }}
            >
              {label}
              {count !== null && count > 0 && (
                <span
                  className="rounded-full px-1.5 py-[1px] text-[8px] font-bold tabular-nums"
                  style={{
                    background: tab === key ? "rgba(212,161,31,0.18)" : "rgba(255,255,255,0.06)",
                    color:      tab === key ? "#d4a11f" : "#52525b",
                  }}
                >
                  {count}
                </span>
              )}
              {tab === key && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full"
                  style={{ background: "rgba(212,161,31,0.72)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Summary strip for positions tab */}
        {tab === "positions" && positions.length > 0 && (
          <div className="flex items-center gap-3 border-l border-white/5 pl-3 text-[10px]">
            <span className="text-zinc-600">Unrealized</span>
            <span
              className="rounded-md px-2 py-0.5 font-bold tabular-nums"
              style={{
                background: pnlPositive ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                color: pnlPositive ? "#34d399" : "#f87171",
              }}
            >
              {pnlPositive ? "+" : ""}${totalUnrealizedPnL.toFixed(2)}
            </span>
          </div>
        )}

        {/* Balance + controls */}
        <div className="flex items-center gap-2 border-l border-white/5 pl-3">
          <span className="text-[10px] text-zinc-600">
            <span className="text-zinc-500">Bal </span>
            <span className="font-bold text-amber-100 tabular-nums">
              ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>
          <button
            type="button"
            onClick={onExpand}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
            title={drawerMode === "full" ? "Half height" : "Expand"}
          >
            <ChevronUp className={`h-3.5 w-3.5 transition-transform ${drawerMode === "full" ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
            title="Collapse"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={`min-h-0 flex-1 overflow-auto ${tab === "pnl" ? "flex flex-col" : ""}`}>

        {/* ═══ POSITIONS ═══ */}
        {tab === "positions" && (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Symbol", "Side", "Size", "Notional", "Entry", "Mark", "Liq.", "TP / SL", "Margin", "PnL (ROE%)", ""].map((h) => (
                  <TH key={h}>{h}</TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <EmptyRow cols={11} label="No open positions" />
              ) : (
                positions.map((pos, idx) => {
                  const p = calcPnl(pos);
                  const r = calcRoe(pos);
                  const notional = pos.amount * pos.currentPrice;
                  const isLong   = pos.side === "long";
                  const pUp      = p >= 0;

                  return (
                    <tr
                      key={pos.id}
                      className="group transition-colors"
                      style={{
                        background: idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.035)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent")}
                    >
                      {/* Symbol */}
                      <td className="px-3 py-2">
                        <span className="font-bold text-[#f5efe1]">{pos.ticker}</span>
                        <span className="text-zinc-600">/USDT</span>
                      </td>

                      {/* Side + leverage */}
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-bold"
                          style={{
                            background: isLong ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                            border:     `1px solid ${isLong ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.22)"}`,
                            color:      isLong ? "#34d399" : "#f87171",
                          }}
                        >
                          {isLong ? "▲" : "▼"} {pos.side.toUpperCase()}
                          <span className="opacity-70">{pos.leverage}×</span>
                        </span>
                      </td>

                      {/* Size */}
                      <td className="px-3 py-2 tabular-nums text-white">
                        {pos.amount.toFixed(4)}{" "}
                        <span className="text-zinc-600">{pos.ticker}</span>
                      </td>

                      {/* Notional */}
                      <td className="px-3 py-2 tabular-nums text-zinc-400">${notional.toFixed(2)}</td>

                      {/* Entry */}
                      <td className="px-3 py-2 tabular-nums text-zinc-400">${fmt(pos.entryPrice)}</td>

                      {/* Mark */}
                      <td className="px-3 py-2 tabular-nums font-semibold text-white">${fmt(pos.currentPrice)}</td>

                      {/* Liq. */}
                      <td className="px-3 py-2 tabular-nums">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.18)",
                            color: "#f59e0b",
                          }}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          ${fmt(pos.liquidationPrice)}
                        </span>
                      </td>

                      {/* TP / SL */}
                      <td className="px-3 py-2 text-[10px]">
                        <div className="flex flex-col gap-0.5">
                          {pos.tpPrice ? (
                            <span
                              className="rounded px-1.5 py-0.5 tabular-nums"
                              style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.18)" }}
                            >
                              TP ${fmt(pos.tpPrice)}
                            </span>
                          ) : (
                            <span className="text-zinc-700">TP —</span>
                          )}
                          {pos.slPrice ? (
                            <span
                              className="rounded px-1.5 py-0.5 tabular-nums"
                              style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.18)" }}
                            >
                              SL ${fmt(pos.slPrice)}
                            </span>
                          ) : (
                            <span className="text-zinc-700">SL —</span>
                          )}
                        </div>

                        {/* TP/SL editor — paper trading only */}
                        {!isLiveVenue && (
                        <div className="mt-1">
                          {editingPosId === pos.id ? (
                            <div
                              className="mt-1 space-y-1.5 rounded-xl p-2.5"
                              style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212,161,31,0.14)" }}
                            >
                              {/* TP row */}
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="number" value={draftTpPercent}
                                  onChange={(e) => updateTpPercent(pos, e.target.value)}
                                  placeholder="TP %"
                                  className="w-full rounded-lg border border-white/8 bg-[#0e1016] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-700"
                                />
                                <input
                                  type="number" value={draftTp}
                                  onChange={(e) => updateTpPrice(pos, e.target.value)}
                                  placeholder={`> ${fmt(pos.entryPrice)}`}
                                  className="w-full rounded-lg border border-white/8 bg-[#0e1016] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-700"
                                />
                              </div>
                              <div className="flex gap-1">
                                {TP_PERCENT_PRESETS.map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => updateTpPercent(pos, p)}
                                    className="flex-1 rounded-md px-1 py-1 text-[9px] font-semibold transition"
                                    style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}
                                  >
                                    +{p}%
                                  </button>
                                ))}
                              </div>

                              {/* SL row */}
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="number" value={draftSlPercent}
                                  onChange={(e) => updateSlPercent(pos, e.target.value)}
                                  placeholder="SL %"
                                  className="w-full rounded-lg border border-white/8 bg-[#0e1016] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-700"
                                />
                                <input
                                  type="number" value={draftSl}
                                  onChange={(e) => updateSlPrice(pos, e.target.value)}
                                  placeholder={`< ${fmt(pos.entryPrice)}`}
                                  className="w-full rounded-lg border border-white/8 bg-[#0e1016] px-2 py-1 text-[10px] text-white outline-none placeholder:text-zinc-700"
                                />
                              </div>
                              <div className="flex gap-1">
                                {SL_PERCENT_PRESETS.map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => updateSlPercent(pos, p)}
                                    className="flex-1 rounded-md px-1 py-1 text-[9px] font-semibold transition"
                                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", color: "#f87171" }}
                                  >
                                    -{p}%
                                  </button>
                                ))}
                              </div>

                              <div className="flex gap-1 pt-0.5">
                                <button
                                  onClick={() => saveTpSl(pos)}
                                  className="flex-1 rounded-lg py-1.5 text-[9px] font-bold text-black transition hover:brightness-105"
                                  style={{ background: "rgba(212,161,31,0.9)" }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={closeTpSlEditor}
                                  className="rounded-lg border border-white/8 px-3 py-1.5 text-[9px] text-zinc-400 transition hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openTpSlEditor(pos)}
                              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/8 text-zinc-600 transition hover:border-amber-400/30 hover:bg-amber-400/5 hover:text-amber-200"
                              title="Edit TP / SL"
                            >
                              <PencilLine className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        )}
                      </td>

                      {/* Margin */}
                      <td className="px-3 py-2 tabular-nums text-zinc-400">${pos.margin.toFixed(2)}</td>

                      {/* PnL */}
                      <td className="px-3 py-2 tabular-nums">
                        <div className="flex flex-col">
                          <span
                            className="font-bold"
                            style={{ color: pUp ? "#34d399" : "#f87171" }}
                          >
                            {pUp ? "+" : ""}${p.toFixed(2)}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: pUp ? "#059669" : "#dc2626" }}
                          >
                            {r >= 0 ? "+" : ""}{r.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* Close */}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors"
                          style={{
                            background: isLiveVenue ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.35)",
                            color: "#f87171",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.28)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = isLiveVenue ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.08)";
                          }}
                        >
                          {isLiveVenue ? "Market Close" : "Close"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* ═══ OPEN ORDERS ═══ */}
        {tab === "openorders" && (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Time", "Symbol", "Type", "Side", "Lev", "Price", "Amount", "Notional", "Status", ""].map((h) => (
                  <TH key={h}>{h}</TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {openOrders.length === 0 ? (
                <EmptyRow cols={10} label="No open orders" />
              ) : (
                openOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className="transition-colors"
                    style={{
                      background: idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.035)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent")}
                  >
                    <td className="px-3 py-2 tabular-nums text-zinc-600">
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <span className="text-[#f5efe1]">{order.ticker}</span>
                      <span className="text-zinc-600">/USDT</span>
                    </td>
                    <td className="px-3 py-2 capitalize text-zinc-500">{order.type}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-bold"
                        style={{
                          background: order.side === "long" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                          border:     `1px solid ${order.side === "long" ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.22)"}`,
                          color:      order.side === "long" ? "#34d399" : "#f87171",
                        }}
                      >
                        {order.side === "long" ? "▲" : "▼"} {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-amber-400 tabular-nums">{order.leverage}×</td>
                    <td className="px-3 py-2 tabular-nums text-white">${fmt(order.price)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">{order.amount.toFixed(4)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">${order.total.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                        style={{ background: "rgba(129,140,248,0.1)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.2)" }}
                      >
                        Pending
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onCancelOrder(order.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/8 text-zinc-600 transition hover:border-red-400/30 hover:bg-red-400/5 hover:text-red-300"
                        title="Cancel order"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* ═══ HISTORY ═══ */}
        {tab === "history" && (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Time", "Symbol", "Type", "Side", "Lev", "Fill Price", "Amount", "Notional", "Fee", "Status"].map((h) => (
                  <TH key={h}>{h}</TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <EmptyRow cols={10} label="No order history" />
              ) : (
                history.map((order, idx) => (
                  <tr
                    key={order.id}
                    className="transition-colors"
                    style={{
                      background: idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.035)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent")}
                  >
                    <td className="px-3 py-2 tabular-nums text-zinc-600">
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <span className="text-[#f5efe1]">{order.ticker}</span>
                      <span className="text-zinc-600">/USDT</span>
                    </td>
                    <td className="px-3 py-2 capitalize text-zinc-500">{order.type}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-bold"
                        style={{
                          background: order.side === "long" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                          border:     `1px solid ${order.side === "long" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`,
                          color:      order.side === "long" ? "#34d399" : "#f87171",
                          opacity:    0.7,
                        }}
                      >
                        {order.side === "long" ? "▲" : "▼"} {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-amber-400/70">{order.leverage}×</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-300">${fmt(order.price)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{order.amount.toFixed(4)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">${order.total.toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600">${order.fee.toFixed(4)}</td>
                    <td className="px-3 py-2">
                      {order.status === "filled" ? (
                        <span
                          className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{ background: "rgba(212,161,31,0.08)", color: "#d4a11f", border: "1px solid rgba(212,161,31,0.18)" }}
                        >
                          Filled
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* ═══ P&L CHART ═══ */}
        {tab === "pnl" && <EquityChart history={equityHistory} />}
      </div>
    </div>
  );
}
