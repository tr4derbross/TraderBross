import { NextResponse } from "next/server";
import type { CalendarEvent } from "@/types/calendar";

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:4001";
const DEFAULT_PROD_BACKEND = "https://traderbross-production.up.railway.app";

const FALLBACK_EVENTS: CalendarEvent[] = [
  {
    id: "cal-btc-upgrade",
    title: "Bitcoin Core Minor Release Window",
    coin: "Bitcoin",
    coinSymbol: "BTC",
    date: "2026-04-02T00:00:00.000Z",
    category: "upgrade",
    description: "Expected maintenance window for nodes/operators ahead of quarterly release cycle.",
    source: "https://bitcoincore.org",
    importance: "medium",
  },
  {
    id: "cal-eth-ecosystem",
    title: "Ethereum Ecosystem Dev Connect",
    coin: "Ethereum",
    coinSymbol: "ETH",
    date: "2026-04-10T00:00:00.000Z",
    category: "conference",
    description: "Major ecosystem teams share roadmap updates and client release plans.",
    source: "https://ethereum.org",
    importance: "medium",
  },
  {
    id: "cal-sol-upgrade",
    title: "Solana Validator Client Upgrade",
    coin: "Solana",
    coinSymbol: "SOL",
    date: "2026-04-15T00:00:00.000Z",
    category: "upgrade",
    description: "Validator software rollout window; watch for temporary performance shifts.",
    source: "https://solana.com",
    importance: "high",
  },
  {
    id: "cal-avax-mainnet",
    title: "Avalanche Subnet Mainnet Launch",
    coin: "Avalanche",
    coinSymbol: "AVAX",
    date: "2026-04-22T00:00:00.000Z",
    category: "mainnet",
    description: "New subnet mainnet launch and ecosystem incentives activation.",
    source: "https://www.avax.network",
    importance: "medium",
  },
  {
    id: "cal-arb-unlock",
    title: "Arbitrum Scheduled Token Unlock",
    coin: "Arbitrum",
    coinSymbol: "ARB",
    date: "2026-05-01T00:00:00.000Z",
    category: "tokenUnlock",
    description: "Programmed token unlock tranche for team and ecosystem allocations.",
    source: "https://arbitrum.foundation",
    importance: "high",
  },
  {
    id: "cal-op-unlock",
    title: "Optimism Token Unlock",
    coin: "Optimism",
    coinSymbol: "OP",
    date: "2026-05-07T00:00:00.000Z",
    category: "tokenUnlock",
    description: "Monthly unlock window for treasury and contributor vesting allocations.",
    source: "https://www.optimism.io",
    importance: "high",
  },
  {
    id: "cal-link-staking",
    title: "Chainlink Staking Program Expansion",
    coin: "Chainlink",
    coinSymbol: "LINK",
    date: "2026-05-14T00:00:00.000Z",
    category: "upgrade",
    description: "Staking parameter update and additional pool capacity expected.",
    source: "https://chain.link",
    importance: "medium",
  },
  {
    id: "cal-bnb-listing-cycle",
    title: "BNB Ecosystem Listing Cycle",
    coin: "BNB Chain",
    coinSymbol: "BNB",
    date: "2026-05-20T00:00:00.000Z",
    category: "listing",
    description: "Multiple ecosystem projects expected to open futures/spot markets.",
    source: "https://www.bnbchain.org",
    importance: "medium",
  },
  {
    id: "cal-xrp-regulatory",
    title: "Key Regulatory Hearing Window",
    coin: "XRP",
    coinSymbol: "XRP",
    date: "2026-06-04T00:00:00.000Z",
    category: "regulation",
    description: "Regulatory hearing period likely to impact XRP-related volatility.",
    source: "https://www.sec.gov",
    importance: "high",
  },
  {
    id: "cal-dot-governance",
    title: "Polkadot Governance Upgrade Vote",
    coin: "Polkadot",
    coinSymbol: "DOT",
    date: "2026-06-11T00:00:00.000Z",
    category: "hardFork",
    description: "Runtime upgrade vote with network-level parameter changes.",
    source: "https://polkadot.network",
    importance: "medium",
  },
  {
    id: "cal-uni-airdrop",
    title: "DeFi Protocol Community Airdrop Snapshot",
    coin: "Uniswap",
    coinSymbol: "UNI",
    date: "2026-06-19T00:00:00.000Z",
    category: "airdrop",
    description: "Community reward snapshot date for active LP and governance wallets.",
    source: "https://uniswap.org",
    importance: "low",
  },
  {
    id: "cal-ethcc",
    title: "ETHCC Conference Week",
    coin: "Ethereum",
    coinSymbol: "ETH",
    date: "2026-06-30T00:00:00.000Z",
    category: "conference",
    description: "High-signal conference week with product launches and partnership news.",
    source: "https://ethcc.io",
    importance: "medium",
  },
];

function trimSlash(value: string) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveBackendBaseUrl() {
  const explicit =
    process.env.BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (explicit) return trimSlash(explicit);
  if (process.env.NODE_ENV === "production") return DEFAULT_PROD_BACKEND;
  return DEFAULT_LOCAL_BACKEND;
}

function normalizeEvents(rows: unknown): CalendarEvent[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => row as Partial<CalendarEvent>)
    .filter((row) => row.id && row.title && row.coinSymbol && row.date && row.category && row.importance)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      coin: String(row.coin || row.coinSymbol),
      coinSymbol: String(row.coinSymbol).toUpperCase(),
      date: new Date(String(row.date)).toISOString(),
      category: row.category as CalendarEvent["category"],
      description: String(row.description || ""),
      source: String(row.source || ""),
      importance: row.importance as CalendarEvent["importance"],
    }));
}

export async function GET() {
  const backendBase = resolveBackendBaseUrl();

  try {
    const upstream = await fetch(`${backendBase}/api/calendar`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
      headers: {
        accept: "application/json",
      },
    });

    if (upstream.ok) {
      const payload = await upstream.json();
      const normalized = normalizeEvents(payload);
      if (normalized.length > 0) {
        return NextResponse.json(normalized, {
          headers: {
            "cache-control": "no-store",
          },
        });
      }
    }
  } catch {
    // fallback below
  }

  return NextResponse.json(FALLBACK_EVENTS, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
