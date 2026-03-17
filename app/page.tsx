"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap,
  Newspaper,
  Bot,
  BarChart2,
  Shield,
  Globe,
  TrendingUp,
  Send,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import PageWrapper from "@/components/PageWrapper";

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
  { value: "AI",   label: "Powered" },
  { value: "Low",  label: "Latency" },
  { value: "Free", label: "Always" },
];

const FEATURES = [
  {
    icon: Newspaper,
    title: "News-First Workflow",
    desc: "Real-time crypto news from 15+ sources, filtered by sentiment and relevance. Trade the news before the crowd.",
  },
  {
    icon: Zap,
    title: "Multi-Exchange Trading",
    desc: "Trade on Hyperliquid, Binance, OKX, and Bybit from a single interface with unified position management.",
  },
  {
    icon: Bot,
    title: "AI Market Analysis",
    desc: "Groq-powered AI assistant analyzes headlines, summarizes market conditions, and suggests trade setups in real time.",
  },
  {
    icon: BarChart2,
    title: "Advanced Screener",
    desc: "Screen 100+ pairs with RSI-14, Open Interest, Long/Short ratio, and 24h volume — all computed live.",
  },
  {
    icon: Shield,
    title: "Risk Management",
    desc: "TP/SL inputs sync to chart lines. R/R ratio calculated automatically. Liquidation price always visible.",
  },
  {
    icon: Globe,
    title: "On-Chain Intelligence",
    desc: "Whale alerts, DeFi TVL, mempool stats, Fear & Greed index, and halving countdown in the stats bar.",
  },
];

const DEMO_MESSAGES = [
  {
    role: "user",
    text: "Is the BTC setup still valid? News just dropped.",
  },
  {
    role: "ai",
    text: "BTC is holding the $67,800 support despite the Grayscale news. RSI(4H) at 43 — not yet oversold but approaching. OI dropped 8% suggesting deleveraging. Setup remains valid with tight SL below $67,200. Watch for a reclaim above $68,500 to confirm bull continuation.",
  },
  {
    role: "user",
    text: "What about ETH funding rates?",
  },
  {
    role: "ai",
    text: "ETH funding is +0.012% — slightly elevated but not extreme. Longs are paying, which typically signals mild bullish bias. If BTC breaks $67,200, expect ETH to test $3,480 support. The Dencun upgrade narrative should provide underlying support on dips.",
  },
];

/* ─── Page ─────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <PageWrapper>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
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
          className="relative z-10 flex max-w-3xl flex-col items-center gap-5"
        >
          <motion.p
            variants={fadeUp}
            className="font-mono text-[10px] tracking-[0.2em] text-[#F2B705] uppercase"
          >
            News-First Trading Workflow
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-4xl font-bold leading-tight tracking-tight text-[#FFFFFF] sm:text-5xl md:text-6xl"
          >
            Trade the news<br />faster.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-lg text-base text-[#A0A0A0] sm:text-lg"
          >
            A professional crypto terminal that surfaces breaking news before the
            price moves — with AI analysis and one-click trading.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/terminal"
              className="flex items-center gap-2 rounded-lg bg-[#F2B705] px-6 py-3 text-[13px] font-semibold text-[#0B0B0B] transition-opacity hover:opacity-90"
            >
              Open Terminal <ArrowRight size={15} />
            </Link>
            <a
              href="https://t.me/traderbross"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[rgba(242,183,5,0.2)] px-6 py-3 text-[13px] font-medium text-[#A0A0A0] transition-colors hover:border-[rgba(242,183,5,0.4)] hover:text-[#FFFFFF]"
            >
              <Send size={14} /> Join Telegram
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            className="mt-4 flex flex-wrap items-center justify-center gap-8"
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
            Features
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
            Everything you need to trade smarter
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

      {/* ── AI Demo ───────────────────────────────────────────────────────── */}
      <section className="border-y border-[#2A2A2A] bg-[#0B0B0B] py-20">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            viewport={{ once: true }}
            className="mb-6 text-center"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F2B705]">
              AI Assistant
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#FFFFFF]">
              Market analysis, on demand
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#6B6B6B]">
              ★ Example conversation — not live data
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
                  {msg.role === "ai" && (
                    <span className="mb-1 block font-mono text-[8px] uppercase tracking-widest text-[#6B6B6B]">
                      AI ·
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
              Try it live in the terminal <ChevronRight size={14} />
            </Link>
          </motion.div>
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
            Start trading smarter today
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {["Free forever", "No sign-up required", "4 exchanges"].map(
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
            Open Terminal — Free <ArrowRight size={15} />
          </Link>
        </motion.div>
      </section>
    </PageWrapper>
  );
}
