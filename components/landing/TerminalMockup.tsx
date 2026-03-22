"use client";

import { motion } from "framer-motion";

const NEWS_ITEMS = [
  { source: "Cointelegraph", tag: "Market Moving", tagColor: "#F2B705", text: "Fidelity urges SEC to move further on crypto activity by broker-dealers", coins: ["ETH"], sentiment: "NEUT 70%" },
  { source: "CoinDesk", tag: "Breaking", tagColor: "#ef4444", text: "Bitcoin holds $68k support as Middle East tensions ease", coins: ["BTC"], sentiment: "BULL 65%" },
  { source: "Reddit r/CryptoMarkets", tag: "Social", tagColor: "#6B6B6B", text: "XRP Derivatives Market Under Pressure As Regulatory Forces Build", coins: ["XRP"], sentiment: "NEUT 70%" },
];

const CHART_BARS = [
  { h: 48, isGreen: false }, { h: 62, isGreen: true }, { h: 55, isGreen: true },
  { h: 70, isGreen: false }, { h: 45, isGreen: false }, { h: 80, isGreen: true },
  { h: 65, isGreen: true }, { h: 72, isGreen: false }, { h: 58, isGreen: true },
  { h: 90, isGreen: false }, { h: 75, isGreen: false }, { h: 68, isGreen: true },
  { h: 85, isGreen: true }, { h: 60, isGreen: false }, { h: 78, isGreen: true },
  { h: 92, isGreen: false }, { h: 70, isGreen: true }, { h: 82, isGreen: true },
  { h: 66, isGreen: false }, { h: 88, isGreen: true },
];

export default function TerminalMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative w-full max-w-5xl mx-auto mt-8 rounded-xl overflow-hidden"
      style={{
        border: "1px solid rgba(242,183,5,0.2)",
        boxShadow: "0 0 80px rgba(242,183,5,0.08), 0 0 0 1px rgba(255,255,255,0.04)",
        background: "#0D0D0D",
      }}
    >
      {/* Top glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(242,183,5,0.4), transparent)" }}
      />

      {/* ── Macro bar ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-3 py-1.5 overflow-hidden text-[10px] font-mono"
        style={{ background: "#111", borderBottom: "1px solid #1E1E1E" }}
      >
        <span className="flex items-center gap-1.5 text-[#ef4444] font-semibold shrink-0">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
          Extreme Fear 10
        </span>
        {[
          ["MCAP", "$2.44T"], ["24H", "-1.89%"], ["BTC DOM", "56.3%"],
          ["ETH DOM", "10.3%"], ["BLOCK", "#941,739"], ["MEMPOOL", "29k tx"],
          ["DEFI TVL", "$94.1B"],
        ].map(([k, v]) => (
          <span key={k} className="shrink-0 text-[#6B6B6B]">
            {k} <span className="text-[#A0A0A0]">{v}</span>
          </span>
        ))}
        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-green-400 font-semibold">US OPEN</span>
          <span className="text-[#6B6B6B] ml-2">Active Americas</span>
        </span>
      </div>

      {/* ── Main 3-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[260px_1fr_200px] h-[320px]">

        {/* ─ Left: News Feed ──────────────────────────────────────────────── */}
        <div style={{ borderRight: "1px solid #1E1E1E" }} className="flex flex-col">
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: "1px solid #1E1E1E" }}
          >
            <span className="text-[10px] font-semibold text-[#FFFFFF] tracking-wide">NEWS FEED</span>
            <span className="flex items-center gap-1 rounded-full bg-[rgba(74,222,128,0.1)] px-1.5 py-0.5 text-[8px] font-mono text-green-400">
              <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
            <span className="ml-auto text-[9px] text-[#6B6B6B]">68 items</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: "1px solid #1E1E1E" }}>
            {["All 68", "News 31", "Social 36", "Whales 1"].map((t) => (
              <span key={t} className="text-[9px] text-[#6B6B6B] hover:text-white cursor-pointer first:text-[#F2B705] first:font-semibold">
                {t}
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col gap-0">
            {NEWS_ITEMS.map((item, i) => (
              <div
                key={i}
                className="px-3 py-2 flex flex-col gap-1 cursor-pointer hover:bg-[#161616] transition-colors"
                style={{ borderBottom: "1px solid #1A1A1A" }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[8px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${item.tagColor}20`, color: item.tagColor }}
                  >
                    {item.tag}
                  </span>
                  <span className="text-[8px] text-[#6B6B6B] truncate">{item.source}</span>
                </div>
                <p className="text-[10px] text-[#D0D0D0] leading-snug line-clamp-2">{item.text}</p>
                <div className="flex items-center gap-1.5">
                  {item.coins.map((c) => (
                    <span key={c} className="text-[8px] font-mono bg-[#1E1E1E] text-[#A0A0A0] px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                  <span className="text-[8px] text-[#6B6B6B] ml-auto">— {item.sentiment}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button className="text-[8px] bg-[rgba(242,183,5,0.12)] text-[#F2B705] px-2 py-0.5 rounded font-semibold">
                    Quick Long
                  </button>
                  <button className="text-[8px] bg-[#1A1A1A] text-[#A0A0A0] px-2 py-0.5 rounded">
                    Analyze
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Center: Chart ────────────────────────────────────────────────── */}
        <div className="flex flex-col">
          <div
            className="flex items-center gap-3 px-3 py-2"
            style={{ borderBottom: "1px solid #1E1E1E" }}
          >
            <span className="text-[11px] font-bold text-white">BTCUSDT</span>
            <span className="text-[8px] bg-[rgba(242,183,5,0.15)] text-[#F2B705] px-1.5 py-0.5 rounded font-mono">PERP</span>
            {["1m", "5m", "15m", "1H", "4H", "1D"].map((t) => (
              <span key={t} className={`text-[9px] cursor-pointer ${t === "5m" ? "text-[#F2B705] font-semibold" : "text-[#6B6B6B]"}`}>{t}</span>
            ))}
            <div className="ml-auto text-right">
              <div className="text-[10px] font-mono text-[#ef4444] font-semibold">BINANCE −0.0051%</div>
              <div className="text-[8px] text-[#6B6B6B]">Next 8h 20m</div>
            </div>
          </div>

          {/* Chart area */}
          <div className="flex-1 relative px-3 pt-2 pb-3 overflow-hidden">
            {/* Price levels */}
            {["68900", "68700", "68500", "68300", "68100"].map((p, i) => (
              <div
                key={p}
                className="absolute right-3 text-[7px] font-mono text-[#3A3A3A]"
                style={{ top: `${12 + i * 18}%` }}
              >
                {p}
                <div className="absolute right-8 top-1/2 -translate-y-1/2 w-full border-t border-[#1E1E1E]" style={{ width: "calc(100vw)" }} />
              </div>
            ))}

            {/* News trigger banner */}
            <div
              className="absolute top-3 left-3 right-12 rounded text-[8px] px-2 py-1 z-10"
              style={{ background: "rgba(242,183,5,0.1)", border: "1px solid rgba(242,183,5,0.2)" }}
            >
              <span className="text-[#F2B705] font-semibold">News trigger: </span>
              <span className="text-[#A0A0A0]">Bitcoin holds $68k support as Middle East tensions ease — CoinDesk</span>
            </div>

            {/* Candlestick bars */}
            <div className="absolute bottom-3 left-3 right-12 flex items-end gap-[2px] h-[55%]">
              {CHART_BARS.map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${bar.h}%`,
                    background: bar.isGreen ? "rgba(74,222,128,0.7)" : "rgba(239,68,68,0.7)",
                    minWidth: 4,
                  }}
                />
              ))}
            </div>

            {/* Current price line */}
            <div
              className="absolute right-3 font-mono text-[9px] font-bold text-white bg-[#F2B705] px-1.5 py-0.5 rounded"
              style={{ bottom: "36%" }}
            >
              68,798
            </div>
          </div>

          {/* Bottom status bar */}
          <div
            className="flex items-center gap-3 px-3 py-1.5"
            style={{ borderTop: "1px solid #1E1E1E" }}
          >
            {[
              { label: "BINANCE", active: false },
              { label: "OKX", active: false },
              { label: "Bybit", active: true },
              { label: "HL", active: false },
              { label: "dYdX", active: false },
            ].map(({ label, active }) => (
              <span key={label} className="flex items-center gap-1 text-[8px] font-mono text-[#6B6B6B]">
                <span className={`h-1 w-1 rounded-full ${active ? "bg-[#F2B705]" : "bg-[#3A3A3A]"}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ─ Right: Trade Panel ───────────────────────────────────────────── */}
        <div
          className="flex flex-col"
          style={{ borderLeft: "1px solid #1E1E1E" }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid #1E1E1E" }}
          >
            {["TRADE", "DEX", "SIGNALS", "WATCH"].map((t) => (
              <span key={t} className={`text-[8px] font-semibold cursor-pointer ${t === "TRADE" ? "text-[#F2B705]" : "text-[#6B6B6B]"}`}>
                {t}
              </span>
            ))}
          </div>

          <div className="flex-1 flex flex-col gap-3 p-3">
            {/* Exchange */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[#FFFFFF]">BYBIT</span>
              <span className="flex items-center gap-1 text-[8px] text-[#F2B705]">
                <span className="h-1 w-1 rounded-full bg-[#F2B705] animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Price */}
            <div>
              <div className="text-[18px] font-mono font-bold text-white">$68,798</div>
              <div className="text-[8px] text-[#6B6B6B]">BYBIT LINEAR MARK</div>
            </div>

            {/* Market / Limit / Stop */}
            <div className="flex gap-1">
              {["Market", "Limit", "Stop"].map((t) => (
                <button
                  key={t}
                  className={`flex-1 text-[8px] py-1 rounded ${t === "Market" ? "bg-[#F2B705] text-[#0B0B0B] font-bold" : "bg-[#1A1A1A] text-[#6B6B6B]"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Long / Short */}
            <div className="flex gap-1">
              <button className="flex-1 text-[10px] py-2 rounded font-bold text-white" style={{ background: "#16a34a" }}>
                Long
              </button>
              <button className="flex-1 text-[10px] py-2 rounded font-bold text-[#6B6B6B] bg-[#1A1A1A]">
                Short
              </button>
            </div>

            {/* Leverage */}
            <div>
              <div className="flex justify-between text-[8px] text-[#6B6B6B] mb-1">
                <span>Leverage</span>
                <span className="text-[#F2B705] font-bold">10x</span>
              </div>
              <div className="h-1 rounded-full bg-[#1E1E1E] relative">
                <div className="h-full w-[30%] rounded-full bg-[#F2B705]" />
                <div className="absolute top-1/2 left-[30%] -translate-y-1/2 h-3 w-3 rounded-full bg-[#F2B705] border-2 border-[#0D0D0D]" />
              </div>
            </div>

            {/* TP/SL */}
            <div
              className="rounded p-2 text-[8px]"
              style={{ background: "#111", border: "1px solid #1E1E1E" }}
            >
              <div className="flex justify-between text-[#6B6B6B]">
                <span>TP / SL</span>
                <span className="text-[#A0A0A0]">Isolated · Cross</span>
              </div>
            </div>

            {/* Review button */}
            <button
              className="mt-auto w-full py-2 rounded text-[9px] font-bold text-[#6B6B6B]"
              style={{ background: "#1A1A1A", border: "1px solid #2A2A2A" }}
            >
              Review Long · BYBIT
            </button>
          </div>
        </div>
      </div>

      {/* Bottom fade overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-16"
        style={{ background: "linear-gradient(to top, #0D0D0D, transparent)" }}
      />
    </motion.div>
  );
}
