import Link from "next/link";
import { Suspense } from "react";
import BrandMark from "@/components/BrandMark";
import LivePricesBadge from "@/components/LivePricesBadge";
import {
  ArrowUpRight,
  Newspaper,
  Zap,
  LayoutDashboard,
  Send,
  Shield,
  Brain,
  TrendingUp,
  Activity,
  Globe,
  ChevronRight,
} from "lucide-react";

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const featureCards = [
  {
    icon: Newspaper,
    title: "Real-time News Feed",
    text: "Breaking crypto headlines with source quality scoring, sentiment context, and symbol-linked market reaction — all in one stream.",
    color: "amber",
  },
  {
    icon: Zap,
    title: "Fast Execution",
    text: "Move from news → chart → order without switching tools. TP/SL overlays stay visible through the entire execution workflow.",
    color: "gold",
  },
  {
    icon: Brain,
    title: "AI Analysis",
    text: "TraderBross AI analyzes headlines for trading implications, direction bias, key levels, and risk factors in seconds.",
    color: "emerald",
  },
  {
    icon: Activity,
    title: "Market Sentiment",
    text: "Fear & Greed Index, funding rates, liquidation heatmaps, and on-chain signals surfaced right inside the terminal.",
    color: "blue",
  },
  {
    icon: LayoutDashboard,
    title: "Strategy Workspace",
    text: "Multi-panel layout built for active traders — watchlists, news, charts, and execution controls in one structured interface.",
    color: "purple",
  },
  {
    icon: Globe,
    title: "Multi-Venue Support",
    text: "Monitor conditions across exchanges, track funding differentials, and route your attention where the edge actually is.",
    color: "rose",
  },
];

const iconColorMap: Record<string, string> = {
  amber: "text-amber-300",
  gold: "text-yellow-300",
  emerald: "text-emerald-400",
  blue: "text-sky-400",
  purple: "text-violet-400",
  rose: "text-rose-400",
};

const iconBgMap: Record<string, string> = {
  amber: "border-amber-400/20 bg-amber-400/8",
  gold: "border-yellow-400/20 bg-yellow-400/8",
  emerald: "border-emerald-400/20 bg-emerald-400/8",
  blue: "border-sky-400/20 bg-sky-400/8",
  purple: "border-violet-400/20 bg-violet-400/8",
  rose: "border-rose-400/20 bg-rose-400/8",
};

const stats = [
  { value: "6+", label: "Exchanges" },
  { value: "AI", label: "Powered" },
  { value: "0ms", label: "Lag" },
  { value: "Free", label: "Always" },
];

const footerLinks = [
  { label: "X / Twitter", href: "https://x.com/traderbross" },
  { label: "Telegram", href: "https://t.me/traderbross" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "mailto:Nikokaya24@gmail.com" },
];

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#07060a] text-[var(--text-primary)]">
      {/* ── Ambient orbs ────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        {/* Scan line */}
        <div className="hero-scan" />
      </div>

      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between border-b border-[rgba(212,161,31,0.1)] bg-[rgba(7,6,10,0.72)] px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <BrandMark className="h-auto w-[130px] sm:w-[148px]" />
        </div>

        <nav className="flex items-center gap-2">
          <a
            href="https://t.me/traderbross"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.06)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-[rgba(212,161,31,0.28)] hover:text-zinc-100 sm:inline-flex"
          >
            <Send className="h-3 w-3" />
            Telegram
          </a>
          <a
            href="https://x.com/traderbross"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.06)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-[rgba(212,161,31,0.28)] hover:text-zinc-100 sm:inline-flex"
          >
            𝕏
          </a>
          <Link
            href="/terminal"
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(212,161,31,0.92)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0c0a04] shadow-[0_0_18px_rgba(212,161,31,0.35)] transition-all hover:bg-[rgba(212,161,31,1)] hover:shadow-[0_0_28px_rgba(212,161,31,0.55)]"
          >
            Enter Terminal
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="hero-section relative z-10 flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 pb-16 pt-10 text-center sm:px-6">
        {/* Badge */}
        <div className="hero-content mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.08)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-amber-300">
          <Shield className="h-3 w-3" />
          News-first trading workflow
        </div>

        {/* Headline */}
        <h1 className="hero-content max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-[#f8f3e5] sm:text-6xl lg:text-[5rem] xl:text-[5.5rem]">
          Trade the news{" "}
          <span className="gold-shimmer-text">faster.</span>
        </h1>

        {/* Sub */}
        <p className="hero-content mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-[1.05rem]">
          A professional crypto terminal built for traders who move from
          headline to chart to execution — with zero noise and maximum structure.
        </p>

        {/* CTA row */}
        <div className="hero-content mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/terminal"
            className="hero-cta inline-flex items-center gap-2 rounded-xl bg-[rgba(212,161,31,0.92)] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0c0a04] shadow-[0_0_24px_rgba(212,161,31,0.4)] transition-all hover:bg-[rgba(212,161,31,1)] hover:shadow-[0_0_36px_rgba(212,161,31,0.62)]"
          >
            Open Terminal
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <a
            href="https://t.me/traderbross"
            target="_blank"
            rel="noreferrer"
            className="hero-btn-secondary inline-flex items-center gap-2 rounded-xl border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200 transition-all hover:border-[rgba(212,161,31,0.32)] hover:bg-[rgba(212,161,31,0.12)]"
          >
            Join Community
            <Send className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Live prices */}
        <div className="hero-content mt-8">
          <Suspense
            fallback={
              <div className="flex gap-2">
                {["BTC", "ETH", "SOL"].map((s) => (
                  <div key={s} className="skeleton-shimmer h-8 w-20 rounded-xl" />
                ))}
              </div>
            }
          >
            <LivePricesBadge />
          </Suspense>
        </div>

        {/* Stats bar */}
        <div className="hero-content mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-xl font-bold text-[#f0d7a7] sm:text-2xl">{s.value}</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="hero-content absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
          <div className="h-7 w-px bg-gradient-to-b from-transparent via-amber-400 to-transparent" />
          <ChevronRight className="h-3 w-3 rotate-90 text-amber-400" />
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-12">
        <div className="mb-12 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Everything you need</div>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5] sm:text-4xl">
            Built for reaction trading
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-500">
            Every feature is designed around the news-to-trade workflow. No clutter, no bloat.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((f) => {
            const Icon = f.icon;
            return (
              <article
                key={f.title}
                className="landing-feature-card group rounded-2xl border border-[rgba(212,161,31,0.1)] bg-[rgba(255,255,255,0.025)] p-5 transition-all hover:border-[rgba(212,161,31,0.22)] hover:bg-[rgba(255,255,255,0.04)]"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl border p-2.5 ${iconBgMap[f.color]}`}
                >
                  <Icon className={`h-4 w-4 ${iconColorMap[f.color]}`} />
                </div>
                <h3 className="text-[0.95rem] font-semibold text-[#f0e8d3]">{f.title}</h3>
                <p className="mt-2 text-[0.82rem] leading-[1.7] text-zinc-500">{f.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Terminal preview ─────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-amber-400">Terminal preview</div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5] sm:text-4xl">
              A premium workspace for<br className="hidden sm:block" /> reaction traders
            </h2>
          </div>
          <Link
            href="/terminal"
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.07)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 transition-all hover:border-[rgba(212,161,31,0.38)] md:self-auto self-start"
          >
            Enter terminal
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Preview shell */}
        <div className="landing-preview rounded-[28px] border border-[rgba(212,161,31,0.15)] bg-[rgba(255,255,255,0.02)] p-3 shadow-[0_0_60px_rgba(212,161,31,0.06)] sm:p-4">
          <div className="landing-preview-shell rounded-[20px] border border-[rgba(212,161,31,0.1)] bg-[linear-gradient(180deg,rgba(14,12,9,0.98),rgba(5,5,7,1))] p-3">
            {/* Terminal topbar */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[rgba(212,161,31,0.1)] bg-black/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-400/60" />
                <span className="text-[10px] uppercase tracking-[0.26em] text-amber-300/80">TraderBross Terminal</span>
              </div>
              <div className="rounded-full border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-300">
                Live
              </div>
            </div>

            {/* 3-panel layout */}
            <div className="grid gap-3 xl:grid-cols-[0.28fr_0.5fr_0.22fr]">
              {/* News panel */}
              <div className="rounded-2xl border border-[rgba(212,161,31,0.08)] bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-amber-300">News feed</span>
                  <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { tag: "BTC", sentiment: "bullish" },
                    { tag: "ETH", sentiment: "neutral" },
                    { tag: "SOL", sentiment: "bullish" },
                    { tag: "BTC", sentiment: "bearish" },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl border border-[rgba(212,161,31,0.07)] bg-black/30 p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="rounded-full border border-[rgba(212,161,31,0.24)] bg-[rgba(212,161,31,0.1)] px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                          {item.tag}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                            item.sentiment === "bullish"
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : item.sentiment === "bearish"
                              ? "border border-red-500/20 bg-red-500/10 text-red-400"
                              : "border border-zinc-600/30 bg-zinc-600/10 text-zinc-400"
                          }`}
                        >
                          {item.sentiment}
                        </span>
                      </div>
                      <div className="h-2 w-[88%] rounded-full bg-white/[0.07]" />
                      <div className="mt-1.5 h-2 w-[70%] rounded-full bg-white/[0.05]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart panel */}
              <div className="hidden rounded-2xl border border-[rgba(212,161,31,0.08)] bg-black/20 p-3 xl:block">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Chart workspace</span>
                  <span className="rounded-full border border-[rgba(212,161,31,0.14)] px-2 py-0.5 text-[9px] text-zinc-300">
                    BTCUSDT · 5m
                  </span>
                </div>
                <div className="relative h-[280px] overflow-hidden rounded-[18px] border border-[rgba(212,161,31,0.06)] bg-[#040406]">
                  {/* Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
                  {/* TP line */}
                  <div className="absolute left-0 right-0 top-8 mx-4">
                    <div className="h-px border-t border-dashed border-emerald-400/50" />
                    <span className="absolute right-0 top-0 -translate-y-1/2 rounded-l bg-emerald-400/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">
                      TP $68,400
                    </span>
                  </div>
                  {/* SL line */}
                  <div className="absolute left-0 right-0 top-[120px] mx-4">
                    <div className="h-px border-t border-dashed border-red-400/50" />
                    <span className="absolute right-0 top-0 -translate-y-1/2 rounded-l bg-red-400/15 px-1.5 py-0.5 text-[8px] font-bold text-red-400">
                      SL $63,200
                    </span>
                  </div>
                  {/* Price glow area */}
                  <div className="absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(212,161,31,0.07))]" />
                  {/* Candle chart mock */}
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-4 top-14 h-[170px] w-[calc(100%-2rem)]">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(240,215,167,0.6)" />
                        <stop offset="100%" stopColor="rgba(240,215,167,0)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,28 L8,26 L15,27 L22,22 L30,24 L38,18 L46,20 L54,14 L62,16 L70,10 L78,15 L86,12 L94,6 L100,9 L100,40 L0,40 Z"
                      fill="url(#chartGrad)"
                      opacity="0.4"
                    />
                    <polyline
                      fill="none"
                      stroke="rgba(240,215,167,0.9)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="0,28 8,26 15,27 22,22 30,24 38,18 46,20 54,14 62,16 70,10 78,15 86,12 94,6 100,9"
                    />
                  </svg>
                </div>
              </div>

              {/* Execution panel */}
              <div className="rounded-2xl border border-[rgba(212,161,31,0.08)] bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Execution</span>
                  <span className="flex items-center gap-1 text-[9px] text-zinc-500">Ready</span>
                </div>
                <div className="space-y-2.5">
                  {/* Order type */}
                  <div className="rounded-xl border border-[rgba(212,161,31,0.08)] bg-black/25 p-2.5">
                    <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-zinc-600">Order mode</div>
                    <div className="grid grid-cols-3 gap-1">
                      {["Market", "Limit", "Stop"].map((t, i) => (
                        <div
                          key={t}
                          className={`rounded-lg px-2 py-1.5 text-center text-[9px] font-bold ${
                            i === 0
                              ? "bg-[rgba(212,161,31,0.18)] text-amber-200"
                              : "bg-white/[0.03] text-zinc-600"
                          }`}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Inputs */}
                  <div className="rounded-xl border border-[rgba(212,161,31,0.08)] bg-black/25 p-2.5">
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-zinc-600">Size / Price</div>
                    <div className="h-8 rounded-lg border border-[rgba(212,161,31,0.1)] bg-white/[0.03]" />
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <div className="flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,#157a5d,#0e5f48)] py-2.5 text-[9px] font-bold text-white">
                        BUY LONG
                      </div>
                      <div className="flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,#942e2e,#6e2020)] py-2.5 text-[9px] font-bold text-white">
                        SELL SHORT
                      </div>
                    </div>
                  </div>
                  {/* TP/SL */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-2">
                      <div className="text-[8px] uppercase tracking-wider text-emerald-600">Take Profit</div>
                      <div className="mt-1 text-[10px] font-bold text-emerald-400">$68,400</div>
                    </div>
                    <div className="rounded-xl border border-red-500/15 bg-red-500/5 px-2.5 py-2">
                      <div className="text-[8px] uppercase tracking-wider text-red-600">Stop Loss</div>
                      <div className="mt-1 text-[10px] font-bold text-red-400">$63,200</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI chat showcase ─────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl border border-[rgba(212,161,31,0.12)] bg-[rgba(255,255,255,0.02)]">
          <div className="grid lg:grid-cols-2">
            {/* Left — copy */}
            <div className="flex flex-col justify-center p-8 lg:p-12">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.08)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-300">
                <Brain className="h-3 w-3" />
                AI Trading Assistant
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5] sm:text-4xl">
                Instant analysis,<br />zero hesitation.
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-500">
                Ask TraderBross AI about any headline, market condition, or strategy. Get directional
                bias, key levels, risk factors, and execution context — all in seconds.
              </p>
              <Link
                href="/terminal"
                className="mt-6 inline-flex items-center gap-2 self-start rounded-xl bg-[rgba(212,161,31,0.88)] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0c0a04] shadow-[0_0_20px_rgba(212,161,31,0.35)] transition-all hover:bg-[rgba(212,161,31,1)]"
              >
                Try it now
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Right — chat mock */}
            <div className="border-t border-[rgba(212,161,31,0.08)] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="flex h-full flex-col gap-3">
                {/* Header */}
                <div className="flex items-center justify-between rounded-xl border border-[rgba(212,161,31,0.1)] bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(212,161,31,0.2)]">
                      <Brain className="h-3 w-3 text-amber-300" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-amber-300">TraderBross AI</span>
                  </div>
                  <span className="text-[9px] text-zinc-600">Claude Haiku · Active</span>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-2.5">
                  <div className="self-end rounded-xl rounded-br-sm border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.08)] px-3 py-2 text-[12px] text-zinc-200 max-w-[82%]">
                    BTC just broke $65k on ETF news. What&apos;s your read?
                  </div>
                  <div className="self-start rounded-xl rounded-bl-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-[12px] leading-[1.7] text-zinc-300 max-w-[90%]">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-400">Analysis</div>
                    <strong className="text-emerald-400">Bullish breakout.</strong> ETF flow is the key catalyst here.
                    Watch <strong className="text-[#f0d7a7]">$66,400</strong> as immediate resistance (Aug high).
                    If that clears, next target is <strong className="text-[#f0d7a7]">$68,800</strong>.
                    Risk: rejection at $65,500 flips the structure bearish. Size accordingly.
                  </div>
                  <div className="self-end rounded-xl rounded-br-sm border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.08)] px-3 py-2 text-[12px] text-zinc-200 max-w-[72%]">
                    What about funding rates?
                  </div>
                  <div className="self-start rounded-xl rounded-bl-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-[12px] leading-[1.7] text-zinc-300 max-w-[90%]">
                    Funding is elevated at <strong className="text-amber-300">0.04%</strong> — crowded longs.
                    Watch for a brief flush to clear weak hands before continuation. Good spot for a
                    scaled entry on the dip rather than chasing.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA section ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-[rgba(212,161,31,0.2)] bg-[linear-gradient(135deg,rgba(212,161,31,0.07),rgba(212,161,31,0.03))] px-8 py-12 text-center shadow-[0_0_60px_rgba(212,161,31,0.08)] sm:py-16">
          {/* Orb behind CTA */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,161,31,0.1),transparent_60%)]" />

          <div className="relative">
            <div className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Get started — it&apos;s free</div>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-[#f8f3e5] sm:text-5xl">
              Ready to trade smarter?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-zinc-500">
              Join traders already using TraderBross to move from information to execution
              faster than the market.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="inline-flex items-center gap-2 rounded-xl bg-[rgba(212,161,31,0.92)] px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0c0a04] shadow-[0_0_28px_rgba(212,161,31,0.45)] transition-all hover:bg-[rgba(212,161,31,1)] hover:shadow-[0_0_44px_rgba(212,161,31,0.65)]"
              >
                Open Terminal — Free
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="https://t.me/traderbross"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(212,161,31,0.2)] bg-transparent px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200 transition-all hover:border-[rgba(212,161,31,0.38)]"
              >
                Join Telegram
                <Send className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {[
                { icon: Shield, label: "No signup required" },
                { icon: TrendingUp, label: "Free forever" },
                { icon: Zap, label: "Instant access" },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                    <Icon className="h-3.5 w-3.5 text-amber-500/60" />
                    {b.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[rgba(212,161,31,0.08)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-auto w-[110px]" />
            <span className="hidden text-[12px] text-zinc-600 sm:inline">
              Trade the news faster.
            </span>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                  className="text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <p className="text-[11px] text-zinc-700">
            © {new Date().getFullYear()} TraderBross
          </p>
        </div>
      </footer>
    </main>
  );
}
