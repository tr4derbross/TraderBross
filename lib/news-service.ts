import { NewsItem } from "@/lib/mock-data";
import { fetchRSS } from "@/lib/rss-parser";
import { RSS_NEWS_FEEDS, CRYPTOCOMPARE_NEWS_URL } from "@/lib/news-sources";

const CRYPTO_TICKERS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE",
  "AVAX", "LINK", "ARB", "OP", "NEAR", "INJ", "DOT",
];

const TICKER_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "satoshi", "microstrategy", "mstr", "blackrock", "gbtc", "etf"],
  ETH: ["ethereum", "eth", "vitalik", "ether", "staking"],
  SOL: ["solana", "sol", "pump.fun", "jupiter"],
  BNB: ["binance", "bnb", "cz", "changpeng"],
  XRP: ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin", "elon", "musk"],
  AVAX: ["avalanche", "avax"],
  LINK: ["chainlink", "link"],
  ARB: ["arbitrum", "arb"],
  OP: ["optimism", " op ", "base"],
  NEAR: ["near protocol", "near"],
  INJ: ["injective", "inj"],
  DOT: ["polkadot", "dot", "parachain"],
};

const SECTOR_KEYWORDS: Record<string, string[]> = {
  Regulation: ["sec", "cftc", "regulation", "lawsuit", "legal", "congress", "senate", "law", "court"],
  Institutional: ["blackrock", "fidelity", "jpmorgan", "grayscale", "etf", "institutional", "fund"],
  "Macro / Bitcoin": ["fed", "federal reserve", "inflation", "rate", "macro", "treasury", "dollar", "economy"],
  DeFi: ["defi", "tvl", "protocol", "liquidity", "yield", "lending", "amm", "swap"],
  "DeFi / Solana": ["solana", "sol", "pump.fun", "jupiter", "raydium"],
  "Ethereum / L2": ["arbitrum", "optimism", "base", "layer 2", "l2", "rollup", "polygon"],
  CeFi: ["binance", "coinbase", "kraken", "exchange", "custody", "listing"],
  Stablecoins: ["usdt", "usdc", "tether", "stablecoin", "dai", "frax"],
  Bitcoin: ["bitcoin", "btc", "microstrategy", "mstr", "lightning"],
  Ethereum: ["ethereum", "eth", "vitalik", "merge", "staking"],
};

type QueryOptions = {
  sector?: string | null;
  ticker?: string | null;
  keyword?: string | null;
  limit?: number;
};

type GNewsArticle = {
  title: string;
  description?: string;
  content?: string;
  url: string;
  publishedAt: string;
  source?: { name?: string };
};

type CryptoPanicItem = {
  id: number;
  title: string;
  published_at: string;
  url: string;
  source?: { title?: string };
  currencies?: Array<{ code: string }>;
  metadata?: { description?: string };
  votes?: { positive: number; negative: number };
};

type CryptoCompareNewsItem = {
  id: string;
  published_on: number;
  title: string;
  url: string;
  source: string;
  body: string;
  tags: string;
  categories: string;
};

const SOURCE_TIERS: Record<string, NewsItem["sourceTier"]> = {
  Reuters: "tier1",
  Bloomberg: "tier1",
  "Bloomberg Crypto": "tier1",
  CoinDesk: "tier1",
  CoinTelegraph: "tier1",
  Decrypt: "tier1",
  "The Block": "tier1",
  "Bitcoin Magazine": "tier1",
  "Crypto Briefing": "tier1",
  CryptoPanic: "aggregator",
  CryptoCompare: "aggregator",
  GNews: "aggregator",
};

export async function getNewsItems(options: QueryOptions = {}): Promise<NewsItem[]> {
  const [gnewsItems, cryptoPanicItems, cryptoCompareItems, rssItems] = await Promise.all([
    fetchGNews(options),
    fetchCryptoPanicNews(options),
    fetchCryptoCompareNews(),
    fetchAllRSSFeeds(),
  ]);

  const merged = deduplicateNews([
    ...gnewsItems,
    ...cryptoPanicItems,
    ...cryptoCompareItems,
    ...rssItems,
  ]);

  const filtered = filterNews(merged, options);
  return filtered
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, options.limit ?? 50);
}

export function inferTickers(text: string): string[] {
  const lower = text.toLowerCase();
  const found = CRYPTO_TICKERS.filter((ticker) =>
    (TICKER_KEYWORDS[ticker] || [ticker.toLowerCase()]).some((keyword) => lower.includes(keyword))
  );
  return found.length > 0 ? found.slice(0, 4) : ["BTC"];
}

export function inferSector(text: string): string {
  const lower = text.toLowerCase();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return sector;
  }
  return "Crypto";
}

function getSourceTier(source: string): NewsItem["sourceTier"] {
  return SOURCE_TIERS[source] ?? "community";
}

function inferImportance(text: string, sourceTier?: NewsItem["sourceTier"]): NewsItem["importance"] {
  const lower = text.toLowerCase();

  if (
    lower.includes("breaking") ||
    lower.includes("sec") ||
    lower.includes("etf") ||
    lower.includes("hack") ||
    lower.includes("lawsuit") ||
    lower.includes("approval") ||
    lower.includes("liquidation") ||
    lower.includes("funding rate")
  ) {
    return "breaking";
  }

  if (
    lower.includes("surge") ||
    lower.includes("plunge") ||
    lower.includes("inflow") ||
    lower.includes("outflow") ||
    lower.includes("record") ||
    lower.includes("buyback") ||
    lower.includes("raises") ||
    lower.includes("launches")
  ) {
    return "market-moving";
  }

  if (sourceTier === "tier1" || sourceTier === "official") {
    return "watch";
  }

  return "noise";
}

function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterNews(items: NewsItem[], options: QueryOptions): NewsItem[] {
  let news = [...items];

  if (options.sector && options.sector !== "All") {
    news = news.filter((item) => item.sector.includes(options.sector as string));
  }

  if (options.ticker) {
    const ticker = options.ticker.toUpperCase();
    news = news.filter((item) => item.ticker.includes(ticker));
  }

  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    news = news.filter((item) =>
      item.headline.toLowerCase().includes(keyword) ||
      item.summary.toLowerCase().includes(keyword) ||
      item.source.toLowerCase().includes(keyword)
    );
  }

  return news;
}

function buildTopicQuery({ ticker, keyword, sector }: QueryOptions): string {
  const parts: string[] = [];

  if (ticker) {
    const tickerKey = ticker.toUpperCase();
    const mapped = TICKER_KEYWORDS[tickerKey] ?? [tickerKey.toLowerCase()];
    parts.push(`(${mapped.slice(0, 4).join(" OR ")})`);
  }

  if (keyword) {
    parts.push(`(${keyword})`);
  }

  if (sector && sector !== "All" && SECTOR_KEYWORDS[sector]) {
    parts.push(`(${SECTOR_KEYWORDS[sector].slice(0, 4).join(" OR ")})`);
  }

  if (parts.length === 0) {
    parts.push("(crypto OR bitcoin OR ethereum OR blockchain)");
  }

  return parts.join(" AND ");
}

async function fetchGNews(options: QueryOptions): Promise<NewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: buildTopicQuery(options),
      lang: "en",
      max: "10",
      sortby: "publishedAt",
      in: "title,description",
      apikey: apiKey,
    });

    const res = await fetch(`https://gnews.io/api/v4/search?${params.toString()}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { articles?: GNewsArticle[] };
    return (data.articles ?? []).map((article, index) => {
      const text = `${article.title} ${article.description ?? ""} ${article.content ?? ""}`;
      const source = article.source?.name || "GNews";
      const sourceTier = getSourceTier(source);
      return {
        id: `gnews-${index}-${article.url}`,
        headline: article.title,
        summary: article.description || article.content || article.title,
        source,
        sourceTier,
        importance: inferImportance(text, sourceTier),
        ticker: inferTickers(text),
        sector: inferSector(text),
        timestamp: new Date(article.publishedAt),
        url: article.url,
        type: "news" as const,
      };
    });
  } catch {
    return [];
  }
}

async function fetchCryptoPanicNews(options: QueryOptions): Promise<NewsItem[]> {
  const apiKey = process.env.CRYPTOPANIC_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      auth_token: apiKey,
      public: "true",
      kind: "news",
      metadata: "true",
      regions: "en",
    });

    if (options.ticker) params.set("currencies", options.ticker.toUpperCase());

    const res = await fetch(`https://cryptopanic.com/api/v1/posts/?${params.toString()}`, {
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: CryptoPanicItem[] };
    return (data.results ?? []).slice(0, 20).map((item) => {
      const text = `${item.title} ${item.metadata?.description ?? ""}`;
      const positive = item.votes?.positive ?? 0;
      const negative = item.votes?.negative ?? 0;
      const source = item.source?.title || "CryptoPanic";
      const sourceTier = getSourceTier(source);
      return {
        id: `cp-${item.id}`,
        headline: item.title,
        summary: item.metadata?.description || item.title,
        source,
        sourceTier,
        importance: inferImportance(text, sourceTier),
        ticker: item.currencies?.map((entry) => entry.code).filter((code) => CRYPTO_TICKERS.includes(code)) || inferTickers(text),
        sector: inferSector(text),
        timestamp: new Date(item.published_at),
        url: item.url,
        sentiment: positive > negative ? "bullish" : negative > positive ? "bearish" : "neutral",
        type: "news" as const,
      };
    });
  } catch {
    return [];
  }
}

async function fetchCryptoCompareNews(): Promise<NewsItem[]> {
  const apiKey = process.env.CRYPTOCOMPARE_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`${CRYPTOCOMPARE_NEWS_URL}&api_key=${apiKey}`, {
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { Data?: CryptoCompareNewsItem[] };
    return (data.Data ?? []).slice(0, 20).map((item) => {
      const text = `${item.title} ${item.body} ${item.tags} ${item.categories}`;
      const source = item.source || "CryptoCompare";
      const sourceTier = getSourceTier(source);
      return {
        id: `cc-${item.id}`,
        headline: item.title,
        summary: item.body?.slice(0, 320) || item.title,
        source,
        sourceTier,
        importance: inferImportance(text, sourceTier),
        ticker: inferTickers(text),
        sector: inferSector(text),
        timestamp: new Date(item.published_on * 1000),
        url: item.url,
        type: "news" as const,
      };
    });
  } catch {
    return [];
  }
}

async function fetchAllRSSFeeds(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    RSS_NEWS_FEEDS.map(async (feed) => {
      const items = await fetchRSS(feed.url);
      return items.map((item): NewsItem => {
        const text = `${item.title} ${item.description}`;
        const sourceTier = getSourceTier(feed.name);
        return {
          id: `rss-${feed.id}-${item.guid.slice(-20)}`,
          headline: item.title,
          summary: item.description || item.title,
          source: feed.name,
          sourceTier,
          importance: inferImportance(text, sourceTier),
          ticker: inferTickers(text),
          sector: inferSector(text),
          timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
          url: item.link,
          type: "news" as const,
        };
      });
    })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);
}
