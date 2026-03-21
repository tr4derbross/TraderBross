"use client";

import { useState, useMemo } from "react";
import { Position, Order, calcPnl, calcRoe, EquityPoint } from "@/hooks/useTradingState";
import { X, ChevronUp, TrendingUp, TrendingDown, Plus, AlertTriangle } from "lucide-react";

type Props = {
  positions: Position[];
  orders: Order[];
  balance: number;
  equityHistory: EquityPoint[];
  onClosePosition: (id: string, closePercent?: number) => void;
  onCancelOrder: (id: string) => void;
  onUpdatePositionTpSl: (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => void;
  drawerMode?: "half" | "full";
  isLiveVenue?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
};

function fmt(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
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

/* ─── Equity Chart ───────────────────────────────────────────────────────── */
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
        x: PAD.l + ((h.time - times[0]) / rangeT) * (W - PAD.l - PAD.r),
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

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-zinc-600">
        <TrendingUp className="h-7 w-7 text-zinc-700" />
        <span className="text-[11px] tracking-wide">P&amp;L history appears after 2 data points · sampled every 10 s</span>
      </div>
    );
  }

  const { pts, path, area, gridLines, timeLabels, lastVal, firstVal, isUp, color } = data;
  const changePct    = ((lastVal - firstVal) / firstVal) * 100;
  const changeDollar = lastVal - firstVal;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-3 pt-2 pb-1">
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
          &nbsp;({changeDollar >= 0 ? "+" : ""}${fmt(changeDollar)})
        </span>
        <span className="text-zinc-600">vs session start ${fmt(firstVal)}</span>
        <span className="ml-auto text-zinc-700 tabular-nums">{history.length} pts</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#1e1e22" strokeWidth="1" strokeDasharray="3,5" />
            <text x={PAD.l - 6} y={g.y + 3.5} fill="#3f3f46" fontSize="9" textAnchor="end">${fmt(g.val)}</text>
          </g>
        ))}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#27272a" strokeWidth="1" />
        <path d={area} fill="url(#equityAreaGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" />
        {pts.length > 0 && (
          <>
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={color} opacity="0.25" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={color} stroke="#09090b" strokeWidth="1.5" />
          </>
        )}
        {timeLabels.map((tl, i) => (
          <text key={i} x={tl.x} y={H - 8} fill="#3f3f46" fontSize="8" textAnchor="middle">{tl.label}</text>
        ))}
      </svg>
    </div>
  );
}

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-[13px] text-zinc-600">—</span>
          </div>
          <span className="text-[11px] text-zinc-600">{label}</span>
        </div>
      </td>
    </tr>
  );
}

function TH({ children = null, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-600 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

/* ─── TP/SL Editor (inline) ─────────────────────────────────────────────── */
function TpSlEditor({
  position,
  isLiveVenue,
  onSave,
  onCancel,
}: {
  position: Position;
  isLiveVenue: boolean;
  onSave: (tp: number | undefined, sl: number | undefined) => void;
  onCancel: () => void;
}) {
  const [draftTp, setDraftTp] = useState(position.tpPrice?.toString() ?? "");
  const [draftSl, setDraftSl] = useState(position.slPrice?.toString() ?? "");
  const [draftTpPct, setDraftTpPct] = useState(calcPercentFromPrice(position, position.tpPrice));
  const [draftSlPct, setDraftSlPct] = useState(calcPercentFromPrice(position, position.slPrice));

  const updateTpPrice = (v: string) => {
    setDraftTp(v);
    const n = parseFloat(v);
    setDraftTpPct(!v || !Number.isFinite(n) ? "" : calcPercentFromPrice(position, n));
  };
  const updateSlPrice = (v: string) => {
    setDraftSl(v);
    const n = parseFloat(v);
    setDraftSlPct(!v || !Number.isFinite(n) ? "" : calcPercentFromPrice(position, n));
  };
  const updateTpPct = (v: string) => {
    setDraftTpPct(v);
    setDraftTp(!v.trim() ? "" : calcPriceFromPercent(position, v, "tp"));
  };
  const updateSlPct = (v: string) => {
    setDraftSlPct(v);
    setDraftSl(!v.trim() ? "" : calcPriceFromPercent(position, v, "sl"));
  };

  const handleSave = () => {
    const tp = draftTp.trim() ? parseFloat(draftTp) : undefined;
    const sl = draftSl.trim() ? parseFloat(draftSl) : undefined;
    onSave(Number.isFinite(tp ?? NaN) ? tp : undefined, Number.isFinite(sl ?? NaN) ? sl : undefined);
  };

  return (
    <div className="mt-2 rounded-xl p-3 space-y-2" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(212,161,31,0.18)" }}>
      {isLiveVenue && (
        <p className="text-[9px] text-amber-400/60 leading-tight">Sends TAKE_PROFIT_MARKET / STOP_MARKET orders to Binance</p>
      )}
      {/* TP */}
      <div>
        <div className="mb-1 flex items-center gap-1">
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.1em]">TP</span>
          <span className="text-[9px] text-zinc-600">Take Profit</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="number" value={draftTpPct}
            onChange={(e) => updateTpPct(e.target.value)}
            placeholder="% ROE"
            className="w-full rounded-lg border border-emerald-400/15 bg-[#0b0e14] px-2 py-1.5 text-[10px] text-white outline-none focus:border-emerald-400/30 placeholder:text-zinc-700"
          />
          <input
            type="number" value={draftTp}
            onChange={(e) => updateTpPrice(e.target.value)}
            placeholder={`Price (${position.side === "long" ? ">" : "<"} ${fmt(position.entryPrice)})`}
            className="w-full rounded-lg border border-emerald-400/15 bg-[#0b0e14] px-2 py-1.5 text-[10px] text-white outline-none focus:border-emerald-400/30 placeholder:text-zinc-700"
          />
        </div>
        <div className="mt-1 flex gap-1">
          {TP_PERCENT_PRESETS.map((p) => (
            <button key={p} onClick={() => updateTpPct(p)}
              className="flex-1 rounded-md py-1 text-[9px] font-semibold transition hover:brightness-110"
              style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)", color: "#34d399" }}
            >+{p}%</button>
          ))}
        </div>
      </div>
      {/* SL */}
      <div>
        <div className="mb-1 flex items-center gap-1">
          <span className="text-[9px] font-bold text-red-400 uppercase tracking-[0.1em]">SL</span>
          <span className="text-[9px] text-zinc-600">Stop Loss</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="number" value={draftSlPct}
            onChange={(e) => updateSlPct(e.target.value)}
            placeholder="% Loss"
            className="w-full rounded-lg border border-red-400/15 bg-[#0b0e14] px-2 py-1.5 text-[10px] text-white outline-none focus:border-red-400/30 placeholder:text-zinc-700"
          />
          <input
            type="number" value={draftSl}
            onChange={(e) => updateSlPrice(e.target.value)}
            placeholder={`Price (${position.side === "long" ? "<" : ">"} ${fmt(position.entryPrice)})`}
            className="w-full rounded-lg border border-red-400/15 bg-[#0b0e14] px-2 py-1.5 text-[10px] text-white outline-none focus:border-red-400/30 placeholder:text-zinc-700"
          />
        </div>
        <div className="mt-1 flex gap-1">
          {SL_PERCENT_PRESETS.map((p) => (
            <button key={p} onClick={() => updateSlPct(p)}
              className="flex-1 rounded-md py-1 text-[9px] font-semibold transition hover:brightness-110"
              style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", color: "#f87171" }}
            >-{p}%</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <button onClick={handleSave}
          className="flex-1 rounded-lg py-1.5 text-[9px] font-bold text-black transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #d4a11f, #f0c842)" }}
        >
          {isLiveVenue ? "Send to Binance" : "Save"}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-white/8 px-3 py-1.5 text-[9px] text-zinc-400 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── BottomPanel ────────────────────────────────────────────────────────── */
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
  const [quickMenuPosId, setQuickMenuPosId] = useState<string | null>(null);
  const [closeMenuPosId, setCloseMenuPosId] = useState<string | null>(null);
  const [positionSort, setPositionSort] = useState<{
    field: "none" | "pnl" | "roe";
    direction: "desc" | "asc";
  }>({ field: "none", direction: "desc" });

  const openOrders = orders.filter((o) => o.status === "open");
  const history    = orders.filter((o) => o.status === "filled" || o.status === "cancelled");
  const sortedPositions = useMemo(() => {
    if (positionSort.field === "none") return positions;
    const list = [...positions];
    list.sort((a, b) => {
      const aPnl = calcPnl(a);
      const bPnl = calcPnl(b);
      const aRoe = calcRoe(a);
      const bRoe = calcRoe(b);
      const diff = positionSort.field === "pnl" ? bPnl - aPnl : bRoe - aRoe;
      return positionSort.direction === "desc" ? diff : -diff;
    });
    return list;
  }, [positionSort, positions]);
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + calcPnl(p), 0);
  const pnlPositive = totalUnrealizedPnL >= 0;

  const tabDefs = [
    { key: "positions"  as const, label: "Positions",   count: positions.length  },
    { key: "openorders" as const, label: "Open Orders", count: openOrders.length },
    { key: "history"    as const, label: "History",     count: history.length    },
    { key: "pnl"        as const, label: "P&L Chart",   count: null              },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "rgba(7,9,13,0.98)" }}>

      {/* ── Tab bar ── */}
      <div className="flex h-10 shrink-0 items-center gap-0 border-b px-2" style={{ borderColor: "rgba(255,255,255,0.055)" }}>
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
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full" style={{ background: "rgba(212,161,31,0.72)" }} />
              )}
            </button>
          ))}
        </div>

        {/* PnL summary */}
        {tab === "positions" && positions.length > 0 && (
          <div className="flex items-center gap-2 border-l border-white/5 pl-3 text-[10px]">
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
          <span className="text-[10px]">
            <span className="text-zinc-500">Bal </span>
            <span className="font-bold text-amber-100 tabular-nums">
              ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>
          <button type="button" onClick={onExpand}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
            title={drawerMode === "full" ? "Half height" : "Expand"}
          >
            <ChevronUp className={`h-3.5 w-3.5 transition-transform ${drawerMode === "full" ? "rotate-180" : ""}`} />
          </button>
          <button type="button" onClick={onCollapse}
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
              <tr style={{ background: "rgba(0,0,0,0.45)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <TH>Symbol</TH>
                <TH>Size</TH>
                <TH>Mark Price</TH>
                <TH>Entry Price</TH>
                <TH>Liq. Price</TH>
                <TH>Risk</TH>
                <TH>Margin</TH>
                <TH right>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] hover:bg-white/5"
                    onClick={() =>
                      setPositionSort((prev) =>
                        prev.field !== "pnl"
                          ? { field: "pnl", direction: "desc" }
                          : { field: "pnl", direction: prev.direction === "desc" ? "asc" : "desc" },
                      )
                    }
                    title="Sort by PnL"
                  >
                    PNL
                    <span className={positionSort.field === "pnl" ? "text-amber-300" : "text-zinc-700"}>
                      {positionSort.field === "pnl" ? (positionSort.direction === "desc" ? "↓" : "↑") : "↕"}
                    </span>
                  </button>
                  <span className="mx-0.5 text-zinc-700">/</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] hover:bg-white/5"
                    onClick={() =>
                      setPositionSort((prev) =>
                        prev.field !== "roe"
                          ? { field: "roe", direction: "desc" }
                          : { field: "roe", direction: prev.direction === "desc" ? "asc" : "desc" },
                      )
                    }
                    title="Sort by ROE"
                  >
                    ROE
                    <span className={positionSort.field === "roe" ? "text-amber-300" : "text-zinc-700"}>
                      {positionSort.field === "roe" ? (positionSort.direction === "desc" ? "↓" : "↑") : "↕"}
                    </span>
                  </button>
                </TH>
                <TH>TP / SL</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <EmptyRow cols={10} label="No open positions" />
              ) : (
                sortedPositions.map((pos, idx) => {
                  const pnl     = calcPnl(pos);
                  const roe     = calcRoe(pos);
                  const notional = pos.amount * pos.currentPrice;
                  const isLong  = pos.side === "long";
                  const pUp     = pnl >= 0;
                  const isEditing = editingPosId === pos.id;
                  const liqDistancePct = Math.abs((pos.currentPrice - pos.liquidationPrice) / Math.max(pos.currentPrice, 0.000001)) * 100;
                  const liqRiskLevel = liqDistancePct <= 2 ? "critical" : liqDistancePct <= 5 ? "warning" : "normal";

                  return (
                    <tr
                      key={pos.id}
                      className="group transition-colors"
                      style={{
                        background:
                          liqRiskLevel === "critical"
                            ? "rgba(248,113,113,0.06)"
                            : liqRiskLevel === "warning"
                              ? "rgba(245,158,11,0.045)"
                              : idx % 2 === 0
                                ? "rgba(255,255,255,0.011)"
                                : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.032)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.035)")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          liqRiskLevel === "critical"
                            ? "rgba(248,113,113,0.06)"
                            : liqRiskLevel === "warning"
                              ? "rgba(245,158,11,0.045)"
                              : idx % 2 === 0
                                ? "rgba(255,255,255,0.011)"
                                : "transparent")
                      }
                    >
                      {/* Symbol */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#f5efe1]">{pos.ticker}</span>
                            <span className="text-zinc-600">USDT</span>
                            <span className="text-[9px] uppercase tracking-wide text-zinc-700">Perp</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className="inline-flex items-center gap-0.5 rounded px-1.5 py-[2px] text-[9px] font-bold"
                              style={{
                                background: isLong ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                                border: `1px solid ${isLong ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                                color: isLong ? "#34d399" : "#f87171",
                              }}
                            >
                              {isLong ? "▲ LONG" : "▼ SHORT"}
                            </span>
                            <span
                              className="rounded px-1.5 py-[2px] text-[9px] font-bold"
                              style={{ background: "rgba(212,161,31,0.08)", border: "1px solid rgba(212,161,31,0.18)", color: "#d4a11f" }}
                            >
                              {pos.leverage}×
                            </span>
                            <span
                              className="rounded px-1.5 py-[2px] text-[9px] text-zinc-600"
                              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                            >
                              {pos.marginMode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-3 py-2.5">
                        <div className="tabular-nums text-white">{pos.amount.toFixed(4)}</div>
                        <div className="tabular-nums text-[10px] text-zinc-500">${notional.toFixed(2)}</div>
                      </td>

                      {/* Mark */}
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-white">${fmt(pos.currentPrice)}</td>

                      {/* Entry */}
                      <td className="px-3 py-2.5 tabular-nums text-zinc-300">${fmt(pos.entryPrice)}</td>

                      {/* Liq */}
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-[3px] text-[10px] tabular-nums"
                          style={{
                            background:
                              liqRiskLevel === "critical"
                                ? "rgba(248,113,113,0.12)"
                                : liqRiskLevel === "warning"
                                  ? "rgba(245,158,11,0.09)"
                                  : "rgba(245,158,11,0.07)",
                            border:
                              liqRiskLevel === "critical"
                                ? "1px solid rgba(248,113,113,0.35)"
                                : liqRiskLevel === "warning"
                                  ? "1px solid rgba(245,158,11,0.24)"
                                  : "1px solid rgba(245,158,11,0.16)",
                            color:
                              liqRiskLevel === "critical"
                                ? "#f87171"
                                : "#f59e0b",
                          }}
                        >
                          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                          ${fmt(pos.liquidationPrice)}
                        </span>
                        <div className="mt-0.5 text-[9px] tabular-nums text-zinc-600">
                          {liqDistancePct.toFixed(2)}% away
                        </div>
                      </td>

                      {/* Risk */}
                      <td className="px-3 py-2.5">
                        <div
                          className="inline-flex rounded px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wide"
                          style={{
                            background:
                              liqRiskLevel === "critical"
                                ? "rgba(248,113,113,0.14)"
                                : liqRiskLevel === "warning"
                                  ? "rgba(245,158,11,0.1)"
                                  : "rgba(52,211,153,0.1)",
                            border:
                              liqRiskLevel === "critical"
                                ? "1px solid rgba(248,113,113,0.32)"
                                : liqRiskLevel === "warning"
                                  ? "1px solid rgba(245,158,11,0.25)"
                                  : "1px solid rgba(52,211,153,0.22)",
                            color:
                              liqRiskLevel === "critical"
                                ? "#f87171"
                                : liqRiskLevel === "warning"
                                  ? "#f59e0b"
                                  : "#34d399",
                          }}
                        >
                          {liqRiskLevel === "critical" ? "High" : liqRiskLevel === "warning" ? "Mid" : "Low"}
                        </div>
                        <div className="mt-0.5 text-[9px] tabular-nums text-zinc-600">{liqDistancePct.toFixed(2)}%</div>
                      </td>

                      {/* Margin */}
                      <td className="px-3 py-2.5">
                        <div className="tabular-nums text-zinc-300">${pos.margin.toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-600">{pos.marginMode}</div>
                      </td>

                      {/* PNL */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="font-bold tabular-nums" style={{ color: pUp ? "#34d399" : "#f87171" }}>
                          {pUp ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] tabular-nums" style={{ color: pUp ? "#059669" : "#dc2626" }}>
                          {roe >= 0 ? "+" : ""}{roe.toFixed(2)}%
                        </div>
                      </td>

                      {/* TP / SL */}
                      <td className="px-3 py-2.5" style={{ minWidth: 160 }}>
                        <div className="flex flex-col gap-0.5 text-[10px]">
                          <span className="tabular-nums" style={{ color: pos.tpPrice ? "#34d399" : "#3f3f46" }}>
                            TP: {pos.tpPrice ? `$${fmt(pos.tpPrice)}` : "—"}
                          </span>
                          <span className="tabular-nums" style={{ color: pos.slPrice ? "#f87171" : "#3f3f46" }}>
                            SL: {pos.slPrice ? `$${fmt(pos.slPrice)}` : "—"}
                          </span>
                        </div>

                        {quickMenuPosId === pos.id && (
                          <div
                            className="mt-2 rounded-lg p-2"
                            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}
                          >
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                className="rounded-md py-1 text-[9px] font-bold text-emerald-300"
                                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.22)" }}
                                onClick={() => {
                                  const nextTp = Number(calcPriceFromPercent(pos, "1", "tp"));
                                  onUpdatePositionTpSl(pos.id, Number.isFinite(nextTp) ? nextTp : pos.tpPrice, pos.slPrice);
                                  setQuickMenuPosId(null);
                                }}
                              >
                                TP +1%
                              </button>
                              <button
                                className="rounded-md py-1 text-[9px] font-bold text-emerald-300"
                                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.22)" }}
                                onClick={() => {
                                  const nextTp = Number(calcPriceFromPercent(pos, "2", "tp"));
                                  onUpdatePositionTpSl(pos.id, Number.isFinite(nextTp) ? nextTp : pos.tpPrice, pos.slPrice);
                                  setQuickMenuPosId(null);
                                }}
                              >
                                TP +2%
                              </button>
                              <button
                                className="rounded-md py-1 text-[9px] font-bold text-red-300"
                                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)" }}
                                onClick={() => {
                                  const nextSl = Number(calcPriceFromPercent(pos, "1", "sl"));
                                  onUpdatePositionTpSl(pos.id, pos.tpPrice, Number.isFinite(nextSl) ? nextSl : pos.slPrice);
                                  setQuickMenuPosId(null);
                                }}
                              >
                                SL -1%
                              </button>
                              <button
                                className="rounded-md py-1 text-[9px] font-bold text-red-300"
                                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)" }}
                                onClick={() => {
                                  const nextSl = Number(calcPriceFromPercent(pos, "2", "sl"));
                                  onUpdatePositionTpSl(pos.id, pos.tpPrice, Number.isFinite(nextSl) ? nextSl : pos.slPrice);
                                  setQuickMenuPosId(null);
                                }}
                              >
                                SL -2%
                              </button>
                            </div>
                            <button
                              className="mt-1 w-full rounded-md py-1 text-[9px] text-zinc-300"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                              onClick={() => {
                                setEditingPosId(pos.id);
                                setQuickMenuPosId(null);
                              }}
                            >
                              Advanced Editor
                            </button>
                          </div>
                        )}

                        {isEditing && (
                          <TpSlEditor
                            position={pos}
                            isLiveVenue={isLiveVenue}
                            onSave={(tp, sl) => {
                              onUpdatePositionTpSl(pos.id, tp, sl);
                              setEditingPosId(null);
                              setQuickMenuPosId(null);
                            }}
                            onCancel={() => {
                              setEditingPosId(null);
                              setQuickMenuPosId(null);
                            }}
                          />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="relative flex items-center gap-2">
                          <button
                            onClick={() =>
                              setQuickMenuPosId((current) => {
                                if (current === pos.id) return null;
                                setEditingPosId(null);
                                return pos.id;
                              })
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-md transition"
                            style={{
                              background: quickMenuPosId === pos.id ? "rgba(212,161,31,0.15)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${quickMenuPosId === pos.id ? "rgba(212,161,31,0.35)" : "rgba(255,255,255,0.08)"}`,
                              color: quickMenuPosId === pos.id ? "#d4a11f" : "#52525b",
                            }}
                            title="Set TP / SL"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() =>
                              setCloseMenuPosId((current) => {
                                if (current === pos.id) return null;
                                return pos.id;
                              })
                            }
                            className="whitespace-nowrap rounded-md px-2 py-1.5 text-[10px] font-bold transition-all"
                            style={{
                              background: closeMenuPosId === pos.id ? "rgba(212,161,31,0.16)" : "rgba(212,161,31,0.08)",
                              border: `1px solid ${closeMenuPosId === pos.id ? "rgba(212,161,31,0.45)" : "rgba(212,161,31,0.22)"}`,
                              color: "#d4a11f",
                            }}
                          >
                            Close
                          </button>
                          <button
                            onClick={() => onClosePosition(pos.id, 100)}
                            className="whitespace-nowrap rounded-md px-3 py-1.5 text-[10px] font-bold transition-all"
                            style={{
                              background: "rgba(239,68,68,0.12)",
                              border: "1px solid rgba(239,68,68,0.32)",
                              color: "#f87171",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.26)";
                              (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.55)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)";
                              (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.32)";
                            }}
                          >
                            Market Close
                          </button>
                        </div>
                        {closeMenuPosId === pos.id && (
                          <div
                            className="absolute right-0 z-20 mt-1 flex w-[min(220px,calc(100vw-24px))] flex-col gap-1 rounded-lg p-2"
                            style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(212,161,31,0.2)" }}
                          >
                            <div className="text-[9px] uppercase tracking-[0.1em] text-zinc-500">Partial Close</div>
                            <div className="grid grid-cols-4 gap-1">
                              {[25, 50, 75, 100].map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() => {
                                    onClosePosition(pos.id, pct);
                                    setCloseMenuPosId(null);
                                  }}
                                  className="rounded-md py-1 text-[9px] font-bold"
                                  style={{ background: "rgba(212,161,31,0.1)", border: "1px solid rgba(212,161,31,0.24)", color: "#d4a11f" }}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
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
              <tr style={{ background: "rgba(0,0,0,0.45)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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
                    style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.011)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.032)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.035)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.011)" : "transparent")}
                  >
                    <td className="px-3 py-2 tabular-nums text-zinc-600">
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold"><span className="text-[#f5efe1]">{order.ticker}</span><span className="text-zinc-600">/USDT</span></td>
                    <td className="px-3 py-2 capitalize text-zinc-500">{order.type}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded px-2 py-[3px] text-[10px] font-bold"
                        style={{ background: order.side === "long" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${order.side === "long" ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.22)"}`, color: order.side === "long" ? "#34d399" : "#f87171" }}>
                        {order.side === "long" ? "▲" : "▼"} {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-amber-400 tabular-nums">{order.leverage}×</td>
                    <td className="px-3 py-2 tabular-nums text-white">${fmt(order.price)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">{order.amount.toFixed(4)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-400">${order.total.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                        style={{ background: "rgba(129,140,248,0.1)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.2)" }}>
                        Pending
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => onCancelOrder(order.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/8 text-zinc-600 transition hover:border-red-400/30 hover:bg-red-400/5 hover:text-red-300"
                        title="Cancel order">
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
              <tr style={{ background: "rgba(0,0,0,0.45)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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
                    style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.011)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.032)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,161,31,0.035)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.011)" : "transparent")}
                  >
                    <td className="px-3 py-2 tabular-nums text-zinc-600">
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold"><span className="text-[#f5efe1]">{order.ticker}</span><span className="text-zinc-600">/USDT</span></td>
                    <td className="px-3 py-2 capitalize text-zinc-500">{order.type}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded px-2 py-[3px] text-[10px] font-bold"
                        style={{ background: order.side === "long" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${order.side === "long" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`, color: order.side === "long" ? "#34d399" : "#f87171", opacity: 0.7 }}>
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
                        <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{ background: "rgba(212,161,31,0.08)", color: "#d4a11f", border: "1px solid rgba(212,161,31,0.18)" }}>
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
