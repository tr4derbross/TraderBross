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
  // Tier 1 — established crypto media
  { id: "cointelegraph",    name: "CoinTelegraph",    url: "https://cointelegraph.com/rss",                           sector: "Crypto"       },
  { id: "coindesk",         name: "CoinDesk",          url: "https://www.coindesk.com/arc/outboundfeeds/rss",          sector: "Bitcoin"      },
  { id: "decrypt",          name: "Decrypt",           url: "https://decrypt.co/feed",                                 sector: "DeFi"         },
  { id: "bitcoinmagazine",  name: "Bitcoin Magazine",  url: "https://bitcoinmagazine.com/.rss/full/",                  sector: "Bitcoin"      },
  { id: "theblock",         name: "The Block",         url: "https://www.theblock.co/rss.xml",                         sector: "Crypto"       },
  { id: "blockworks",       name: "Blockworks",        url: "https://blockworks.co/feed",                              sector: "Institutional"},
  // Tier 2 — active aggregators & reporters
  { id: "beincrypto",       name: "BeInCrypto",        url: "https://beincrypto.com/feed/",                            sector: "Crypto"       },
  { id: "cryptoslate",      name: "CryptoSlate",       url: "https://cryptoslate.com/feed/",                           sector: "Crypto"       },
  { id: "cryptobriefing",   name: "Crypto Briefing",   url: "https://cryptobriefing.com/feed/",                        sector: "Crypto"       },
  { id: "newsbtc",          name: "NewsBTC",            url: "https://www.newsbtc.com/feed/",                           sector: "Bitcoin"      },
  { id: "cryptonews",       name: "CryptoNews",        url: "https://cryptonews.com/news/feed/",                       sector: "Crypto"       },
  { id: "dailyhodl",        name: "The Daily Hodl",    url: "https://dailyhodl.com/feed/",                             sector: "Crypto"       },
  { id: "bitcoincom",       name: "Bitcoin.com",       url: "https://news.bitcoin.com/feed/",                          sector: "Bitcoin"      },
  { id: "utoday",           name: "U.Today",           url: "https://u.today/rss",                                     sector: "Crypto"       },
  { id: "ambcrypto",        name: "AMBCrypto",         url: "https://ambcrypto.com/feed/",                             sector: "Crypto"       },
  { id: "cryptopanic-rss",  name: "CryptoPanic",       url: "https://cryptopanic.com/news/rss/",                       sector: "Crypto"       },
  // Research / Analytics
  { id: "messari",          name: "Messari",           url: "https://messari.io/rss",                                  sector: "Institutional"},
  { id: "thedefiant",       name: "The Defiant",       url: "https://thedefiant.io/feed",                              sector: "DeFi"         },
  { id: "protos",           name: "Protos",            url: "https://protos.com/feed/",                                sector: "Crypto"       },
  { id: "unchained",        name: "Unchained",         url: "https://unchainedcrypto.com/feed/",                       sector: "Institutional"},
  { id: "coinjournal",      name: "CoinJournal",       url: "https://coinjournal.net/feed/",                           sector: "Crypto"       },
  // DeFi focus
  { id: "bankless",         name: "Bankless",          url: "https://banklesshq.substack.com/feed",                    sector: "DeFi"         },
  { id: "defirate",         name: "DeFi Rate",         url: "https://defirate.com/feed/",                              sector: "DeFi"         },
];

// ─── CryptoCompare News API (100K requests/month free) ────────────────────────
export const CRYPTOCOMPARE_NEWS_URL =
  "https://min-api.cryptocompare.com/data/news/?lang=EN&sortOrder=latest";

// ─── Whale Alert API (free tier: 10 calls/min, tx > $500K) ───────────────────
export const WHALE_ALERT_URL =
  "https://api.whale-alert.io/v1/transactions?min_value=500000&limit=10";

// ─── Top Crypto Twitter/X Accounts ────────────────────────────────────────────
// Fetched via Nitter RSS (set NITTER_BASE_URL in .env.local) OR Substack/blog RSS
export const SOCIAL_ACCOUNTS: SocialAccountConfig[] = [
  // Founders / Devs
  { handle: "VitalikButerin",    displayName: "Vitalik Buterin",         category: "dev",      substackUrl: "https://vitalik.eth.limo/feed.xml"              },
  { handle: "gakonst",           displayName: "Georgios Konstantopoulos",category: "dev"                                                                     },
  { handle: "hasufl",            displayName: "Hasu",                    category: "dev",      substackUrl: "https://uncommoncore.co/feed/"                  },
  // CEOs / Business
  { handle: "michael_saylor",    displayName: "Michael Saylor",          category: "ceo"                                                                     },
  { handle: "cz_binance",        displayName: "CZ Binance",              category: "ceo"                                                                     },
  { handle: "brian_armstrong",   displayName: "Brian Armstrong",         category: "ceo"                                                                     },
  { handle: "cburniske",         displayName: "Chris Burniske",          category: "analyst",  substackUrl: "https://placeholder.substack.com/feed"           },
  // Macro / Analysts
  { handle: "APompliano",        displayName: "Anthony Pompliano",       category: "analyst",  substackUrl: "https://pomp.substack.com/feed"                 },
  { handle: "CryptoHayes",       displayName: "Arthur Hayes",            category: "analyst",  substackUrl: "https://cryptohayes.substack.com/feed"          },
  { handle: "RaoulGMI",          displayName: "Raoul Pal",               category: "analyst",  substackUrl: "https://realvision.substack.com/feed"           },
  { handle: "woonomic",          displayName: "Willy Woo",               category: "analyst"                                                                 },
  { handle: "100trillionUSD",    displayName: "PlanB",                   category: "analyst"                                                                 },
  { handle: "ErikVoorhees",      displayName: "Erik Voorhees",           category: "analyst"                                                                 },
  { handle: "nic__carter",       displayName: "Nic Carter",              category: "analyst",  substackUrl: "https://niccarter.substack.com/feed"            },
  { handle: "ljxie",             displayName: "Linda Xie",               category: "analyst"                                                                 },
  // On-chain / Alerts
  { handle: "lookonchain",       displayName: "Lookonchain",             category: "onchain"                                                                 },
  { handle: "DocumentingBTC",    displayName: "DocumentingBTC",          category: "onchain"                                                                 },
  { handle: "whale_alert",       displayName: "Whale Alert",             category: "onchain"                                                                 },
  { handle: "ai_9684xtpa",       displayName: "AI 9684xtpa",             category: "onchain"                                                                 },
  // Media
  { handle: "BitcoinMagazine",   displayName: "Bitcoin Magazine",        category: "media"                                                                   },
  { handle: "Cointelegraph",     displayName: "CoinTelegraph",           category: "media"                                                                   },
  { handle: "TheBlock__",        displayName: "The Block",               category: "media"                                                                   },
  { handle: "Bankless__",        displayName: "Bankless",                category: "media",    substackUrl: "https://banklesshq.substack.com/feed"           },
];

// Build Nitter RSS URL for an account
export function nitterRssUrl(baseUrl: string, handle: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return `${clean}/${handle}/rss`;
}
