import { NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";

export type EventCategory =
  | "tokenUnlock"
  | "hardFork"
  | "upgrade"
  | "conference"
  | "listing"
  | "mainnet"
  | "regulation"
  | "airdrop";

export interface CalendarEvent {
  id: string;
  title: string;
  coin: string;
  coinSymbol: string;
  date: string; // ISO date string
  category: EventCategory;
  description: string;
  source: string;
  importance: "high" | "medium" | "low";
}

// Curated placeholder events — replace with CoinMarketCal API when key is available
const PLACEHOLDER_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Ethereum Dencun Aftermath: EOF Upgrade",
    coin: "Ethereum",
    coinSymbol: "ETH",
    date: "2026-03-20",
    category: "upgrade",
    description: "EVM Object Format (EOF) upgrade as part of Pectra hard fork finalization. Improved smart contract bytecode format.",
    source: "ethereum.org",
    importance: "high",
  },
  {
    id: "2",
    title: "Solana Firedancer Client Release",
    coin: "Solana",
    coinSymbol: "SOL",
    date: "2026-03-25",
    category: "upgrade",
    description: "Jump Crypto's Firedancer validator client expected mainnet release. Targets 1M TPS throughput.",
    source: "solana.com",
    importance: "high",
  },
  {
    id: "3",
    title: "Bitcoin Halving Anniversary",
    coin: "Bitcoin",
    coinSymbol: "BTC",
    date: "2026-04-20",
    category: "hardFork",
    description: "Second anniversary of the April 2024 halving event. Historically significant date for BTC price cycles.",
    source: "bitcoin.org",
    importance: "medium",
  },
  {
    id: "4",
    title: "Consensus 2026",
    coin: "Market-wide",
    coinSymbol: "BTC",
    date: "2026-05-11",
    category: "conference",
    description: "CoinDesk's annual Consensus conference. Key platform for protocol announcements and institutional adoption signals.",
    source: "coindesk.com",
    importance: "high",
  },
  {
    id: "5",
    title: "Arbitrum DAO Token Unlock",
    coin: "Arbitrum",
    coinSymbol: "ARB",
    date: "2026-03-18",
    category: "tokenUnlock",
    description: "Large ARB token unlock from the initial distribution. Team and investor vesting cliff.",
    source: "arbiscan.io",
    importance: "high",
  },
  {
    id: "6",
    title: "Optimism Token Unlock",
    coin: "Optimism",
    coinSymbol: "OP",
    date: "2026-04-01",
    category: "tokenUnlock",
    description: "OP Foundation and core contributor token unlock. Potential selling pressure.",
    source: "optimism.io",
    importance: "medium",
  },
  {
    id: "7",
    title: "Aptos Network Upgrade v1.12",
    coin: "Aptos",
    coinSymbol: "APT",
    date: "2026-03-28",
    category: "upgrade",
    description: "Performance improvements and new Move language features in v1.12 protocol upgrade.",
    source: "aptoslabs.com",
    importance: "low",
  },
  {
    id: "8",
    title: "Cosmos IBC v2 Mainnet",
    coin: "Cosmos",
    coinSymbol: "ATOM",
    date: "2026-04-10",
    category: "mainnet",
    description: "Inter-Blockchain Communication v2 protocol launch. Enhanced cross-chain messaging and lower fees.",
    source: "cosmos.network",
    importance: "medium",
  },
  {
    id: "9",
    title: "Sui Network Phase 3",
    coin: "Sui",
    coinSymbol: "SUI",
    date: "2026-04-15",
    category: "upgrade",
    description: "Sui Phase 3 decentralization milestone — additional validator permissionlessness.",
    source: "sui.io",
    importance: "medium",
  },
  {
    id: "10",
    title: "SEC Crypto Roundtable",
    coin: "Market-wide",
    coinSymbol: "BTC",
    date: "2026-04-22",
    category: "regulation",
    description: "US SEC crypto asset regulatory framework roundtable. Expected guidance on staking, DeFi, stablecoins.",
    source: "sec.gov",
    importance: "high",
  },
  {
    id: "11",
    title: "Injective Mainnet v3",
    coin: "Injective",
    coinSymbol: "INJ",
    date: "2026-05-01",
    category: "upgrade",
    description: "Injective v3 brings shared liquidity modules and cross-chain order routing via IBC.",
    source: "injective.com",
    importance: "medium",
  },
  {
    id: "12",
    title: "Bitcoin Amsterdam Conference",
    coin: "Bitcoin",
    coinSymbol: "BTC",
    date: "2026-06-01",
    category: "conference",
    description: "Annual Bitcoin-only conference in Amsterdam. Key platform for BTC ecosystem announcements.",
    source: "b.tc",
    importance: "medium",
  },
];

async function fetchCoinMarketCal(): Promise<CalendarEvent[] | null> {
  const key = process.env.COINMARKETCAL_API_KEY;
  if (!key) return null;

  try {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 90 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://developers.coinmarketcal.com/v1/events?dateRangeStart=${today}&dateRangeEnd=${future}&page=1&pageSize=50&sortBy=importance`,
      {
        headers: {
          "x-api-key": key,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;

    interface CMCEvent {
      id: number;
      title: { en: string };
      coins: Array<{ name: string; symbol: string }>;
      date_event: string;
      categories: Array<{ name: string }>;
      description: { en?: string };
      proof: string;
      importance_score: number;
    }

    const json = await res.json() as { body: CMCEvent[] };
    return json.body.map((e) => {
      const cat = e.categories[0]?.name?.toLowerCase() ?? "";
      let category: EventCategory = "upgrade";
      if (cat.includes("token unlock") || cat.includes("vesting")) category = "tokenUnlock";
      else if (cat.includes("fork")) category = "hardFork";
      else if (cat.includes("conference") || cat.includes("summit")) category = "conference";
      else if (cat.includes("listing")) category = "listing";
      else if (cat.includes("mainnet") || cat.includes("launch")) category = "mainnet";
      else if (cat.includes("regulation") || cat.includes("legal")) category = "regulation";
      else if (cat.includes("airdrop")) category = "airdrop";

      return {
        id: e.id.toString(),
        title: e.title.en,
        coin: e.coins[0]?.name ?? "Market",
        coinSymbol: e.coins[0]?.symbol?.toUpperCase() ?? "BTC",
        date: e.date_event.split("T")[0],
        category,
        description: e.description?.en ?? "",
        source: e.proof ?? "",
        importance: e.importance_score >= 70 ? "high" : e.importance_score >= 40 ? "medium" : "low",
      } satisfies CalendarEvent;
    });
  } catch {
    return null;
  }
}

export async function GET() {
  const result = await withCache("calendar:v1", 3_600_000, async () => {
    const live = await fetchCoinMarketCal();
    return live ?? PLACEHOLDER_EVENTS;
  });

  return NextResponse.json(result);
}
