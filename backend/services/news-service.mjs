import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";
import { MOCK_NEWS, MOCK_SOCIAL, MOCK_WHALES } from "./mock-data.mjs";

const cache = new MemoryCache();

function normalizeHeadline(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90);
}

function inferTicker(text) {
  const source = text.toLowerCase();
  const map = {
    BTC: ["bitcoin", "btc", "microstrategy", "mstr"],
    ETH: ["ethereum", "eth", "vitalik"],
    SOL: ["solana", "sol"],
    BNB: ["binance", "bnb"],
    XRP: ["xrp", "ripple"],
    DOGE: ["doge", "dogecoin"],
    AVAX: ["avax", "avalanche"],
    LINK: ["chainlink", "link"],
    ARB: ["arbitrum", "arb"],
    OP: ["optimism", "base"],
  };

  const found = Object.entries(map)
    .filter(([, keywords]) => keywords.some((keyword) => source.includes(keyword)))
    .map(([ticker]) => ticker);

  return found.length > 0 ? found : ["BTC"];
}

function applyFilters(items, filters = {}) {
  let next = [...items];

  if (filters.sector && filters.sector !== "All") {
    next = next.filter((item) => String(item.sector || "").includes(filters.sector));
  }

  if (filters.ticker) {
    const wanted = filters.ticker.toUpperCase();
    next = next.filter((item) => Array.isArray(item.ticker) && item.ticker.includes(wanted));
  }

  if (filters.keyword) {
    const query = filters.keyword.toLowerCase();
    next = next.filter((item) => `${item.headline} ${item.summary} ${item.source}`.toLowerCase().includes(query));
  }

  return next;
}

export async function getNewsFeed(config) {
  return cache.remember("news:feed", 45000, async () => {
    const [news, whales] = await Promise.all([getNews(config), getWhales(config)]);
    const social = await getSocial(config);

    return {
      news,
      whales,
      social,
    };
  });
}

export async function getNews(config, filters = {}) {
  const feed = await cache.remember("news:items", 45000, async () => {
    if (!config.cryptopanicKey) {
      return MOCK_NEWS;
    }

    try {
      const params = new URLSearchParams({
        auth_token: config.cryptopanicKey,
        public: "true",
        kind: "news",
        metadata: "true",
        regions: "en",
      });
      const payload = await fetchJson(`https://cryptopanic.com/api/v1/posts/?${params.toString()}`, { timeoutMs: 5000 });
      const items = (payload?.results || []).map((item) => {
        const summary = item.metadata?.description || item.title;
        return {
          id: `cryptopanic-${item.id}`,
          headline: item.title,
          summary,
          source: item.source?.title || "CryptoPanic",
          ticker: (item.currencies || []).map((entry) => entry.code).slice(0, 4),
          sector: "Crypto",
          timestamp: item.published_at,
          url: item.url,
          type: "news",
          sentiment:
            (item.votes?.positive || 0) > (item.votes?.negative || 0)
              ? "bullish"
              : (item.votes?.negative || 0) > (item.votes?.positive || 0)
                ? "bearish"
                : "neutral",
          importance: "watch",
        };
      });

      return dedupeNews(items).slice(0, 50);
    } catch {
      return MOCK_NEWS;
    }
  });

  return applyFilters(feed, filters);
}

export async function getWhales(config) {
  return cache.remember("news:whales", 60000, async () => {
    if (!config.whaleAlertKey) {
      return MOCK_WHALES;
    }

    try {
      const payload = await fetchJson(`https://api.whale-alert.io/v1/transactions?api_key=${config.whaleAlertKey}&min_value=5000000`, {
        timeoutMs: 5000,
      });

      const items = (payload?.transactions || []).slice(0, 15).map((item, index) => ({
        id: `whale-${item.id || index}`,
        headline: `Whale Alert: ${item.amount?.toLocaleString?.() || item.amount} ${String(item.symbol || "UNKNOWN").toUpperCase()} moved`,
        summary: `${item.blockchain || "Unknown"} transfer worth approximately $${Math.round(item.amount_usd || 0).toLocaleString()}.`,
        source: "Whale Alert",
        ticker: [String(item.symbol || "BTC").toUpperCase()],
        sector: "Whale",
        timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString(),
        url: "#",
        type: "whale",
        whaleAmountUsd: item.amount_usd || null,
        whaleToken: String(item.symbol || "BTC").toUpperCase(),
        whaleFrom: item.from?.owner_type || item.from?.address || "Unknown",
        whaleTo: item.to?.owner_type || item.to?.address || "Unknown",
        whaleBlockchain: item.blockchain || "unknown",
        sentiment: item.to?.owner_type === "exchange" ? "bearish" : "bullish",
      }));

      return items.length > 0 ? items : MOCK_WHALES;
    } catch {
      return MOCK_WHALES;
    }
  });
}

export async function getSocial(config) {
  return cache.remember("news:social", 120000, async () => {
    if (config.socialRssUrls.length === 0) {
      return MOCK_SOCIAL;
    }

    try {
      const text = await fetch(config.socialRssUrls[0], { signal: AbortSignal.timeout(6000) }).then((res) => res.text());
      const entries = [...text.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>/g)]
        .slice(0, 10)
        .map((match, index) => ({
          id: `social-rss-${index}`,
          headline: match[1],
          summary: match[1],
          source: "Social RSS",
          ticker: inferTicker(match[1]),
          sector: "Social",
          timestamp: new Date().toISOString(),
          url: match[2],
          type: "social",
          author: "Social Feed",
          authorHandle: "@feed",
          authorCategory: "analyst",
          sentiment: "neutral",
        }));

      return entries.length > 0 ? entries : MOCK_SOCIAL;
    } catch {
      return MOCK_SOCIAL;
    }
  });
}

export function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeHeadline(item.headline);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
