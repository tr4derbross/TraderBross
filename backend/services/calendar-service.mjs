import { MemoryCache } from "./cache.mjs";

const cache = new MemoryCache();

const PLACEHOLDER_EVENTS = [
  {
    id: "1",
    title: "Ethereum EOF Upgrade",
    coin: "Ethereum",
    coinSymbol: "ETH",
    date: "2026-03-20",
    category: "upgrade",
    description: "EVM Object Format finalization and tooling upgrades.",
    source: "ethereum.org",
    importance: "high",
  },
  {
    id: "2",
    title: "Solana Firedancer Milestone",
    coin: "Solana",
    coinSymbol: "SOL",
    date: "2026-03-25",
    category: "upgrade",
    description: "Validator client performance milestone for mainnet readiness.",
    source: "solana.com",
    importance: "high",
  },
  {
    id: "3",
    title: "Consensus Conference",
    coin: "Market-wide",
    coinSymbol: "BTC",
    date: "2026-05-11",
    category: "conference",
    description: "Major industry conference with protocol and institutional updates.",
    source: "coindesk.com",
    importance: "high",
  },
  {
    id: "4",
    title: "Arbitrum Token Unlock",
    coin: "Arbitrum",
    coinSymbol: "ARB",
    date: "2026-04-02",
    category: "tokenUnlock",
    description: "Scheduled team and investor vesting unlock.",
    source: "arbiscan.io",
    importance: "medium",
  },
  {
    id: "5",
    title: "SEC Digital Asset Roundtable",
    coin: "Market-wide",
    coinSymbol: "BTC",
    date: "2026-04-22",
    category: "regulation",
    description: "US policy and enforcement discussion for crypto market structure.",
    source: "sec.gov",
    importance: "high",
  },
];

function toCategory(name = "") {
  const cat = name.toLowerCase();
  if (cat.includes("token unlock") || cat.includes("vesting")) return "tokenUnlock";
  if (cat.includes("fork")) return "hardFork";
  if (cat.includes("conference") || cat.includes("summit")) return "conference";
  if (cat.includes("listing")) return "listing";
  if (cat.includes("mainnet") || cat.includes("launch")) return "mainnet";
  if (cat.includes("regulation") || cat.includes("legal")) return "regulation";
  if (cat.includes("airdrop")) return "airdrop";
  return "upgrade";
}

async function fetchCoinMarketCal(apiKey) {
  if (!apiKey) return null;

  try {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 90 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://developers.coinmarketcal.com/v1/events?dateRangeStart=${today}&dateRangeEnd=${future}&page=1&pageSize=50&sortBy=importance`,
      {
        headers: {
          "x-api-key": apiKey,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(7000),
      }
    );
    if (!res.ok) return null;

    const json = await res.json();
    const body = Array.isArray(json?.body) ? json.body : [];

    return body.map((event) => ({
      id: String(event.id),
      title: event?.title?.en || "Event",
      coin: event?.coins?.[0]?.name || "Market",
      coinSymbol: (event?.coins?.[0]?.symbol || "BTC").toUpperCase(),
      date: String(event?.date_event || today).split("T")[0],
      category: toCategory(event?.categories?.[0]?.name),
      description: event?.description?.en || "",
      source: event?.proof || "",
      importance: event?.importance_score >= 70 ? "high" : event?.importance_score >= 40 ? "medium" : "low",
    }));
  } catch {
    return null;
  }
}

export async function getCalendarEvents(config) {
  return cache.remember("calendar:v1", 60 * 60 * 1000, async () => {
    const live = await fetchCoinMarketCal(config.coinMarketCalApiKey);
    return Array.isArray(live) && live.length > 0 ? live : PLACEHOLDER_EVENTS;
  });
}
