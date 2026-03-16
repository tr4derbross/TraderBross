const now = Date.now();
const minute = 60 * 1000;

export const MOCK_NEWS = [
  {
    id: "mock-news-1",
    headline: "Bitcoin retakes key intraday range as ETF demand stays firm",
    summary: "Spot ETF inflows and rising futures open interest are keeping BTC bid above the previous resistance band.",
    source: "TraderBross Mock Wire",
    ticker: ["BTC", "MSTR"],
    sector: "Bitcoin",
    timestamp: new Date(now - 2 * minute).toISOString(),
    url: "#",
    type: "news",
    importance: "market-moving",
    sentiment: "bullish",
  },
  {
    id: "mock-news-2",
    headline: "Ethereum L2 activity accelerates as fees compress again",
    summary: "Lower execution costs are helping rollup activity rebound and lifting sentiment around ETH beta names.",
    source: "TraderBross Mock Wire",
    ticker: ["ETH", "ARB", "OP"],
    sector: "Ethereum / L2",
    timestamp: new Date(now - 18 * minute).toISOString(),
    url: "#",
    type: "news",
    importance: "watch",
    sentiment: "bullish",
  },
  {
    id: "mock-news-3",
    headline: "Funding overheats on alt majors after fast weekend breakout",
    summary: "Perpetual funding moved sharply higher across SOL and DOGE, raising the odds of a short-term cooldown.",
    source: "TraderBross Mock Wire",
    ticker: ["SOL", "DOGE"],
    sector: "DeFi / Solana",
    timestamp: new Date(now - 34 * minute).toISOString(),
    url: "#",
    type: "news",
    importance: "market-moving",
    sentiment: "neutral",
  },
];

export const MOCK_WHALES = [
  {
    id: "mock-whale-1",
    headline: "Whale Alert: 25,000 BTC withdrawn from major exchange",
    summary: "Large BTC transfer into cold storage is typically interpreted as reduced near-term sell pressure.",
    source: "Whale Alert",
    ticker: ["BTC"],
    sector: "Bitcoin",
    timestamp: new Date(now - 7 * minute).toISOString(),
    url: "#",
    type: "whale",
    whaleAmountUsd: 2_300_000_000,
    whaleToken: "BTC",
    whaleFrom: "Exchange",
    whaleTo: "Cold storage",
    whaleBlockchain: "bitcoin",
    sentiment: "bullish",
  },
];

export const MOCK_SOCIAL = [
  {
    id: "mock-social-1",
    headline: "Funding is rich, but momentum still favors trend continuation above the breakout zone.",
    summary: "Analyst commentary flags constructive price structure while warning about crowded positioning.",
    source: "X / Twitter",
    ticker: ["BTC", "ETH"],
    sector: "Macro / Bitcoin",
    timestamp: new Date(now - 11 * minute).toISOString(),
    url: "#",
    type: "social",
    author: "TraderBross Feed",
    authorHandle: "@traderbross",
    authorCategory: "analyst",
    sentiment: "neutral",
  },
];

const BASE_QUOTES = [
  ["BTC", 92000],
  ["ETH", 3200],
  ["SOL", 185],
  ["BNB", 580],
  ["XRP", 0.62],
  ["DOGE", 0.18],
  ["AVAX", 38],
  ["LINK", 18],
  ["ARB", 1.2],
  ["OP", 2.8],
  ["NEAR", 6.5],
  ["INJ", 28],
  ["DOT", 8.5],
  ["APT", 9.6],
  ["SUI", 1.7],
  ["TIA", 4.5],
  ["ATOM", 8.8],
  ["AAVE", 118],
  ["WIF", 2.3],
  ["HYPE", 18],
  ["COIN", 185],
  ["MSTR", 320],
];

export function generateMockQuotes() {
  return BASE_QUOTES.map(([symbol, base]) => {
    const changePct = (Math.random() - 0.5) * 6;
    const price = base * (1 + changePct / 100);
    const decimals = price < 1 ? 5 : price < 10 ? 4 : price < 1000 ? 2 : 0;
    return {
      symbol,
      price: Number(price.toFixed(decimals)),
      change: Number((price - base).toFixed(decimals)),
      changePct: Number(changePct.toFixed(2)),
    };
  });
}

export function generateMockCandles(symbol, interval, limit = 120) {
  const base = Object.fromEntries(BASE_QUOTES)[symbol] || 100;
  const spacing = intervalToSeconds(interval);
  const start = Math.floor(Date.now() / 1000) - spacing * limit;
  const candles = [];
  let previous = base * (0.96 + Math.random() * 0.08);

  for (let index = 0; index < limit; index += 1) {
    const open = previous;
    const close = Math.max(0.00001, open * (1 + (Math.random() - 0.48) * 0.03));
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    candles.push({
      time: start + index * spacing,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.round(Math.random() * 8000000 + 200000),
    });
    previous = close;
  }

  return candles;
}

function intervalToSeconds(interval) {
  const map = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1w": 604800,
  };

  return map[interval] || 86400;
}
