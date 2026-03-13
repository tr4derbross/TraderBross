import { NextResponse } from "next/server";
import { NewsItem, MOCK_SOCIAL } from "@/lib/mock-data";
import { fetchRSS } from "@/lib/rss-parser";
import { SOCIAL_ACCOUNTS, nitterRssUrl } from "@/lib/news-sources";

// Category → ticker inference
const CATEGORY_TICKERS: Record<string, string[]> = {
  dev: ["ETH"],
  ceo: ["BTC", "BNB"],
  analyst: ["BTC"],
  onchain: ["BTC", "ETH"],
  media: ["BTC"],
};

const CRYPTO_TICKER_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "$btc", "sats", "satoshi"],
  ETH: ["ethereum", "eth", "$eth", "ether"],
  SOL: ["solana", "sol", "$sol"],
  BNB: ["binance", "bnb", "$bnb"],
  XRP: ["xrp", "ripple", "$xrp"],
};

function inferTickersFromText(text: string, defaultTickers: string[]): string[] {
  const lower = text.toLowerCase();
  const found = Object.entries(CRYPTO_TICKER_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([ticker]) => ticker);
  return found.length > 0 ? found : defaultTickers;
}

function cleanTweetText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "") // strip URLs
    .replace(/pic\.twitter\.com\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

// ─── Nitter RSS (set NITTER_BASE_URL in .env.local) ──────────────────────────
async function fetchNitterFeeds(): Promise<NewsItem[]> {
  const nitterBase = process.env.NITTER_BASE_URL;
  if (!nitterBase) return [];

  const results = await Promise.allSettled(
    SOCIAL_ACCOUNTS.map(async (account) => {
      const rssUrl = nitterRssUrl(nitterBase, account.handle);
      const items = await fetchRSS(rssUrl, 8_000);

      return items.map((item): NewsItem => {
        const text = cleanTweetText(item.title + " " + item.description);
        const defaultTickers = CATEGORY_TICKERS[account.category] || ["BTC"];
        return {
          id: `social-nitter-${account.handle}-${item.guid.slice(-12)}`,
          headline: text.slice(0, 200),
          summary: text,
          source: "X / Twitter",
          ticker: inferTickersFromText(text, defaultTickers),
          sector: "Crypto",
          timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
          url: item.link,
          type: "social",
          author: account.displayName,
          authorHandle: `@${account.handle}`,
          authorCategory: account.category,
          sentiment: "neutral",
        };
      });
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

// ─── Substack / Blog RSS for accounts that have it ───────────────────────────
async function fetchSubstackFeeds(): Promise<NewsItem[]> {
  const accounts = SOCIAL_ACCOUNTS.filter((a) => a.substackUrl);

  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const items = await fetchRSS(account.substackUrl!, 10_000);
      return items.map((item): NewsItem => {
        const text = item.title + " " + item.description;
        const defaultTickers = CATEGORY_TICKERS[account.category] || ["BTC"];
        return {
          id: `social-sub-${account.handle}-${item.guid.slice(-12)}`,
          headline: item.title,
          summary: item.description?.slice(0, 300) || item.title,
          source: "Substack",
          ticker: inferTickersFromText(text, defaultTickers),
          sector: "Crypto",
          timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
          url: item.link,
          type: "social",
          author: account.displayName,
          authorHandle: `@${account.handle}`,
          authorCategory: account.category,
          sentiment: "neutral",
        };
      });
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

// ─── Custom RSS feeds from env (SOCIAL_RSS_URLS=url1,url2,...) ───────────────
async function fetchCustomSocialFeeds(): Promise<NewsItem[]> {
  const raw = process.env.SOCIAL_RSS_URLS;
  if (!raw) return [];

  const urls = raw.split(",").map((u) => u.trim()).filter(Boolean);
  const results = await Promise.allSettled(
    urls.map(async (url, i) => {
      const items = await fetchRSS(url);
      return items.map((item): NewsItem => ({
        id: `social-custom-${i}-${item.guid.slice(-12)}`,
        headline: cleanTweetText(item.title),
        summary: item.description?.slice(0, 300) || item.title,
        source: item.author ? `@${item.author}` : "Social",
        ticker: inferTickersFromText(item.title + " " + item.description, ["BTC"]),
        sector: "Crypto",
        timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
        url: item.link,
        type: "social",
        author: item.author,
        authorHandle: item.author ? `@${item.author}` : undefined,
        authorCategory: "analyst",
        sentiment: "neutral",
      }));
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

export async function GET() {
  const [nitterItems, substackItems, customItems] = await Promise.all([
    fetchNitterFeeds(),
    fetchSubstackFeeds(),
    fetchCustomSocialFeeds(),
  ]);

  const all = [...nitterItems, ...substackItems, ...customItems];

  if (all.length === 0) {
    // Return mock social data if no real feeds configured
    return NextResponse.json(MOCK_SOCIAL);
  }

  // Deduplicate by headline
  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = deduped.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json(sorted.slice(0, 50));
}
