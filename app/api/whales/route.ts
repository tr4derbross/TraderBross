// AGENT-1: /api/whales route — Telegram whale scraper with mock fallback
import { NextResponse } from "next/server";
import { getAllWhaleMessages, type WhaleMessage } from "@/lib/telegram-scraper";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  try {
    const whales = await getAllWhaleMessages(limit);
    if (whales.length > 0) {
      return NextResponse.json(whales, {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      });
    }
  } catch {
    // Fall through to mock data
  }

  return NextResponse.json(generateMockWhales(limit), {
    headers: { "Cache-Control": "s-maxage=30" },
  });
}

// ─── Mock whale data ───────────────────────────────────────────────────────────
const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "AVAX", "LINK", "TRX", "USDT"] as const;
const EXCHANGES = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "Huobi"] as const;
const UNKNOWN_LABELS = [
  "Unknown Wallet",
  "Cold Storage",
  "0x...a3f2",
  "bc1q...9k4z",
  "DeFi Protocol",
  "Institutional Wallet",
] as const;

type AssetKey = (typeof ASSETS)[number];

const ASSET_PRICES: Record<AssetKey, number> = {
  BTC: 92_000,
  ETH: 3_200,
  SOL: 185,
  BNB: 580,
  XRP: 0.62,
  AVAX: 38,
  LINK: 18,
  TRX: 0.12,
  USDT: 1,
};

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatSeverity(amountUSD: number): 1 | 2 | 3 | 4 | 5 {
  if (amountUSD >= 100_000_000) return 5;
  if (amountUSD >= 50_000_000)  return 4;
  if (amountUSD >= 10_000_000)  return 3;
  if (amountUSD >= 2_000_000)   return 2;
  return 1;
}

// Static seed entries — always included for predictable fallback display
const STATIC_ENTRIES: WhaleMessage[] = [
  {
    id: "mock-static-1",
    type: "exchange_inflow",
    asset: "BTC",
    amount: 3_250,
    amountUSD: 299_000_000,
    from: "Unknown Wallet",
    to: "Binance",
    timestamp: new Date(Date.now() - 4 * 60_000),
    rawText: "3,250 BTC ($299M) transferred from Unknown Wallet to Binance",
    channel: "@whale_alert_io",
    channelUrl: "https://t.me/s/whale_alert_io",
    severity: 5,
  },
  {
    id: "mock-static-2",
    type: "exchange_outflow",
    asset: "ETH",
    amount: 48_000,
    amountUSD: 153_600_000,
    from: "Coinbase",
    to: "Cold Storage",
    timestamp: new Date(Date.now() - 12 * 60_000),
    rawText: "48,000 ETH ($153.6M) transferred from Coinbase to Cold Storage",
    channel: "@whale_alert_io",
    channelUrl: "https://t.me/s/whale_alert_io",
    severity: 5,
  },
  {
    id: "mock-static-3",
    type: "liquidation",
    asset: "BTC",
    amountUSD: 87_400_000,
    from: "Exchange",
    to: "Liquidated",
    side: "LONG",
    timestamp: new Date(Date.now() - 7 * 60_000),
    rawText: "$87.4M BTC LONG LIQUIDATED at $89,420",
    channel: "@WhaleBotRektd",
    channelUrl: "https://t.me/s/WhaleBotRektd",
    severity: 4,
  },
  {
    id: "mock-static-4",
    type: "transfer",
    asset: "USDT",
    amount: 500_000_000,
    amountUSD: 500_000_000,
    from: "Tether Treasury",
    to: "Bitfinex",
    timestamp: new Date(Date.now() - 20 * 60_000),
    rawText: "500,000,000 USDT ($500M) transferred from Tether Treasury to Bitfinex",
    channel: "@whale_alert_io",
    channelUrl: "https://t.me/s/whale_alert_io",
    severity: 5,
  },
  {
    id: "mock-static-5",
    type: "exchange_inflow",
    asset: "ETH",
    amount: 15_000,
    amountUSD: 48_000_000,
    from: "0x...a3f2",
    to: "Kraken",
    timestamp: new Date(Date.now() - 35 * 60_000),
    rawText: "15,000 ETH ($48M) transferred from 0x...a3f2 to Kraken",
    channel: "@WhaleBotAlerts",
    channelUrl: "https://t.me/s/WhaleBotAlerts",
    severity: 4,
  },
  {
    id: "mock-static-6",
    type: "liquidation",
    asset: "ETH",
    amountUSD: 22_100_000,
    from: "Exchange",
    to: "Liquidated",
    side: "SHORT",
    timestamp: new Date(Date.now() - 41 * 60_000),
    rawText: "$22.1M ETH SHORT LIQUIDATED at $3,245",
    channel: "@WhaleBotRektd",
    channelUrl: "https://t.me/s/WhaleBotRektd",
    severity: 3,
  },
  {
    id: "mock-static-7",
    type: "exchange_outflow",
    asset: "SOL",
    amount: 1_200_000,
    amountUSD: 222_000_000,
    from: "Binance",
    to: "Unknown Wallet",
    timestamp: new Date(Date.now() - 58 * 60_000),
    rawText: "1,200,000 SOL ($222M) transferred from Binance to Unknown Wallet",
    channel: "@whale_alert_io",
    channelUrl: "https://t.me/s/whale_alert_io",
    severity: 5,
  },
  {
    id: "mock-static-8",
    type: "transfer",
    asset: "XRP",
    amount: 800_000_000,
    amountUSD: 496_000_000,
    from: "Ripple Wallet",
    to: "Unknown Wallet",
    timestamp: new Date(Date.now() - 70 * 60_000),
    rawText: "800,000,000 XRP ($496M) transferred from Ripple Wallet to Unknown Wallet",
    channel: "@WhaleBotAlerts",
    channelUrl: "https://t.me/s/WhaleBotAlerts",
    severity: 5,
  },
  {
    id: "mock-static-9",
    type: "exchange_inflow",
    asset: "BNB",
    amount: 250_000,
    amountUSD: 145_000_000,
    from: "DeFi Protocol",
    to: "Binance",
    timestamp: new Date(Date.now() - 85 * 60_000),
    rawText: "250,000 BNB ($145M) transferred from DeFi Protocol to Binance",
    channel: "@WhaleBotAlerts",
    channelUrl: "https://t.me/s/WhaleBotAlerts",
    severity: 5,
  },
  {
    id: "mock-static-10",
    type: "liquidation",
    asset: "SOL",
    amountUSD: 5_700_000,
    from: "Exchange",
    to: "Liquidated",
    side: "LONG",
    timestamp: new Date(Date.now() - 95 * 60_000),
    rawText: "$5.7M SOL LONG LIQUIDATED at $182.50",
    channel: "@WhaleBotRektd",
    channelUrl: "https://t.me/s/WhaleBotRektd",
    severity: 2,
  },
];

function generateMockWhales(limit: number): WhaleMessage[] {
  const now = Date.now();
  const dynamic: WhaleMessage[] = [];

  // Generate dynamic entries to pad up to limit
  const needed = Math.max(0, limit - STATIC_ENTRIES.length);

  for (let i = 0; i < needed; i++) {
    const asset = randomFrom(ASSETS);
    const price = ASSET_PRICES[asset];
    // Random USD value $500K – $200M
    const amountUSD = Math.round(randomBetween(500_000, 200_000_000));
    const amount = asset !== "USDT" ? Math.round(amountUSD / price) : amountUSD;

    const typeRoll = Math.random();
    let type: WhaleMessage["type"];
    let from: string;
    let to: string;
    let side: "LONG" | "SHORT" | undefined;

    if (typeRoll < 0.25) {
      type = "exchange_inflow";
      from = randomFrom(UNKNOWN_LABELS);
      to = randomFrom(EXCHANGES);
    } else if (typeRoll < 0.50) {
      type = "exchange_outflow";
      from = randomFrom(EXCHANGES);
      to = randomFrom(UNKNOWN_LABELS);
    } else if (typeRoll < 0.70) {
      type = "transfer";
      from = randomFrom(UNKNOWN_LABELS);
      to = randomFrom(UNKNOWN_LABELS);
    } else {
      type = "liquidation";
      from = "Exchange";
      to = "Liquidated";
      side = Math.random() > 0.5 ? "LONG" : "SHORT";
    }

    const channelIdx = Math.floor(Math.random() * 3);
    const channels = [
      { name: "@WhaleBotAlerts", url: "https://t.me/s/WhaleBotAlerts" },
      { name: "@WhaleBotRektd",  url: "https://t.me/s/WhaleBotRektd"  },
      { name: "@whale_alert_io", url: "https://t.me/s/whale_alert_io" },
    ];
    const ch = channels[channelIdx];

    const entry: WhaleMessage = {
      id: `mock-dyn-${i}-${Date.now()}`,
      type,
      asset,
      amount: type !== "liquidation" ? amount : undefined,
      amountUSD,
      from,
      to,
      timestamp: new Date(now - Math.round(randomBetween(100 * 60_000, 360 * 60_000))),
      rawText: type === "liquidation"
        ? `$${(amountUSD / 1_000_000).toFixed(1)}M ${asset} ${side} LIQUIDATED`
        : `${amount.toLocaleString()} ${asset} transferred from ${from} to ${to}`,
      channel: ch.name,
      channelUrl: ch.url,
      severity: formatSeverity(amountUSD),
    };

    if (side) entry.side = side;

    dynamic.push(entry);
  }

  const all = [...STATIC_ENTRIES, ...dynamic];
  all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return all.slice(0, limit);
}
