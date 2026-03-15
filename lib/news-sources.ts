// News source configuration for the trading terminal

export interface RSSFeedConfig {
  id: string;
  name: string;
  url: string;
  sector: string;
}

export interface SocialAccountConfig {
  handle: string;      // @username (without @)
  displayName: string;
  category: string;    // "dev" | "ceo" | "analyst" | "media" | "onchain"
  substackUrl?: string; // RSS URL if they have a Substack/blog
}

// ─── Free RSS News Feeds (no API key needed) ──────────────────────────────────
export const RSS_NEWS_FEEDS: RSSFeedConfig[] = [
  // Tier 1
  { id: "cointelegraph",    name: "CoinTelegraph",   url: "https://cointelegraph.com/rss",                          sector: "Crypto" },
  { id: "coindesk",         name: "CoinDesk",         url: "https://www.coindesk.com/arc/outboundfeeds/rss",         sector: "Bitcoin" },
  { id: "decrypt",          name: "Decrypt",          url: "https://decrypt.co/feed",                                sector: "DeFi" },
  { id: "bitcoinmagazine",  name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/",                 sector: "Bitcoin" },
  { id: "theblock",         name: "The Block",        url: "https://www.theblock.co/rss.xml",                        sector: "Crypto" },
  { id: "cryptobriefing",   name: "Crypto Briefing",  url: "https://cryptobriefing.com/feed/",                       sector: "Crypto" },
  // Additional free sources
  { id: "cryptopanic-rss",  name: "CryptoPanic",      url: "https://cryptopanic.com/news/rss/",                      sector: "Crypto" },
  { id: "beincrypto",       name: "BeInCrypto",       url: "https://beincrypto.com/feed/",                           sector: "Crypto" },
  { id: "bitcoincom",       name: "Bitcoin.com",      url: "https://news.bitcoin.com/feed/",                         sector: "Bitcoin" },
  { id: "cryptoslate",      name: "CryptoSlate",      url: "https://cryptoslate.com/feed/",                          sector: "Crypto" },
  { id: "utoday",           name: "U.Today",          url: "https://u.today/rss",                                    sector: "Crypto" },
  { id: "ambcrypto",        name: "AMBCrypto",        url: "https://ambcrypto.com/feed/",                            sector: "Crypto" },
  { id: "blockworks",       name: "Blockworks",       url: "https://blockworks.co/feed",                             sector: "Institutional" },
  { id: "dailyhodl",        name: "The Daily Hodl",   url: "https://dailyhodl.com/feed/",                            sector: "Crypto" },
];

// ─── CryptoCompare News API (100K requests/month free) ────────────────────────
export const CRYPTOCOMPARE_NEWS_URL =
  "https://min-api.cryptocompare.com/data/news/?lang=EN&sortOrder=latest";

// ─── Whale Alert API (free tier: 10 calls/min, tx > $500K) ───────────────────
export const WHALE_ALERT_URL =
  "https://api.whale-alert.io/v1/transactions?min_value=500000&limit=10";

// ─── Top Crypto Twitter/X Accounts ────────────────────────────────────────────
// These are fetched via Nitter RSS (set NITTER_BASE_URL in .env.local)
// OR via their Substack/blog RSS (substackUrl)
export const SOCIAL_ACCOUNTS: SocialAccountConfig[] = [
  // Founders / Devs
  { handle: "VitalikButerin",   displayName: "Vitalik Buterin",    category: "dev",     substackUrl: "https://vitalik.eth.limo/feed.xml" },
  { handle: "gakonst",          displayName: "Georgios Konstantopoulos", category: "dev" },
  // CEOs / Business
  { handle: "michael_saylor",   displayName: "Michael Saylor",     category: "ceo"  },
  { handle: "cz_binance",       displayName: "CZ Binance",         category: "ceo"  },
  { handle: "brian_armstrong",  displayName: "Brian Armstrong",    category: "ceo"  },
  // Macro / Analysts
  { handle: "APompliano",       displayName: "Anthony Pompliano",  category: "analyst", substackUrl: "https://pomp.substack.com/feed" },
  { handle: "CryptoHayes",      displayName: "Arthur Hayes",       category: "analyst", substackUrl: "https://cryptohayes.substack.com/feed" },
  { handle: "RaoulGMI",         displayName: "Raoul Pal",          category: "analyst" },
  { handle: "woonomic",         displayName: "Willy Woo",          category: "analyst" },
  { handle: "100trillionUSD",   displayName: "PlanB",              category: "analyst" },
  // On-chain / Alerts
  { handle: "lookonchain",      displayName: "Lookonchain",        category: "onchain" },
  { handle: "DocumentingBTC",   displayName: "DocumentingBTC",     category: "onchain" },
  { handle: "whale_alert",      displayName: "Whale Alert",        category: "onchain" },
  // Media
  { handle: "BitcoinMagazine",  displayName: "Bitcoin Magazine",   category: "media" },
  { handle: "Cointelegraph",    displayName: "CoinTelegraph",      category: "media" },
];

// Build Nitter RSS URL for an account
export function nitterRssUrl(baseUrl: string, handle: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return `${clean}/${handle}/rss`;
}
