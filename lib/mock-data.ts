export type NewsItem = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  sourceTier?: "official" | "tier1" | "aggregator" | "community";
  importance?: "breaking" | "market-moving" | "watch" | "noise";
  ticker: string[];
  sector: string;
  timestamp: Date;
  url: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  sentimentScore?: number;
  sentimentReason?: string;
  // Source type classification
  type?: "news" | "whale" | "social";
  // Social (Twitter/X) specific
  author?: string;        // Display name
  authorHandle?: string;  // @handle
  authorCategory?: string; // dev | ceo | analyst | onchain | media
  // Whale alert specific
  whaleAmountUsd?: number;   // USD value of transaction
  whaleToken?: string;       // Token symbol
  whaleFrom?: string;        // Source address or exchange label
  whaleTo?: string;          // Destination address or exchange label
  whaleTxHash?: string;      // Transaction hash
  whaleBlockchain?: string;  // e.g. "ethereum", "bitcoin"
  whaleEventType?: string;
  whaleConfidence?: number;
  whaleSignificance?: number;
  relatedAssets?: string[];
  watchlistRelevance?: number;
  relevanceLabels?: string[];
  priorityLabel?: string;
};

export type PriceData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TickerQuote = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
};

const now = Date.now();
const min = 60 * 1000;

export const MOCK_NEWS: NewsItem[] = [
  {
    id: "1",
    headline: "Bitcoin Surges Past $95,000 as Spot ETF Inflows Hit Record $2.1B Daily",
    summary:
      "Bitcoin reached a new monthly high as spot ETF inflows accelerated, with BlackRock's IBIT recording its largest single-day inflow since inception. On-chain data shows long-term holder accumulation at current levels.",
    source: "CoinDesk",
    ticker: ["BTC", "MSTR"],
    sector: "Bitcoin",
    timestamp: new Date(now - 2 * min),
    url: "#",
  },
  {
    id: "2",
    headline: "SEC Approves New Crypto Exchange Regulations, Industry Reacts",
    summary:
      "The SEC voted 3-2 to approve comprehensive regulations for centralized crypto exchanges, requiring registration and enhanced custody standards by Q3 2026.",
    source: "Bloomberg Crypto",
    ticker: ["BTC", "ETH", "COIN"],
    sector: "Regulation",
    timestamp: new Date(now - 8 * min),
    url: "#",
  },
  {
    id: "3",
    headline: "Ethereum Staking Ratio Hits All-Time High of 28% — Supply Shock Incoming?",
    summary:
      "Over 28% of all ETH supply is now staked, the highest ratio since The Merge. Analysts suggest reduced liquid supply could create price pressure if demand accelerates.",
    source: "The Block",
    ticker: ["ETH", "LDO"],
    sector: "Ethereum",
    timestamp: new Date(now - 15 * min),
    url: "#",
  },
  {
    id: "4",
    headline: "Solana DEX Volume Flips Ethereum for Third Consecutive Month",
    summary:
      "Solana-based DEXes processed $48B in March, surpassing Ethereum's $41B for the third month running, driven by meme coin trading and Jupiter aggregator.",
    source: "DeFiLlama",
    ticker: ["SOL"],
    sector: "DeFi / Solana",
    timestamp: new Date(now - 22 * min),
    url: "#",
  },
  {
    id: "5",
    headline: "MicroStrategy Acquires Additional 12,000 BTC Worth $1.1B",
    summary:
      "MicroStrategy announced a new Bitcoin purchase of 12,000 BTC at an average price of $91,667, bringing total holdings to over 500,000 BTC.",
    source: "Reuters",
    ticker: ["MSTR", "BTC"],
    sector: "Bitcoin",
    timestamp: new Date(now - 35 * min),
    url: "#",
  },
  {
    id: "6",
    headline: "Ripple Wins Partial XRP Summary Judgment, Token Pumps 18%",
    summary:
      "A federal judge ruled that XRP sales on secondary markets do not constitute securities offerings, a significant partial win for Ripple Labs.",
    source: "CoinTelegraph",
    ticker: ["XRP"],
    sector: "Regulation",
    timestamp: new Date(now - 48 * min),
    url: "#",
  },
  {
    id: "7",
    headline: "BlackRock's BUIDL Tokenized Fund Surpasses $1B AUM on Ethereum",
    summary:
      "BlackRock's tokenized money market fund crossed $1 billion in assets under management, cementing institutional interest in on-chain financial products.",
    source: "Financial Times",
    ticker: ["ETH", "BTC"],
    sector: "Institutional",
    timestamp: new Date(now - 60 * min),
    url: "#",
  },
  {
    id: "8",
    headline: "Avalanche Foundation Launches $100M Incentive Program for DeFi Builders",
    summary:
      "The Avalanche Foundation announced Vista, a $100M program to attract DeFi protocols targeting lending, perpetuals, and stablecoin projects.",
    source: "Decrypt",
    ticker: ["AVAX"],
    sector: "DeFi",
    timestamp: new Date(now - 75 * min),
    url: "#",
  },
  {
    id: "9",
    headline: "Coinbase Reports Record Q1 Revenue of $2.8B on Crypto Market Rally",
    summary:
      "Coinbase exceeded analyst estimates with record trading volumes and custody revenue. Institutional trading volume grew 85% YoY.",
    source: "CNBC",
    ticker: ["COIN", "BTC", "ETH"],
    sector: "CeFi",
    timestamp: new Date(now - 90 * min),
    url: "#",
  },
  {
    id: "10",
    headline: "Tether Prints $2B USDT — Largest Single Mint in Six Months",
    summary:
      "Tether minted $2 billion USDT in a single transaction. Historically, large Tether mints have preceded significant upward price moves in Bitcoin.",
    source: "Whale Alert",
    ticker: ["USDT", "BTC"],
    sector: "Stablecoins",
    timestamp: new Date(now - 110 * min),
    url: "#",
  },
  {
    id: "11",
    headline: "Chainlink Powers Cross-Chain Settlement for JP Morgan Tokenized Assets",
    summary:
      "JPMorgan's Onyx division will use Chainlink's CCIP for cross-chain settlement of tokenized U.S. Treasury bonds.",
    source: "Chainlink Blog",
    ticker: ["LINK", "ETH"],
    sector: "Institutional",
    timestamp: new Date(now - 130 * min),
    url: "#",
  },
  {
    id: "12",
    headline: "Ethereum L2 Total Value Locked Crosses $50B for First Time",
    summary:
      "Combined TVL across Arbitrum, Base, and Optimism surpassed $50 billion, a new all-time high driven by DeFi and RWA growth.",
    source: "L2Beat",
    ticker: ["ETH", "ARB", "OP"],
    sector: "Ethereum / L2",
    timestamp: new Date(now - 150 * min),
    url: "#",
  },
];

export const INCOMING_NEWS: NewsItem[] = [
  {
    id: "live-1",
    headline: "Breaking: Fed Chair Powell Comments Spark Bitcoin Rally to $96,500",
    summary:
      "Federal Reserve Chair Powell's dovish comments on rate policy triggered a risk-on move across markets, with Bitcoin leading crypto higher.",
    source: "Bloomberg",
    ticker: ["BTC", "ETH", "SOL"],
    sector: "Macro / Bitcoin",
    timestamp: new Date(),
    url: "#",
  },
  {
    id: "live-2",
    headline: "Solana Memecoin Launchpad Pump.fun Hits $1B Cumulative Revenue",
    summary:
      "Pump.fun crossed $1 billion in cumulative revenue, making it one of the most profitable DeFi protocols in crypto history.",
    source: "Dune Analytics",
    ticker: ["SOL"],
    sector: "DeFi / Solana",
    timestamp: new Date(),
    url: "#",
  },
  {
    id: "live-3",
    headline: "Grayscale Bitcoin Trust Discount Narrows to Near Zero as Demand Returns",
    summary:
      "GBTC's discount to NAV narrowed to just 0.3%, suggesting renewed institutional demand for Bitcoin exposure.",
    source: "Grayscale",
    ticker: ["BTC"],
    sector: "Institutional",
    timestamp: new Date(),
    url: "#",
  },
  {
    id: "live-4",
    headline: "Binance Launches Zero-Fee BTC/USDC Spot Trading Pair",
    summary:
      "Binance removed trading fees on BTC/USDC spot pairs to capture market share and increase USDC adoption.",
    source: "Binance Blog",
    ticker: ["BTC", "BNB"],
    sector: "CeFi",
    timestamp: new Date(),
    url: "#",
  },
  {
    id: "live-5",
    headline: "Polygon zkEVM Upgrade Reduces Transaction Costs by 80%",
    summary:
      "Polygon's latest zkEVM upgrade significantly cuts gas fees, positioning it as a competitive alternative to other L2s.",
    source: "Polygon Labs",
    ticker: ["POL", "ETH"],
    sector: "Ethereum / L2",
    timestamp: new Date(),
    url: "#",
  },
];

export function generateMockPriceData(ticker: string, days = 90): PriceData[] {
  const basePrice: Record<string, number> = {
    BTC: 92000, ETH: 3200, SOL: 185, BNB: 580, XRP: 0.62,
    DOGE: 0.18, AVAX: 38, LINK: 18, ARB: 1.2, OP: 2.8,
    NEAR: 6.5, INJ: 28, DOT: 8.5, COIN: 185, MSTR: 320,
  };

  const base = basePrice[ticker] ?? 100;
  const decimals = base < 1 ? 4 : base < 10 ? 3 : 2;
  const data: PriceData[] = [];
  let price = base * (0.78 + Math.random() * 0.12);
  const startTime = Math.floor(Date.now() / 1000) - (days - 1) * 24 * 3600;

  for (let i = 0; i < days; i++) {
    const time = startTime + i * 24 * 3600;
    const vol = base > 10000 ? 0.04 : base < 1 ? 0.1 : 0.06;
    const change = (Math.random() - 0.48) * vol;
    const open = price;
    price = Math.max(price * (1 + change), base * 0.1);
    const high = Math.max(open, price) * (1 + Math.random() * 0.015);
    const low = Math.min(open, price) * (1 - Math.random() * 0.015);
    data.push({
      time,
      open: parseFloat(open.toFixed(decimals)),
      high: parseFloat(high.toFixed(decimals)),
      low: parseFloat(low.toFixed(decimals)),
      close: parseFloat(price.toFixed(decimals)),
      volume: Math.floor(Math.random() * 80_000_000 + 10_000_000),
    });
  }
  return data;
}

export function generateTickerQuotes(): TickerQuote[] {
  const tickers = [
    { symbol: "BTC",  base: 92000 },
    { symbol: "ETH",  base: 3200  },
    { symbol: "SOL",  base: 185   },
    { symbol: "BNB",  base: 580   },
    { symbol: "XRP",  base: 0.62  },
    { symbol: "DOGE", base: 0.18  },
    { symbol: "AVAX", base: 38    },
    { symbol: "LINK", base: 18    },
    { symbol: "ARB",  base: 1.2   },
    { symbol: "OP",   base: 2.8   },
    { symbol: "NEAR", base: 6.5   },
    { symbol: "INJ",  base: 28    },
    { symbol: "DOT",  base: 8.5   },
    { symbol: "COIN", base: 185   },
    { symbol: "MSTR", base: 320   },
  ];

  return tickers.map(({ symbol, base }) => {
    const changePct = (Math.random() - 0.45) * 10;
    const price = base * (1 + changePct / 100);
    const change = price - base;
    const d = base < 1 ? 4 : base < 10 ? 3 : 2;
    return {
      symbol,
      price: parseFloat(price.toFixed(d)),
      change: parseFloat(change.toFixed(d)),
      changePct: parseFloat(changePct.toFixed(2)),
    };
  });
}

// ─── Mock Whale Alerts ────────────────────────────────────────────────────────
const wn = Date.now();
const wm = 60 * 1000;

export const MOCK_WHALES: NewsItem[] = [
  {
    id: "whale-1",
    headline: "🐋 50,000 BTC moved to Coinbase",
    summary: "50,000 BTC (≈$4.6B) transferred from unknown wallet to Coinbase. Possible sell pressure signal.",
    source: "Whale Alert",
    ticker: ["BTC"],
    sector: "Bitcoin",
    timestamp: new Date(wn - 5 * wm),
    url: "#",
    type: "whale",
    whaleAmountUsd: 4_600_000_000,
    whaleToken: "BTC",
    whaleFrom: "Unknown Wallet",
    whaleTo: "Coinbase",
    whaleBlockchain: "bitcoin",
    sentiment: "bearish",
  },
  {
    id: "whale-2",
    headline: "🐋 2,000,000,000 USDT minted by Tether",
    summary: "Tether minted 2 billion USDT on the Ethereum network. Large mints have historically preceded BTC price increases.",
    source: "Whale Alert",
    ticker: ["BTC", "ETH"],
    sector: "Stablecoins",
    timestamp: new Date(wn - 18 * wm),
    url: "#",
    type: "whale",
    whaleAmountUsd: 2_000_000_000,
    whaleToken: "USDT",
    whaleFrom: "Tether Treasury",
    whaleTo: "Ethereum Network",
    whaleBlockchain: "ethereum",
    sentiment: "bullish",
  },
  {
    id: "whale-3",
    headline: "🐋 120,000 ETH moved from Binance",
    summary: "120,000 ETH (≈$384M) withdrawn from Binance cold wallet to unknown address. Potential accumulation.",
    source: "Whale Alert",
    ticker: ["ETH"],
    sector: "Ethereum",
    timestamp: new Date(wn - 32 * wm),
    url: "#",
    type: "whale",
    whaleAmountUsd: 384_000_000,
    whaleToken: "ETH",
    whaleFrom: "Binance",
    whaleTo: "Unknown Wallet",
    whaleBlockchain: "ethereum",
    sentiment: "bullish",
  },
  {
    id: "whale-4",
    headline: "🐋 500,000,000 XRP transferred between wallets",
    summary: "500 million XRP (≈$310M) moved between Ripple-associated wallets.",
    source: "Whale Alert",
    ticker: ["XRP"],
    sector: "Regulation",
    timestamp: new Date(wn - 55 * wm),
    url: "#",
    type: "whale",
    whaleAmountUsd: 310_000_000,
    whaleToken: "XRP",
    whaleFrom: "Ripple Wallet",
    whaleTo: "Unknown Wallet",
    whaleBlockchain: "xrp-ledger",
    sentiment: "neutral",
  },
  {
    id: "whale-5",
    headline: "🐋 25,000 BTC withdrawn from Coinbase",
    summary: "25,000 BTC (≈$2.3B) moved out of Coinbase to cold storage. Strong accumulation signal.",
    source: "Whale Alert",
    ticker: ["BTC"],
    sector: "Bitcoin",
    timestamp: new Date(wn - 90 * wm),
    url: "#",
    type: "whale",
    whaleAmountUsd: 2_300_000_000,
    whaleToken: "BTC",
    whaleFrom: "Coinbase",
    whaleTo: "Unknown Wallet (Cold Storage)",
    whaleBlockchain: "bitcoin",
    sentiment: "bullish",
  },
];

// ─── Mock Social Posts ─────────────────────────────────────────────────────────
export const MOCK_SOCIAL: NewsItem[] = [
  {
    id: "social-1",
    headline: "Ethereum's long-term roadmap is progressing well. Danksharding will reduce L2 fees by another 10-100x. The endgame is a world computer that anyone can use.",
    summary: "Vitalik discusses Ethereum's scaling roadmap and the impact of future danksharding upgrade on Layer 2 transaction costs.",
    source: "X / Twitter",
    ticker: ["ETH"],
    sector: "Ethereum",
    timestamp: new Date(wn - 10 * wm),
    url: "#",
    type: "social",
    author: "Vitalik Buterin",
    authorHandle: "@VitalikButerin",
    authorCategory: "dev",
    sentiment: "bullish",
  },
  {
    id: "social-2",
    headline: "MicroStrategy has acquired an additional 15,000 Bitcoin for approximately $1.4 billion at an average price of $93,000 per bitcoin. $MSTR $BTC",
    summary: "MicroStrategy continues aggressive Bitcoin treasury strategy, adding 15K BTC to bring total holdings near 530,000 BTC.",
    source: "X / Twitter",
    ticker: ["BTC", "MSTR"],
    sector: "Bitcoin",
    timestamp: new Date(wn - 25 * wm),
    url: "#",
    type: "social",
    author: "Michael Saylor",
    authorHandle: "@michael_saylor",
    authorCategory: "ceo",
    sentiment: "bullish",
  },
  {
    id: "social-3",
    headline: "Bitcoin is the world's first truly scarce digital asset. Every institution that doesn't own it is taking on career risk. The 21 million cap is the most important number in finance.",
    summary: "Pomp makes the institutional case for Bitcoin, arguing that non-ownership is now the riskier position for large asset managers.",
    source: "X / Twitter",
    ticker: ["BTC"],
    sector: "Bitcoin",
    timestamp: new Date(wn - 45 * wm),
    url: "#",
    type: "social",
    author: "Anthony Pompliano",
    authorHandle: "@APompliano",
    authorCategory: "analyst",
    sentiment: "bullish",
  },
  {
    id: "social-4",
    headline: "On-chain data shows 150,000 ETH just moved from a wallet that's been dormant since 2017. These old coins moving could signal supply pressure.",
    summary: "Lookonchain flags dormant ETH wallet activity, historically a bearish signal when old coins are moved to exchanges.",
    source: "X / Twitter",
    ticker: ["ETH"],
    sector: "Ethereum",
    timestamp: new Date(wn - 60 * wm),
    url: "#",
    type: "social",
    author: "Lookonchain",
    authorHandle: "@lookonchain",
    authorCategory: "onchain",
    sentiment: "bearish",
  },
  {
    id: "social-5",
    headline: "BTC dominance at 58% and rising. Altcoin season requires patience. Bitcoin leads every major bull cycle. Don't lose your $BTC for altcoin exposure at this stage.",
    summary: "Arthur Hayes recommends maintaining BTC dominance in portfolios at current market structure, cautioning against premature altcoin rotation.",
    source: "X / Twitter",
    ticker: ["BTC"],
    sector: "Macro / Bitcoin",
    timestamp: new Date(wn - 80 * wm),
    url: "#",
    type: "social",
    author: "Arthur Hayes",
    authorHandle: "@CryptoHayes",
    authorCategory: "analyst",
    sentiment: "neutral",
  },
  {
    id: "social-6",
    headline: "Binance has processed over $100 billion in trading volume this month. The crypto industry is growing at an incredible pace. BUIDL and stay patient. 🚀",
    summary: "CZ highlights Binance's record trading volumes, pointing to growing mainstream crypto adoption.",
    source: "X / Twitter",
    ticker: ["BNB", "BTC"],
    sector: "CeFi",
    timestamp: new Date(wn - 100 * wm),
    url: "#",
    type: "social",
    author: "CZ Binance",
    authorHandle: "@cz_binance",
    authorCategory: "ceo",
    sentiment: "bullish",
  },
];

// Tickers available as Hyperliquid perpetuals (primary platform)
export const AVAILABLE_TICKERS = [
  // Majors on HL
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "ARB", "OP",
  "NEAR", "INJ", "DOT", "APT", "SUI", "TIA", "SEI", "ATOM", "AAVE", "UNI",
  // Mid-caps on HL
  "LTC", "FIL", "WLD", "RNDR", "PENDLE", "JTO", "GMX", "SNX", "CRV", "LDO",
  "RUNE", "ETC", "BLUR", "PYTH", "WIF", "HYPE", "STX", "TRB", "DYDX", "GRT",
  // Additional HL perps
  "FET", "MAGIC", "COMP", "MKR", "YFI", "1INCH", "ZRX", "SUSHI", "IMX", "SAND",
];

export const SECTORS = [
  "All",
  "Bitcoin",
  "Ethereum",
  "Ethereum / L2",
  "DeFi",
  "DeFi / Solana",
  "Regulation",
  "Institutional",
  "CeFi",
  "Stablecoins",
  "Macro / Bitcoin",
];
