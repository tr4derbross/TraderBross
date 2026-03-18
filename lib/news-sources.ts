// TraderBross News System v2.0 — Zero-Key sources
// RSS and social feed configuration — no API keys required.

export interface RSSSourceConfig {
  url: string;
  name: string;
  category: "news" | "social";
}

// ── Primary news RSS feeds ─────────────────────────────────────────────────────

export const RSS_SOURCES: RSSSourceConfig[] = [
  { url: "https://cointelegraph.com/rss",               name: "CoinTelegraph", category: "news" },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/", name: "CoinDesk",      category: "news" },
  { url: "https://thedefiant.io/api/feed",              name: "The Defiant",   category: "news" },
  { url: "https://decrypt.co/feed",                     name: "Decrypt",       category: "news" },
  { url: "https://bitcoinmagazine.com/.rss/full/",      name: "Bitcoin Mag",   category: "news" },
  { url: "https://www.theblock.co/rss.xml",             name: "The Block",     category: "news" },
];

// ── Social (Nitter) RSS feeds ──────────────────────────────────────────────────

export const SOCIAL_SOURCES: RSSSourceConfig[] = [
  { url: "https://nitter.net/WuBlockchain/rss",   name: "@WuBlockchain",   category: "social" },
  { url: "https://nitter.net/lookonchain/rss",    name: "@lookonchain",    category: "social" },
  { url: "https://nitter.net/DocumentingBTC/rss", name: "@DocumentingBTC", category: "social" },
  { url: "https://nitter.net/CryptoHayes/rss",    name: "@CryptoHayes",   category: "social" },
  { url: "https://nitter.net/Cointelegraph/rss",  name: "@Cointelegraph",  category: "social" },
];

// ── Nitter → RSSHub fallback ───────────────────────────────────────────────────

/**
 * Convert a Nitter RSS URL to an rsshub.app fallback URL.
 * Used when Nitter returns 403 or is unreachable.
 *
 * Example:
 *   "https://nitter.net/WuBlockchain/rss"
 *   → "https://rsshub.app/twitter/user/WuBlockchain"
 */
export function nitterToRssHub(nitterUrl: string): string {
  const username = nitterUrl.match(/nitter\.net\/(\w+)/)?.[1];
  return `https://rsshub.app/twitter/user/${username ?? ""}`;
}

// ── Legacy exports (kept for backwards compatibility with news-service.ts) ─────

export interface RSSFeedConfig {
  id: string;
  name: string;
  url: string;
  sector: string;
}

/** @deprecated Use RSS_SOURCES instead. Kept for legacy news-service.ts. */
export const RSS_NEWS_FEEDS: RSSFeedConfig[] = RSS_SOURCES.map((src) => ({
  id: src.name.toLowerCase().replace(/\s+/g, "-"),
  name: src.name,
  url: src.url,
  sector: "Crypto",
}));

/** @deprecated Kept for legacy news-service.ts. */
export const CRYPTOCOMPARE_NEWS_URL =
  "https://min-api.cryptocompare.com/data/news/?lang=EN&sortOrder=latest";

/** @deprecated Kept for legacy news-service.ts. */
export function nitterRssUrl(baseUrl: string, handle: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return `${clean}/${handle}/rss`;
}

/** @deprecated Kept for legacy app/api/whale/route.ts. */
export const WHALE_ALERT_URL =
  "https://api.whale-alert.io/v1/transactions?min_value=500000&limit=10";

export interface SocialAccountConfig {
  handle: string;
  displayName: string;
  category: string;
  substackUrl?: string;
}

/** @deprecated Kept for legacy app/api/social/route.ts. */
export const SOCIAL_ACCOUNTS: SocialAccountConfig[] = [
  { handle: "VitalikButerin",    displayName: "Vitalik Buterin",          category: "dev",      substackUrl: "https://vitalik.eth.limo/feed.xml"     },
  { handle: "hasufl",            displayName: "Hasu",                     category: "dev",      substackUrl: "https://uncommoncore.co/feed/"          },
  { handle: "michael_saylor",    displayName: "Michael Saylor",           category: "ceo"                                                            },
  { handle: "cz_binance",        displayName: "CZ Binance",               category: "ceo"                                                            },
  { handle: "brian_armstrong",   displayName: "Brian Armstrong",          category: "ceo"                                                            },
  { handle: "APompliano",        displayName: "Anthony Pompliano",        category: "analyst",  substackUrl: "https://pomp.substack.com/feed"         },
  { handle: "CryptoHayes",       displayName: "Arthur Hayes",             category: "analyst",  substackUrl: "https://cryptohayes.substack.com/feed" },
  { handle: "RaoulGMI",          displayName: "Raoul Pal",                category: "analyst",  substackUrl: "https://realvision.substack.com/feed"  },
  { handle: "woonomic",          displayName: "Willy Woo",                category: "analyst"                                                        },
  { handle: "100trillionUSD",    displayName: "PlanB",                    category: "analyst"                                                        },
  { handle: "nic__carter",       displayName: "Nic Carter",               category: "analyst",  substackUrl: "https://niccarter.substack.com/feed"   },
  { handle: "lookonchain",       displayName: "Lookonchain",              category: "onchain"                                                        },
  { handle: "DocumentingBTC",    displayName: "DocumentingBTC",           category: "onchain"                                                        },
  { handle: "whale_alert",       displayName: "Whale Alert",              category: "onchain"                                                        },
  { handle: "BitcoinMagazine",   displayName: "Bitcoin Magazine",         category: "media"                                                          },
  { handle: "Cointelegraph",     displayName: "CoinTelegraph",            category: "media"                                                          },
  { handle: "Bankless__",        displayName: "Bankless",                 category: "media",    substackUrl: "https://banklesshq.substack.com/feed"  },
];
