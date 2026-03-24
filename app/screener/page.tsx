"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import { apiFetch } from "@/lib/api-client";
import type { ScreenerCoin } from "@/types/screener";
import { TierGate } from "@/components/TierGate";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Search,
  RefreshCw,
  ExternalLink,
  LayoutDashboard,
  Zap,
  Activity,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/components/i18n/LanguageProvider";

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPrice(p: number): string {
  if (p >= 10_000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1)      return `$${p.toFixed(2)}`;
  if (p >= 0.01)   return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function fmtOI(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

const SORT_TABS = [
  { key: "volume", icon: BarChart2 },
  { key: "gainers", icon: TrendingUp },
  { key: "losers", icon: TrendingDown },
] as const;

function getReferralUrl(symbol: string): string {
  const ref = process.env.NEXT_PUBLIC_BINANCE_REF;
  return ref
    ? `https://www.binance.com/en/trade/${symbol}_USDT?ref=${ref}`
    : `https://www.binance.com/en/trade/${symbol}_USDT`;
}

/* â”€â”€ RSI Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function RsiBadge({ rsi }: { rsi: number | null | undefined }) {
  if (rsi == null)
    return <span className="text-[10px] text-[#3A3A3A]">â€”</span>;

  const isOversold   = rsi < 30;
  const isOverbought = rsi > 70;

  const cls = isOversold
    ? "bg-[#4CAF50]/15 text-[#4CAF50] border-[#4CAF50]/25"
    : isOverbought
    ? "bg-[#FF4D4D]/15 text-[#FF4D4D] border-[#FF4D4D]/25"
    : "bg-[rgba(242,183,5,0.06)] text-[#A0A0A0] border-[rgba(242,183,5,0.12)]";

  const label = isOversold ? "OS" : isOverbought ? "OB" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${cls}`}
      title={`RSI-14 (4h): ${rsi}${isOversold ? " â€” Oversold" : isOverbought ? " â€” Overbought" : ""}`}
    >
      {rsi.toFixed(1)}
      {label && <span className="text-[8px] opacity-70">{label}</span>}
    </span>
  );
}

/* â”€â”€ L/S Ratio Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function LSBadge({ ratio }: { ratio: number | null | undefined }) {
  if (ratio == null)
    return <span className="text-[10px] text-[#3A3A3A]">â€”</span>;
  const bullish = ratio >= 1;
  return (
    <span
      className={`text-[10px] font-bold tabular-nums ${bullish ? "text-[#4CAF50]" : "text-[#FF4D4D]"}`}
      title={`Global Long/Short Account Ratio (1h): ${ratio} â€” ${bullish ? "More longs than shorts" : "More shorts than longs"}`}
    >
      {ratio.toFixed(2)}
    </span>
  );
}

/* â”€â”€ Mini sparkline bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MiniRange({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high > low ? ((price - low) / (high - low)) * 100 : 50;
  return (
    <div className="relative h-1 w-16 rounded-full bg-[rgba(242,183,5,0.08)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FF4D4D]/60 to-[#4CAF50]/60"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <div
        className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full bg-white/60"
        style={{ left: `${Math.min(98, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* â”€â”€ Stat card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function StatCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "bull" | "bear" | "accent";
}) {
  const colors: Record<string, string> = {
    default: "border-[rgba(242,183,5,0.12)] bg-[rgba(242,183,5,0.04)] text-[#F2B705]",
    bull:    "border-[#4CAF50]/15 bg-[#4CAF50]/5 text-[#4CAF50]",
    bear:    "border-[#FF4D4D]/15 bg-[#FF4D4D]/5 text-[#FF4D4D]",
    accent:  "border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] text-[#F2B705]",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colors[variant]}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] opacity-60">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-bold">{value}</div>
      {sub && <div className="text-[10px] opacity-50">{sub}</div>}
    </div>
  );
}

/* â”€â”€ Desktop table row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CoinRow({
  coin,
  rank,
  labels,
}: {
  coin: ScreenerCoin;
  rank: number;
  labels: { terminal: string; trade: string };
}) {
  const positive = coin.change24h >= 0;
  return (
    <tr className="group border-b border-[rgba(242,183,5,0.05)] transition-colors hover:bg-[rgba(242,183,5,0.03)]">
      <td className="py-2.5 pl-4 pr-2 text-[11px] text-[#3A3A3A] tabular-nums">{rank}</td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(242,183,5,0.1)] text-[10px] font-bold text-[#F2B705]">
            {coin.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#FFFFFF]">{coin.symbol}</div>
            <div className="text-[10px] text-[#3A3A3A]">/USDT</div>
          </div>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        <span className="text-[12px] font-medium text-[#FFFFFF]">
          {fmtPrice(coin.price)}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            positive
              ? "bg-[#4CAF50]/10 text-[#4CAF50]"
              : "bg-[#FF4D4D]/10 text-[#FF4D4D]"
          }`}
        >
          {positive ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {positive ? "+" : ""}
          {coin.change24h.toFixed(2)}%
        </span>
      </td>
      <td className="hidden py-2.5 pr-4 text-right lg:table-cell">
        <RsiBadge rsi={coin.rsi14} />
      </td>
      <td className="hidden py-2.5 pr-4 text-right tabular-nums xl:table-cell">
        {coin.openInterestUsd != null ? (
          <span
            className="text-[11px] text-[#A0A0A0]"
            title={`Open Interest: $${coin.openInterestUsd.toLocaleString()}`}
          >
            ${fmtOI(coin.openInterestUsd)}
          </span>
        ) : (
          <span className="text-[10px] text-[#3A3A3A]">â€”</span>
        )}
      </td>
      <td className="hidden py-2.5 pr-4 text-right xl:table-cell">
        <LSBadge ratio={coin.longShortRatio} />
      </td>
      <td className="hidden py-2.5 pr-4 text-right tabular-nums sm:table-cell">
        <span className="text-[11px] text-[#A0A0A0]">${fmtVol(coin.volume24h)}</span>
      </td>
      <td className="hidden py-2.5 pr-4 md:table-cell">
        <MiniRange low={coin.low24h} high={coin.high24h} price={coin.price} />
        <div className="mt-0.5 flex justify-between text-[9px] text-[#3A3A3A]">
          <span>{fmtPrice(coin.low24h)}</span>
          <span>{fmtPrice(coin.high24h)}</span>
        </div>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/terminal?ticker=${coin.symbol}`}
            className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
          >
            <LayoutDashboard className="h-2.5 w-2.5" />
            {labels.terminal}
          </Link>
          <a
            href={getReferralUrl(coin.symbol)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.08)] bg-[rgba(242,183,5,0.03)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] transition hover:text-[#A0A0A0]"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {labels.trade}
          </a>
        </div>
      </td>
    </tr>
  );
}

/* â”€â”€ Mobile coin card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CoinCard({
  coin,
  rank,
  labels,
}: {
  coin: ScreenerCoin;
  rank: number;
  labels: { terminal: string; trade: string; volume: string };
}) {
  const positive = coin.change24h >= 0;
  return (
    <div className="rounded-xl border border-[rgba(242,183,5,0.1)] bg-[#121212] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(242,183,5,0.1)] text-[11px] font-bold text-[#F2B705]">
            {coin.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#FFFFFF]">{coin.symbol}</div>
            <div className="text-[10px] text-[#3A3A3A]">#{rank}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-mono font-bold text-[#FFFFFF]">
            {fmtPrice(coin.price)}
          </div>
          <div
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
              positive ? "text-[#4CAF50]" : "text-[#FF4D4D]"
            }`}
          >
            {positive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {positive ? "+" : ""}
            {coin.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6B6B]">RSI-14</div>
          <div className="mt-0.5">
            <RsiBadge rsi={coin.rsi14} />
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6B6B]">{labels.volume}</div>
          <div className="mt-0.5 text-[11px] font-mono text-[#A0A0A0]">
            ${fmtVol(coin.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6B6B]">L/S</div>
          <div className="mt-0.5">
            <LSBadge ratio={coin.longShortRatio} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/terminal?ticker=${coin.symbol}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] py-1.5 text-[10px] font-bold text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
        >
          <LayoutDashboard className="h-3 w-3" />
          {labels.terminal}
        </Link>
        <a
          href={getReferralUrl(coin.symbol)}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[rgba(242,183,5,0.08)] bg-[rgba(242,183,5,0.03)] py-1.5 text-[10px] font-bold text-[#6B6B6B] transition hover:text-[#A0A0A0]"
        >
          <ExternalLink className="h-3 w-3" />
          {labels.trade}
        </a>
      </div>
    </div>
  );
}

/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function ScreenerPage() {
  const { locale } = useI18n();
  const t =
    locale === "tr"
      ? {
          pageTitle: "Piyasa Tarayici",
          loading: "Yukleniyor",
          pairs: "parite",
          oversold: "asiri satim",
          overbought: "asiri alim",
          updated: "Guncellendi",
          refresh: "Yenile",
          vol24h: "24s Hacim",
          gainers: "Yukselenler",
          losers: "Dusenler",
          totalPairs: "Pariteler",
          top: "Top",
          minVol: ">$500K hacim",
          sortVolume: "Hacim",
          sortGainers: "Yukselen",
          sortLosers: "Dusen",
          searchPlaceholder: "Sembol filtrele...",
          loadError: "Piyasa verisi yuklenemedi.",
          retry: "Tekrar Dene",
          coin: "Coin",
          price: "Fiyat",
          range24h: "24s Aralik",
          action: "Aksiyon",
          noCoins: "Coin bulunamadi",
          showing: "Gosterilen",
          of: "/",
          source: "Binance Spot + Futures",
          rsiLow: "RSI <30 = Asiri satim",
          rsiHigh: "RSI >70 = Asiri alim",
          autoRefresh: "Oto yenileme 2dk",
          terminal: "Terminal",
          trade: "Islem",
          volume: "Hacim",
        }
      : locale === "de"
      ? {
          pageTitle: "Markt Screener",
          loading: "Ladt",
          pairs: "Paare",
          oversold: "uberverkauft",
          overbought: "uberkauft",
          updated: "Aktualisiert",
          refresh: "Aktualisieren",
          vol24h: "24h Volumen",
          gainers: "Gewinner",
          losers: "Verlierer",
          totalPairs: "Paare",
          top: "Top",
          minVol: ">$500K Vol",
          sortVolume: "Volumen",
          sortGainers: "Gewinner",
          sortLosers: "Verlierer",
          searchPlaceholder: "Symbol filtern...",
          loadError: "Marktdaten konnten nicht geladen werden.",
          retry: "Erneut versuchen",
          coin: "Coin",
          price: "Preis",
          range24h: "24h Range",
          action: "Aktion",
          noCoins: "Keine Coins gefunden",
          showing: "Zeige",
          of: "von",
          source: "Binance Spot + Futures",
          rsiLow: "RSI <30 = Uberverkauft",
          rsiHigh: "RSI >70 = Uberkauft",
          autoRefresh: "Auto-Refresh 2m",
          terminal: "Terminal",
          trade: "Handel",
          volume: "Volumen",
        }
      : locale === "zh"
      ? {
          pageTitle: "å¸‚åœºç­›é€‰å™¨",
          loading: "åŠ è½½ä¸­",
          pairs: "äº¤æ˜“å¯¹",
          oversold: "è¶…å–",
          overbought: "è¶…ä¹°",
          updated: "å·²æ›´æ–°",
          refresh: "åˆ·æ–°",
          vol24h: "24å°æ—¶æˆäº¤é‡",
          gainers: "æ¶¨å¹…æ¦œ",
          losers: "è·Œå¹…æ¦œ",
          totalPairs: "äº¤æ˜“å¯¹",
          top: "Top",
          minVol: ">$500K æˆäº¤é‡",
          sortVolume: "æˆäº¤é‡",
          sortGainers: "ä¸Šæ¶¨",
          sortLosers: "ä¸‹è·Œ",
          searchPlaceholder: "ç­›é€‰å¸ç§...",
          loadError: "æ— æ³•åŠ è½½å¸‚åœºæ•°æ®ã€‚",
          retry: "é‡è¯•",
          coin: "å¸ç§",
          price: "ä»·æ ¼",
          range24h: "24å°æ—¶åŒºé—´",
          action: "æ“ä½œ",
          noCoins: "æœªæ‰¾åˆ°å¸ç§",
          showing: "æ˜¾ç¤º",
          of: "/",
          source: "Binance ç°è´§ + åˆçº¦",
          rsiLow: "RSI <30 = è¶…å–",
          rsiHigh: "RSI >70 = è¶…ä¹°",
          autoRefresh: "è‡ªåŠ¨åˆ·æ–° 2åˆ†é’Ÿ",
          terminal: "ç»ˆç«¯",
          trade: "äº¤æ˜“",
          volume: "æˆäº¤é‡",
        }
      : {
          pageTitle: "Market Screener",
          loading: "Loading",
          pairs: "pairs",
          oversold: "oversold",
          overbought: "overbought",
          updated: "Updated",
          refresh: "Refresh",
          vol24h: "24h Volume",
          gainers: "Gainers",
          losers: "Losers",
          totalPairs: "Pairs",
          top: "Top",
          minVol: ">$500K vol",
          sortVolume: "Volume",
          sortGainers: "Gainers",
          sortLosers: "Losers",
          searchPlaceholder: "Filter symbol...",
          loadError: "Could not load market data.",
          retry: "Retry",
          coin: "Coin",
          price: "Price",
          range24h: "24h Range",
          action: "Action",
          noCoins: "No coins found",
          showing: "Showing",
          of: "of",
          source: "Binance Spot + Futures",
          rsiLow: "RSI <30 = Oversold",
          rsiHigh: "RSI >70 = Overbought",
          autoRefresh: "Auto-refresh 2m",
          terminal: "Terminal",
          trade: "Trade",
          volume: "Volume",
        };

  const [sort, setSort]       = useState<"volume" | "gainers" | "losers">("volume");
  const [search, setSearch]   = useState("");
  const [coins, setCoins]     = useState<ScreenerCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ScreenerCoin[]>(`/api/screener?sort=${sort}`);
      if (!Array.isArray(data) || data.length === 0)
        throw new Error("No data returned");
      setCoins(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[Screener] fetch failed:", err);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [sort, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 2 minutes for non-critical market ranking updates.
  useEffect(() => {
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = coins.filter(
    (c) =>
      search.length < 1 || c.symbol.toUpperCase().includes(search.toUpperCase())
  );

  const gainersCount  = coins.filter((c) => c.change24h > 0).length;
  const losersCount   = coins.filter((c) => c.change24h < 0).length;
  const topGainer     = coins.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h)[0];
  const topLoser      = coins.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h)[0];
  const totalVol      = coins.reduce((s, c) => s + c.volume24h, 0);
  const oversoldCount   = coins.filter((c) => c.rsi14 != null && c.rsi14 < 30).length;
  const overboughtCount = coins.filter((c) => c.rsi14 != null && c.rsi14 > 70).length;

  return (
    <PageWrapper>
      <TierGate
        requires="full"
        fallback={
          <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-8">
              <h2 className="text-xl font-bold text-amber-100">Full Plan Required</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Advanced screener access is available on the Full tier.
              </p>
              <Link
                href="/pricing"
                className="mt-5 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black"
              >
                Get Full Plan — $50/mo
              </Link>
            </div>
          </div>
        }
      >
      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Background watermark */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden">
          <img
            src="/Brand/logo.png"
            alt=""
            aria-hidden="true"
            style={{ opacity: 0.04, width: "50%", maxWidth: 600, objectFit: "contain" }}
          />
        </div>

        <div className="relative z-10">
          {/* Page header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <BarChart2 className="h-4 w-4 text-[#F2B705]" />
                <h1 className="text-[15px] font-bold tracking-[-0.01em] text-[#FFFFFF]">
                  {t.pageTitle}
                </h1>
                <span
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                    !loading
                      ? "border-[#4CAF50]/25 bg-[#4CAF50]/10 text-[#4CAF50]"
                      : "border-[rgba(242,183,5,0.15)] bg-[rgba(242,183,5,0.06)] text-[#6B6B6B]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      !loading && coins.length > 0
                        ? "animate-pulse bg-[#4CAF50]"
                        : "bg-[#6B6B6B]"
                    }`}
                  />
                  {loading ? t.loading : `${coins.length} ${t.pairs}`}
                </span>
                {!loading && oversoldCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-[#4CAF50]/20 bg-[#4CAF50]/8 px-2 py-0.5 text-[9px] font-bold text-[#4CAF50]">
                    <Activity className="h-2.5 w-2.5" />
                    {oversoldCount} {t.oversold}
                  </span>
                )}
                {!loading && overboughtCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-[#FF4D4D]/20 bg-[#FF4D4D]/8 px-2 py-0.5 text-[9px] font-bold text-[#FF4D4D]">
                    <Activity className="h-2.5 w-2.5" />
                    {overboughtCount} {t.overbought}
                  </span>
                )}
              </div>
              {lastUpdate && (
                <p className="text-[11px] text-[#6B6B6B]">
                  {t.updated} {lastUpdate.toLocaleTimeString()} · RSI-14 &amp; OI enriched for top 20 futures pairs
                </p>
              )}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 self-start rounded-full border border-[rgba(242,183,5,0.12)] bg-[rgba(242,183,5,0.04)] px-3 py-1.5 text-[10px] text-[#A0A0A0] transition hover:text-[#FFFFFF] disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              {t.refresh}
            </button>
          </div>

          {/* Stat cards */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : (
              <>
                <StatCard label={t.vol24h} value={fmt(totalVol)} variant="default" />
                <StatCard
                  label={t.gainers}
                  value={gainersCount.toString()}
                  sub={topGainer ? `${t.top}: ${topGainer.symbol} +${topGainer.change24h.toFixed(1)}%` : undefined}
                  variant="bull"
                />
                <StatCard
                  label={t.losers}
                  value={losersCount.toString()}
                  sub={topLoser ? `${t.top}: ${topLoser.symbol} ${topLoser.change24h.toFixed(1)}%` : undefined}
                  variant="bear"
                />
                <StatCard label={t.totalPairs} value={coins.length.toString()} sub={t.minVol} variant="accent" />
                <StatCard label={t.oversold} value={oversoldCount.toString()} sub="RSI-14 < 30" variant="bull" />
                <StatCard label={t.overbought} value={overboughtCount.toString()} sub="RSI-14 > 70" variant="bear" />
              </>
            )}
          </div>

          {/* Controls */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Sort tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.03)] p-1">
              {SORT_TABS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSort(key as typeof sort)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${
                    sort === key
                      ? "bg-[rgba(242,183,5,0.16)] text-[#F2B705] shadow-sm"
                      : "text-[#6B6B6B] hover:text-[#A0A0A0]"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {key === "volume" ? t.sortVolume : key === "gainers" ? t.sortGainers : t.sortLosers}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B6B6B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] py-1.5 pl-8 pr-3 text-[11px] text-[#A0A0A0] outline-none placeholder:text-[#6B6B6B] focus:border-[rgba(242,183,5,0.3)] sm:w-[180px] transition"
              />
            </div>
          </div>

          {/* Error state */}
          {error && !loading && (
            <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-[#FF4D4D]/20 bg-[#FF4D4D]/5 py-10">
              <AlertCircle className="h-6 w-6 text-[#FF4D4D]" />
              <p className="text-sm text-[#FF4D4D]">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-1.5 rounded-full border border-[#FF4D4D]/30 bg-[#FF4D4D]/10 px-4 py-1.5 text-[11px] font-bold text-[#FF4D4D] transition hover:bg-[#FF4D4D]/20"
              >
                <RefreshCw className="h-3 w-3" />
                {t.retry}
              </button>
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.02)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(242,183,5,0.08)] bg-[rgba(242,183,5,0.04)]">
                    <th className="py-2.5 pl-4 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">#</th>
                    <th className="py-2.5 pr-3 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">{t.coin}</th>
                    <th className="py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">{t.price}</th>
                    <th className="py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">24h %</th>
                    <th className="hidden py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] lg:table-cell" title="RSI-14 on 4h candles">RSI-14</th>
                    <th className="hidden py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] xl:table-cell" title="Open Interest in USD">OI (USD)</th>
                    <th className="hidden py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] xl:table-cell" title="Long/Short Account Ratio">L/S</th>
                    <th className="hidden py-2.5 pr-4 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] sm:table-cell">{t.volume}</th>
                    <th className="hidden py-2.5 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] md:table-cell">{t.range24h}</th>
                    <th className="py-2.5 pr-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">{t.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && coins.length === 0 ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-[rgba(242,183,5,0.04)]">
                        {[40, 80, 60, 50, 45, 55, 45, 70, 100, 60].map((w, j) => (
                          <td key={j} className="py-3 pl-4">
                            <Skeleton className="h-3 rounded" style={{ width: w }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#6B6B6B]">
                          <Search className="h-6 w-6 opacity-30" />
                          <p className="text-sm">{t.noCoins}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((coin, i) => (
                      <CoinRow key={coin.symbol} coin={coin} rank={i + 1} labels={{ terminal: t.terminal, trade: t.trade }} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-[rgba(242,183,5,0.06)] px-4 py-2">
                <span className="text-[10px] text-[#3A3A3A]">
                  {t.showing} {filtered.length} {t.of} {coins.length} {t.pairs} · {t.source}
                </span>
                <div className="flex items-center gap-3 text-[10px] text-[#3A3A3A]">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4CAF50]/50" />
                    {t.rsiLow}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF4D4D]/50" />
                    {t.rsiHigh}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    {t.autoRefresh}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile card grid */}
          <div className="grid gap-3 sm:hidden">
            {loading && coins.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-[#6B6B6B]">
                <Search className="h-6 w-6 opacity-30" />
                <p className="text-sm">{t.noCoins}</p>
              </div>
            ) : (
              filtered.map((coin, i) => (
                <CoinCard key={coin.symbol} coin={coin} rank={i + 1} labels={{ terminal: t.terminal, trade: t.trade, volume: t.volume }} />
              ))
            )}
          </div>
        </div>
      </div>
      </TierGate>
    </PageWrapper>
  );
}


