import { MemoryCache } from "./cache.mjs";
import { fetchJson, fetchText } from "./http.mjs";
import { MOCK_NEWS, MOCK_SOCIAL, MOCK_WHALES } from "./mock-data.mjs";

const cache = new MemoryCache();

// ─── Free RSS sources (no API key required) ──────────────────────────────────
const FREE_RSS_FEEDS = [
  { id: "cointelegraph",   name: "CoinTelegraph",   url: "https://cointelegraph.com/rss",                  sector: "Crypto"        },
  { id: "coindesk",        name: "CoinDesk",         url: "https://www.coindesk.com/arc/outboundfeeds/rss", sector: "Bitcoin"       },
  { id: "decrypt",         name: "Decrypt",          url: "https://decrypt.co/feed",                        sector: "DeFi"          },
  { id: "theblock",        name: "The Block",         url: "https://www.theblock.co/rss.xml",                sector: "Crypto"        },
  { id: "bitcoinmagazine", name: "Bitcoin Magazine",  url: "https://bitcoinmagazine.com/.rss/full/",         sector: "Bitcoin"       },
  { id: "blockworks",      name: "Blockworks",        url: "https://blockworks.co/feed",                     sector: "Institutional" },
  { id: "beincrypto",      name: "BeInCrypto",        url: "https://beincrypto.com/feed/",                   sector: "Crypto"        },
  { id: "cryptoslate",     name: "CryptoSlate",       url: "https://cryptoslate.com/feed/",                  sector: "Crypto"        },
  { id: "dailyhodl",       name: "The Daily Hodl",    url: "https://dailyhodl.com/feed/",                    sector: "Crypto"        },
  { id: "bitcoincom",      name: "Bitcoin.com",       url: "https://news.bitcoin.com/feed/",                 sector: "Bitcoin"       },
  { id: "utoday",          name: "U.Today",           url: "https://u.today/rss",                            sector: "Crypto"        },
  { id: "ambcrypto",       name: "AMBCrypto",         url: "https://ambcrypto.com/feed/",                    sector: "Crypto"        },
  { id: "thedefiant",      name: "The Defiant",       url: "https://thedefiant.io/feed",                     sector: "DeFi"          },
  { id: "cryptopanic-rss", name: "CryptoPanic",       url: "https://cryptopanic.com/news/rss/",              sector: "Crypto"        },
  { id: "newsbtc",         name: "NewsBTC",            url: "https://www.newsbtc.com/feed/",                  sector: "Bitcoin"       },
];

const TICKER_MAP = {
  BTC:  ["bitcoin", "btc", "satoshi", "microstrategy", "mstr", "blackrock", "gbtc"],
  ETH:  ["ethereum", "eth", "vitalik", "ether"],
  SOL:  ["solana", "sol", "pump.fun", "jupiter"],
  BNB:  ["binance", "bnb", "cz"],
  XRP:  ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin", "elon musk"],
  AVAX: ["avalanche", "avax"],
  LINK: ["chainlink", "link"],
  ARB:  ["arbitrum", "arb"],
  OP:   ["optimism", "base"],
  NEAR: ["near protocol", "near"],
  INJ:  ["injective", "inj"],
  DOT:  ["polkadot", "dot"],
  SUI:  ["sui network", " sui "],
  APT:  ["aptos", " apt "],
  ATOM: ["cosmos", " atom "],
  HYPE: ["hyperliquid", "hype"],
};

function inferTicker(text) {
  const lower = text.toLowerCase();
  const found = Object.entries(TICKER_MAP)
    .filter(([, kws]) => kws.some((k) => lower.includes(k)))
    .map(([t]) => t);
  return found.length > 0 ? found.slice(0, 4) : ["BTC"];
}

function inferSentiment(text) {
  const lower = text.toLowerCase();
  const bull = ["surge", "rally", "soar", "gain", "bullish", "high", "record", "breakout", "approval", "launches", "raises", "inflow", "buy", "accumulate"];
  const bear = ["crash", "drop", "fall", "dump", "bearish", "low", "hack", "exploit", "ban", "loss", "liquidation", "outflow", "sell", "correction"];
  const bScore = bull.filter((w) => lower.includes(w)).length;
  const rScore = bear.filter((w) => lower.includes(w)).length;
  if (bScore > rScore) return "bullish";
  if (rScore > bScore) return "bearish";
  return "neutral";
}

function inferImportance(text) {
  const lower = text.toLowerCase();
  if (["breaking", "sec", "etf", "hack", "exploit", "lawsuit", "approval", "liquidation", "emergency"].some((w) => lower.includes(w))) return "breaking";
  if (["surge", "plunge", "record", "inflow", "outflow", "raises", "launches", "buyback"].some((w) => lower.includes(w))) return "market-moving";
  return "watch";
}

function normalizeHeadline(v) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90);
}

function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeHeadline(item.headline);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

// ─── Parse RSS XML (lightweight, no dependencies) ────────────────────────────
function parseRssXml(xml) {
  const items = [];
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const block of itemBlocks) {
    const content = block[1];
    const title = (content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   content.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";
    const link  = (content.match(/<link>(.*?)<\/link>/) ||
                   content.match(/<link\s[^>]*href="([^"]*)"/))?.[1]?.trim() || "#";
    const desc  = (content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                   content.match(/<description>([\s\S]*?)<\/description>/))?.[1]
                    ?.replace(/<[^>]+>/g, "")
                    ?.slice(0, 300)
                    ?.trim() || "";
    const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                     content.match(/<dc:date>([\s\S]*?)<\/dc:date>/))?.[1]?.trim();
    if (title) items.push({ title, link, desc, pubDate });
    if (items.length >= 10) break;
  }
  return items;
}

// ─── Fetch one RSS feed ───────────────────────────────────────────────────────
async function fetchRssFeed(feed) {
  try {
    const xml = await fetchText(feed.url, { timeoutMs: 6000 });
    return parseRssXml(xml).map((item, i) => ({
      id: `rss-${feed.id}-${i}-${Date.now()}`,
      headline: item.title,
      summary: item.desc || item.title,
      source: feed.name,
      ticker: inferTicker(`${item.title} ${item.desc}`),
      sector: feed.sector,
      timestamp: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      url: item.link,
      type: "news",
      sentiment: inferSentiment(`${item.title} ${item.desc}`),
      importance: inferImportance(`${item.title} ${item.desc}`),
    }));
  } catch {
    return [];
  }
}

// ─── CryptoCompare free (no API key required for basic requests) ──────────────
async function fetchCryptoCompareNews() {
  try {
    const payload = await fetchJson(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest",
      { timeoutMs: 5000 }
    );
    return (payload?.Data || []).slice(0, 20).map((item, i) => {
      const text = `${item.title} ${item.body || ""} ${item.tags || ""}`;
      return {
        id: `cc-${item.id || i}`,
        headline: item.title,
        summary: (item.body || item.title).slice(0, 300),
        source: item.source_info?.name || item.source || "CryptoCompare",
        ticker: inferTicker(text),
        sector: "Crypto",
        timestamp: item.published_on
          ? new Date(item.published_on * 1000).toISOString()
          : new Date().toISOString(),
        url: item.url || "#",
        type: "news",
        sentiment: inferSentiment(text),
        importance: inferImportance(text),
      };
    });
  } catch {
    return [];
  }
}

// ─── CryptoPanic API (optional key, public endpoint works without) ─────────────
async function fetchCryptoPanicNews(config) {
  try {
    const params = new URLSearchParams({
      public: "true",
      kind: "news",
      metadata: "true",
      regions: "en",
    });
    if (config.cryptopanicKey) params.set("auth_token", config.cryptopanicKey);
    const payload = await fetchJson(
      `https://cryptopanic.com/api/v1/posts/?${params.toString()}`,
      { timeoutMs: 5000 }
    );
    return (payload?.results || []).slice(0, 20).map((item) => {
      const text = `${item.title} ${item.metadata?.description || ""}`;
      const pos = item.votes?.positive ?? 0;
      const neg = item.votes?.negative ?? 0;
      return {
        id: `cp-${item.id}`,
        headline: item.title,
        summary: item.metadata?.description || item.title,
        source: item.source?.title || "CryptoPanic",
        ticker: item.currencies?.map((c) => c.code) || inferTicker(text),
        sector: "Crypto",
        timestamp: item.published_at,
        url: item.url,
        type: "news",
        sentiment: pos > neg ? "bullish" : neg > pos ? "bearish" : "neutral",
        importance: inferImportance(text),
      };
    });
  } catch {
    return [];
  }
}

// ─── Whale Alert ──────────────────────────────────────────────────────────────
export async function getWhales(config) {
  return cache.remember("news:whales", 60000, async () => {
    if (!config.whaleAlertKey) return MOCK_WHALES;

    try {
      const payload = await fetchJson(
        `https://api.whale-alert.io/v1/transactions?api_key=${config.whaleAlertKey}&min_value=5000000`,
        { timeoutMs: 5000 }
      );

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

// ─── Social ───────────────────────────────────────────────────────────────────
export async function getSocial(config) {
  return cache.remember("news:social", 120000, async () => {
    const urls = config.socialRssUrls || [];
    if (urls.length === 0) return MOCK_SOCIAL;

    try {
      const xml = await fetchText(urls[0], { timeoutMs: 6000 });
      const entries = parseRssXml(xml).slice(0, 10).map((item, index) => ({
        id: `social-rss-${index}`,
        headline: item.title,
        summary: item.desc || item.title,
        source: "Social RSS",
        ticker: inferTicker(item.title),
        sector: "Social",
        timestamp: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        url: item.link,
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

// ─── Main news fetch ──────────────────────────────────────────────────────────
export async function getNews(config, filters = {}) {
  const feed = await cache.remember("news:items", 45000, async () => {
    // Fetch from all free sources in parallel
    const [ccItems, cpItems, ...rssResults] = await Promise.allSettled([
      fetchCryptoCompareNews(),
      fetchCryptoPanicNews(config),
      ...FREE_RSS_FEEDS.map((f) => fetchRssFeed(f)),
    ]);

    const allItems = [
      ...(ccItems.status === "fulfilled" ? ccItems.value : []),
      ...(cpItems.status === "fulfilled" ? cpItems.value : []),
      ...rssResults.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    ];

    if (allItems.length === 0) return MOCK_NEWS;

    return dedupeNews(allItems)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 120);
  });

  return applyFilters(feed, filters);
}

export async function getNewsFeed(config) {
  return cache.remember("news:feed", 45000, async () => {
    const [news, whales, social] = await Promise.all([
      getNews(config),
      getWhales(config),
      getSocial(config),
    ]);
    return { news, whales, social };
  });
}

export { dedupeNews };
