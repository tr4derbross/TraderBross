"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap,
  Newspaper,
  BarChart2,
  Shield,
  Globe,
  TrendingUp,
  Send,
  ArrowRight,
  ChevronRight,
  Plug,
  Eye,
  MousePointerClick,
  Check,
} from "lucide-react";
import PageWrapper from "@/components/PageWrapper";
import { useI18n } from "@/components/i18n/LanguageProvider";
import TerminalMockup from "@/components/landing/TerminalMockup";

/* ─── Animation variants ─────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25 } },
};
const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

/* ─── Data ─────────────────────────────────────────────────────────────────────── */

const STATS = [
  { value: "4",    label: "Exchanges" },
  { value: "News+Signals", label: "Decision Flow" },
  { value: "Live", label: "Market Feed" },
  { value: "Free", label: "Access" },
];

const FEATURES = [
  {
    icon: Newspaper,
    title: "Breaking News, Ranked Fast",
    desc: "See market-moving headlines in real time, ranked by relevance so you can react before momentum fades.",
  },
  {
    icon: Zap,
    title: "Execution Across 4 Venues",
    desc: "Trade Hyperliquid, Binance, OKX, and Bybit from one terminal with the same workflow.",
  },
  {
    icon: TrendingUp,
    title: "Signal Context in Seconds",
    desc: "Turn raw headlines into clear market context, key risks, and actionable trade direction.",
  },
  {
    icon: BarChart2,
    title: "Screener Built for Entries",
    desc: "Scan liquid pairs with RSI, open interest, long/short pressure, and volume to find setups faster.",
  },
  {
    icon: Shield,
    title: "Risk Controls at Order Time",
    desc: "Set TP/SL, see risk-reward instantly, and keep liquidation visibility before you confirm the trade.",
  },
  {
    icon: Globe,
    title: "Market Intelligence in One View",
    desc: "Track whales, sentiment, macro metrics, and flow signals without switching between tools.",
  },
];

const DEMO_MESSAGES = [
  {
    role: "user",
    text: "Is the BTC setup still valid? News just dropped.",
  },
  {
    role: "terminal",
    text: "BTC is holding the $67,800 support despite the Grayscale news. RSI(4H) at 43 — not yet oversold but approaching. OI dropped 8% suggesting deleveraging. Setup remains valid with tight SL below $67,200. Watch for a reclaim above $68,500 to confirm bull continuation.",
  },
  {
    role: "user",
    text: "What about ETH funding rates?",
  },
  {
    role: "terminal",
    text: "ETH funding is +0.012% — slightly elevated but not extreme. Longs are paying, which typically signals mild bullish bias. If BTC breaks $67,200, expect ETH to test $3,480 support. The Dencun upgrade narrative should provide underlying support on dips.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Plug,
    title: "Connect Your Exchange",
    desc: "Link Binance, OKX, Bybit, or Hyperliquid in seconds. Your API keys are encrypted and stored in a secure vault — never exposed.",
  },
  {
    step: "02",
    icon: Eye,
    title: "Monitor Everything in One View",
    desc: "Real-time news ranked by impact, whale movements, liquidation data, and market screener — all streaming live in one terminal.",
  },
  {
    step: "03",
    icon: MousePointerClick,
    title: "Execute With Full Context",
    desc: "Click a news item, see the signal analysis, set your TP/SL, and send the order — without leaving the terminal.",
  },
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever free",
    desc: "News feed, paper trading, and live ticker. No credit card required.",
    highlight: false,
    features: [
      "Real-time news feed",
      "Exchange announcements",
      "5-exchange live price ticker",
      "Paper trading (unlimited simulations)",
      "Funding rate tracker",
    ],
    cta: "Start Free — No credit card",
    ctaHref: "/sign-in",
  },
  {
    name: "DEX",
    price: "$20",
    period: "per month",
    desc: "Everything in Free + Hyperliquid and Aster DEX execution.",
    highlight: true,
    features: [
      "Everything in Free",
      "Hyperliquid perpetuals trading",
      "Aster DEX trading",
      "DEX wallet connect (MetaMask / WalletConnect)",
      "Real order execution on DEX",
      "No KYC required",
    ],
    cta: "Get DEX Plan — $20/mo",
    ctaHref: "/checkout?plan=dex",
  },
  {
    name: "Full",
    price: "$50",
    period: "per month",
    desc: "Everything in DEX + CEX API integrations and advanced tools.",
    highlight: false,
    features: [
      "Everything in DEX",
      "Binance API integration",
      "Bybit API integration",
      "OKX API integration",
      "Advanced screener",
      "Full funding rate arbitrage tools",
    ],
    cta: "Get Full Plan — $50/mo",
    ctaHref: "/checkout?plan=full",
  },
];

const EXCHANGE_LOGOS = [
  { name: "Binance", color: "#F0B90B" },
  { name: "OKX", color: "#FFFFFF" },
  { name: "Bybit", color: "#F7A600" },
  { name: "Hyperliquid", color: "#4ADE80" },
];

/* ─── Page ─────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { dict } = useI18n();

  return (
    <PageWrapper>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-start overflow-hidden px-4 pt-28 pb-10 text-center"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(242,183,5,0.08), #0B0B0B)",
        }}
      >
        {/* Background watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden">
          <img
            src="/Brand/logo.png"
            alt=""
            aria-hidden="true"
            style={{ opacity: 0.04, width: "60%", maxWidth: 700, objectFit: "contain" }}
          />
        </div>

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-scan" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-5"
        >
          <motion.p
            variants={fadeUp}
            className="font-mono text-[10px] tracking-[0.2em] text-[#F2B705] uppercase"
          >
            {dict.landing.badge}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-4xl font-bold leading-tight tracking-tight text-[#FFFFFF] sm:text-5xl md:text-6xl"
          >
            {dict.landing.heroLine1}<br />{dict.landing.heroLine2}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-lg text-base text-[#A0A0A0] sm:text-lg"
          >
            {dict.landing.heroDesc}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/terminal"
              className="flex items-center gap-2 rounded-lg bg-[#F2B705] px-6 py-3 text-[13px] font-semibold text-[#0B0B0B] transition-opacity hover:opacity-90"
            >
              {dict.landing.openTerminal} <ArrowRight size={15} />
            </Link>
            <a
              href="https://t.me/+gmvsMPoWofA2ZjY0"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[rgba(242,183,5,0.2)] px-6 py-3 text-[13px] font-medium text-[#A0A0A0] transition-colors hover:border-[rgba(242,183,5,0.4)] hover:text-[#FFFFFF]"
            >
              <Send size={14} /> {dict.landing.getAlerts}
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            className="mt-2 flex flex-wrap items-center justify-center gap-8"
          >
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="font-mono text-xl font-bold text-[#FFFFFF]">
                  {value}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-[#6B6B6B]">
                  {label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Exchange logos */}
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2 flex-wrap justify-center"
          >
            <span className="text-[10px] text-[#6B6B6B] mr-1">Supported exchanges:</span>
            {EXCHANGE_LOGOS.map(({ name, color }) => (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: `${color}30`,
                  color,
                  background: `${color}0A`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: color }}
                />
                {name}
              </span>
            ))}
          </motion.div>

          {/* Terminal Mockup */}
          <motion.div variants={fadeUp} className="w-full">
            <TerminalMockup />
          </motion.div>
        </motion.div>

        {/* Fade to base at bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2B705]">
            {dict.landing.featuresTitle}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
            {dict.landing.featuresHeading}
          </h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group rounded-xl border border-[#2A2A2A] bg-[#121212] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(242,183,5,0.25)]"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(242,183,5,0.1)]">
                <Icon size={18} className="text-[#F2B705]" />
              </div>
              <h3 className="mb-1.5 text-[14px] font-semibold text-[#FFFFFF]">
                {title}
              </h3>
              <p className="text-[12px] leading-relaxed text-[#A0A0A0]">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="border-y border-[#1A1A1A] py-20" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(242,183,5,0.04), #0B0B0B)" }}>
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2B705]">
              How It Works
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
              From News to Trade in 3 Steps
            </h2>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(242,183,5,0.3), rgba(242,183,5,0.3), transparent)" }} />

            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step circle */}
                <div
                  className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(242,183,5,0.08)",
                    border: "1px solid rgba(242,183,5,0.25)",
                  }}
                >
                  <Icon size={22} className="text-[#F2B705]" />
                  <span
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-[#0B0B0B]"
                    style={{ background: "#F2B705" }}
                  >
                    {step}
                  </span>
                </div>
                <h3 className="mb-2 text-[15px] font-semibold text-[#FFFFFF]">{title}</h3>
                <p className="text-[12px] leading-relaxed text-[#6B6B6B]">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terminal Demo ───────────────────────────────────────────────────────── */}
      <section className="border-b border-[#2A2A2A] bg-[#0B0B0B] py-20">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            viewport={{ once: true }}
            className="mb-6 text-center"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2B705]">
              Terminal Brief
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF]">
              Fast Analysis You Can Trade On
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#6B6B6B]">
              Sample output — not live data
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            viewport={{ once: true }}
            className="space-y-3 rounded-xl border border-[#2A2A2A] bg-[#121212] p-4"
          >
            {DEMO_MESSAGES.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "border border-[rgba(242,183,5,0.25)] bg-[rgba(242,183,5,0.08)] text-[#F2B705]"
                      : "border border-[#2A2A2A] bg-[#1A1A1A] text-[#A0A0A0]"
                  }`}
                >
                  {msg.role === "terminal" && (
                    <span className="mb-1 block font-mono text-[8px] uppercase tracking-widest text-[#6B6B6B]">
                      TERMINAL
                    </span>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-5 text-center"
          >
            <Link
              href="/terminal"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#F2B705] hover:underline"
            >
              Open Terminal and Test It Live <ChevronRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2B705]">
              Pricing
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
              Start Free. Upgrade When You Need More.
            </h2>
            <p className="mt-2 text-[13px] text-[#6B6B6B]">
              No credit card required to start. Cancel anytime.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {PRICING_PLANS.map(({ name, price, period, desc, highlight, features, cta, ctaHref }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                viewport={{ once: true }}
                className="relative flex flex-col rounded-xl p-6"
                style={{
                  background: highlight ? "rgba(242,183,5,0.06)" : "#111",
                  border: highlight
                    ? "1px solid rgba(242,183,5,0.35)"
                    : "1px solid #2A2A2A",
                }}
              >
                {highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold text-[#0B0B0B]"
                    style={{ background: "#F2B705" }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-[13px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
                    {name}
                  </h3>
                  <div className="mt-1 flex items-end gap-1">
                    <span className="text-3xl font-bold text-[#FFFFFF]">{price}</span>
                    <span className="mb-1 text-[11px] text-[#6B6B6B]">/{period}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6B6B6B]">{desc}</p>
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-[#A0A0A0]">
                      <Check size={13} className="mt-0.5 shrink-0 text-[#F2B705]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className={`block w-full rounded-lg py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90 ${
                    highlight
                      ? "bg-[#F2B705] text-[#0B0B0B]"
                      : "border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#F2B705] hover:text-[#F2B705]"
                  }`}
                >
                  {cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          viewport={{ once: true }}
          className="mx-auto max-w-lg px-4"
        >
          <h2 className="text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
            {dict.landing.ctaHeading}
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {["Live market feed", "Signal trade context", "4 exchanges"].map(
              (pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-[#2A2A2A] px-3 py-1 text-[11px] text-[#6B6B6B]"
                >
                  {pill}
                </span>
              )
            )}
          </div>
          <Link
            href="/terminal"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#F2B705] px-8 py-3.5 text-[13px] font-semibold text-[#0B0B0B] transition-opacity hover:opacity-90"
          >
            {dict.landing.ctaButton} <ArrowRight size={15} />
          </Link>
        </motion.div>
      </section>
    </PageWrapper>
  );
}

