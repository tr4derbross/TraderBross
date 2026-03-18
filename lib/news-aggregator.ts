// TraderBross News System v2.0 — Zero-Key Multi-Agent Aggregator
// cryptocurrency.cv primary + RSS fallback + social + sentiment + ticker detection
// No external npm packages — native fetch + regex only.

import type { NewsItem } from "@/types/news";
import { RSS_SOURCES, SOCIAL_SOURCES, nitterToRssHub } from "@/lib/news-sources";
import { parseRSSFeed } from "@/lib/rss-parser";

// ── Sentiment detection ────────────────────────────────────────────────────────

const BULLISH_WORDS = [
  "surge", "surges", "rally", "rallies", "bullish", "bull", "buy", "buying",
  "accumulate", "accumulation", "inflow", "inflows", "adoption", "approval",
  "approved", "record", "high", "ath", "growth", "grows", "launch", "launches",
  "partnership", "integrate", "integration", "upgrade", "breakout", "moon",
  "pump", "gains", "gains", "positive", "profit", "profits", "long", "longs",
  "outflow", "outflows", "withdrawal", "accumulating", "hodl", "hodling",
];

const BEARISH_WORDS = [
  "crash", "crashes", "dump", "dumping", "bearish", "bear", "sell", "selling",
  "outflow", "hack", "hacked", "exploit", "exploited", "rug", "scam", "fraud",
  "lawsuit", "charges", "arrest", "ban", "banned", "plunge", "plunges", "drop",
  "drops", "decline", "declines", "fall", "falls", "low", "loss", "losses",
  "liquidation", "liquidations", "short", "shorts", "regulation", "fine",
  "penalty", "warning", "attack", "breach", "stolen", "collapse", "collapses",
  "down", "fear", "panic", "fear",
];

export function detectSentiment(
  text: string
): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  let bull = 0;
  let bear = 0;

  for (const w of BULLISH_WORDS) {
    if (lower.includes(w)) bull++;
  }
  for (const w of BEARISH_WORDS) {
    if (lower.includes(w)) bear++;
  }

  if (bull > bear + 1) return "bullish";
  if (bear > bull + 1) return "bearish";
  return "neutral";
}

// ── Ticker detection ───────────────────────────────────────────────────────────

export const KNOWN_TICKERS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "ARB", "OP",
  "NEAR", "INJ", "SUI", "APT", "TIA", "ATOM", "HYPE", "TON", "MATIC", "UNI",
  "DOT", "LTC", "AAVE", "CRV", "LDO", "RUNE", "PENDLE", "WIF", "PEPE", "SHIB",
];

// Additional keyword → ticker mappings for common mentions
const TICKER_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "satoshi", "microstrategy", "mstr", "blackrock ibit", "gbtc"],
  ETH: ["ethereum", "eth", "vitalik", "ether"],
  SOL: ["solana", "sol", "pump.fun", "jupiter"],
  BNB: ["binance", "bnb"],
  XRP: ["xrp", "ripple"],
  DOGE: ["dogecoin", "doge"],
  AVAX: ["avalanche", "avax"],
  LINK: ["chainlink"],
  ARB: ["arbitrum"],
  OP: ["optimism"],
  NEAR: ["near protocol"],
  INJ: ["injective"],
  ATOM: ["cosmos"],
  MATIC: ["polygon", "matic"],
  UNI: ["uniswap"],
  LDO: ["lido"],
  AAVE: ["aave"],
  RUNE: ["thorchain"],
  TON: ["toncoin"],
};

export function extractTickers(text: string): string[] {
  const upper = text.toUpperCase();
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // Exact symbol match (e.g. $BTC or word boundary BTC)
  for (const ticker of KNOWN_TICKERS) {
    const re = new RegExp(`(?:^|[\\s$#,.(])${ticker}(?:[\\s,.)!?]|$)`, "g");
    if (re.test(upper)) {
      found.add(ticker);
    }
  }

  // Keyword-based detection
  for (const [ticker, keywords] of Object.entries(TICKER_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.add(ticker);
        break;
      }
    }
  }

  const result = Array.from(found).slice(0, 5);
  return result.length > 0 ? result : ["BTC"];
}

// ── Impact detection ───────────────────────────────────────────────────────────

const HIGH_IMPACT_WORDS = [
  "breaking", "sec", "etf", "hack", "exploit", "rug", "arrest", "charges",
  "approval", "approved", "ban", "banned", "crash", "surge", "liquidation",
  "all-time high", "ath", "record", "emergency", "halving", "fork",
];

const HIGH_IMPACT_SOURCES = [
  "CoinDesk", "CoinTelegraph", "Reuters", "Bloomberg", "The Block", "Decrypt",
];

export function detectImpact(
  text: string,
  source: string
): "high" | "medium" | "low" {
  const lower = text.toLowerCase();

  for (const w of HIGH_IMPACT_WORDS) {
    if (lower.includes(w)) return "high";
  }

  if (HIGH_IMPACT_SOURCES.includes(source)) return "medium";

  return "low";
}

// ── Breaking detection ─────────────────────────────────────────────────────────

const BREAKING_PATTERNS = [
  /^breaking/i,
  /\bbreaking\b/i,
  /^alert:/i,
  /^urgent:/i,
  /\bjust in\b/i,
  /\bflash:/i,
];

export function detectBreaking(text: string): boolean {
  return BREAKING_PATTERNS.some((re) => re.test(text));
}

// ── Deduplication ──────────────────────────────────────────────────────────────

export function deduplicate(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── cryptocurrency.cv API types ────────────────────────────────────────────────

interface CryptoCV_Article {
  title: string;
  link?: string;
  url?: string;
  description?: string;
  pubDate?: string;
  timeAgo?: string;
  source?: string;
}

interface CryptoCV_Response {
  articles?: CryptoCV_Article[];
  news?: CryptoCV_Article[];
  data?: CryptoCV_Article[];
}

// ── cryptocurrency.cv fetcher ──────────────────────────────────────────────────

/**
 * Fetch general crypto news from cryptocurrency.cv (no API key required).
 * Endpoint: GET https://cryptocurrency.cv/api/news?coin=BTC (coin is optional)
 * Response shape: { articles: [{ title, link, description, pubDate, source, timeAgo }] }
 */
export async function fetchCryptoCVNews(coin?: string): Promise<NewsItem[]> {
  try {
    const params = new URLSearchParams();
    if (coin) params.set("coin", coin.toUpperCase());

    const url = `https://cryptocurrency.cv/api/news${params.toString() ? `?${params.toString()}` : ""}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TraderBross/2.0 (+https://traderbross.com)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    const data = (await res.json()) as CryptoCV_Response;
    const articles: CryptoCV_Article[] =
      data.articles ?? data.news ?? data.data ?? [];

    return articles.slice(0, 30).map((article, idx): NewsItem => {
      const link = article.link ?? article.url ?? "#";
      const fullText = `${article.title} ${article.description ?? ""}`;
      const sentiment = detectSentiment(fullText);
      const tickers = extractTickers(fullText);
      const sourceName = article.source ?? "cryptocurrency.cv";

      let timestamp: Date;
      if (article.pubDate) {
        timestamp = new Date(article.pubDate);
        if (isNaN(timestamp.getTime())) timestamp = new Date();
      } else {
        timestamp = new Date();
      }

      return {
        id: `cryptocv-${idx}-${link.slice(-20)}`,
        title: article.title,
        summary: article.description ?? undefined,
        url: link,
        source: sourceName,
        sourceLabel: sourceName,
        category: "news",
        sentiment,
        tickers,
        timestamp,
        isBreaking: detectBreaking(article.title),
        impact: detectImpact(fullText, sourceName),
      };
    });
  } catch {
    return [];
  }
}

// ── Breaking news fetcher ──────────────────────────────────────────────────────

/**
 * Fetch breaking news from cryptocurrency.cv.
 * Endpoint: GET https://cryptocurrency.cv/api/breaking
 */
export async function fetchBreakingNews(): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch("https://cryptocurrency.cv/api/breaking", {
      signal: controller.signal,
      headers: {
        "User-Agent": "TraderBross/2.0 (+https://traderbross.com)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    const data = (await res.json()) as CryptoCV_Response;
    const articles: CryptoCV_Article[] =
      data.articles ?? data.news ?? data.data ?? [];

    return articles.slice(0, 10).map((article, idx): NewsItem => {
      const link = article.link ?? article.url ?? "#";
      const fullText = `${article.title} ${article.description ?? ""}`;
      const sourceName = article.source ?? "cryptocurrency.cv";

      let timestamp: Date;
      if (article.pubDate) {
        timestamp = new Date(article.pubDate);
        if (isNaN(timestamp.getTime())) timestamp = new Date();
      } else {
        timestamp = new Date();
      }

      return {
        id: `breaking-${idx}-${link.slice(-20)}`,
        title: article.title,
        summary: article.description ?? undefined,
        url: link,
        source: sourceName,
        sourceLabel: sourceName,
        category: "news",
        sentiment: detectSentiment(fullText),
        tickers: extractTickers(fullText),
        timestamp,
        isBreaking: true,
        impact: "high",
      };
    });
  } catch {
    return [];
  }
}

// ── RSS fallback fetcher ───────────────────────────────────────────────────────

/**
 * Fetch all configured RSS sources in parallel.
 * Uses Promise.allSettled — any source failure is silently skipped.
 */
export async function fetchAllRSS(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map((src) => parseRSSFeed(src.url, src.name, src.category))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}

// ── Social feed fetcher ────────────────────────────────────────────────────────

/**
 * Fetch social (Nitter) RSS feeds.
 * On 403 / network error, automatically falls back to rsshub.app.
 */
export async function fetchSocialFeed(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    SOCIAL_SOURCES.map(async (src) => {
      let items = await parseRSSFeed(src.url, src.name, "social");

      // Fallback to rsshub if nitter returns nothing
      if (items.length === 0) {
        const fallback = nitterToRssHub(src.url);
        items = await parseRSSFeed(fallback, src.name, "social");
      }

      return items;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}

// ── Main aggregator ────────────────────────────────────────────────────────────

export interface AggregateOptions {
  tab?: "all" | "news" | "social";
  coin?: string;
  limit?: number;
}

/**
 * Aggregate news from all sources.
 *
 * - tab=all  → cryptocurrency.cv primary, RSS fallback, deduplicated + sorted
 * - tab=news → cryptocurrency.cv + RSS
 * - tab=social → social (Nitter/RSSHub) feeds only
 *
 * Throws only if all sources fail so the caller can serve mock data.
 */
export async function aggregateNews(
  options: AggregateOptions = {}
): Promise<NewsItem[]> {
  const { tab = "all", coin, limit = 30 } = options;

  let items: NewsItem[] = [];

  if (tab === "social") {
    items = await fetchSocialFeed();
  } else {
    // Fetch cryptocurrency.cv (primary) and RSS (fallback) in parallel
    const [primaryItems, rssItems, breakingItems] = await Promise.allSettled([
      fetchCryptoCVNews(coin),
      fetchAllRSS(),
      fetchBreakingNews(),
    ]);

    const primary =
      primaryItems.status === "fulfilled" ? primaryItems.value : [];
    const rss = rssItems.status === "fulfilled" ? rssItems.value : [];
    const breaking =
      breakingItems.status === "fulfilled" ? breakingItems.value : [];

    // Prioritise breaking news at the top, then primary, then RSS fallback
    items = deduplicate([...breaking, ...primary, ...rss]);
  }

  if (items.length === 0) {
    // Signal caller to use mock data
    throw new Error("No news items fetched from any source");
  }

  // Sort descending by timestamp
  items.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return items.slice(0, limit);
}
