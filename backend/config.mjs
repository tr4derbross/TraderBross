const DEFAULT_API_PORT = 4001;
const DEFAULT_API_HOST = "0.0.0.0";
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3000";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function parseOrigins(value) {
  if (!value) {
    return [DEFAULT_FRONTEND_ORIGIN];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(trimSlash);
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

function isProductionNodeEnv() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function parseCsvList(value, fallback = []) {
  const out = String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return out.length > 0 ? out : fallback;
}

function applyFreeTierOverrides(config, env = process.env) {
  const freeTierMode = toBoolean(env.FREE_TIER_MODE, false);
  if (!freeTierMode) return { ...config, freeTierMode: false };

  return {
    ...config,
    freeTierMode: true,
    featureFlags: {
      ...config.featureFlags,
      enableNewsRss: true,
      enableNewsJson: true,
      enableNewsTree: true,
      // WS mode typically needs an API key/login flow; keep free mode on delayed history by default.
      enableNewsTreeWs: false,
      enableWhaleApi: false,
      enableWhaleEngine: true,
      enableCoinGeckoMarket: true,
      enableCoinGeckoMetadata: true,
      enableCoincap: true,
      enableCoinpaprika: true,
      enableCoinlore: true,
    },
    enableDefaultSocialFeeds: true,
  };
}

export function loadConfig() {
  const baseConfig = {
    apiHost: process.env.API_HOST || DEFAULT_API_HOST,
    apiPort: toNumber(process.env.PORT || process.env.API_PORT, DEFAULT_API_PORT),
    logLevel: process.env.LOG_LEVEL || "info",
    frontendOrigins: parseOrigins(process.env.CORS_ORIGINS),
    cryptopanicKey: process.env.CRYPTOPANIC_KEY || "",
    cryptocompareApiKey: process.env.CRYPTOCOMPARE_API_KEY || process.env.CRYPTOCOMPARE_KEY || "",
    treeNewsApiKey: process.env.TREE_NEWS_API_KEY || "",
    ninjaNewsGraphqlUrl: process.env.NINJA_NEWS_GRAPHQL_URL || "https://api-alpha.ninjanews.io/graphql",
    whaleAlertKey: process.env.WHALE_ALERT_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    ai: {
      allowExternal: toBoolean(process.env.AI_ALLOW_EXTERNAL, false),
      maxRequestsPerMinute: toNumber(process.env.AI_MAX_REQUESTS_PER_MINUTE, 12),
      maxRequestsPerDay: toNumber(process.env.AI_MAX_REQUESTS_PER_DAY, 200),
      timeoutMs: toNumber(process.env.AI_PROVIDER_TIMEOUT_MS, 5000),
      maxOutputTokens: toNumber(process.env.AI_MAX_OUTPUT_TOKENS, 220),
      maxInputChars: toNumber(process.env.AI_MAX_INPUT_CHARS, 2400),
      groqModel: process.env.AI_GROQ_MODEL || "llama-3.3-70b-versatile",
      geminiModel: process.env.AI_GEMINI_MODEL || "gemini-1.5-flash",
      openrouterModels: parseCsvList(
        process.env.AI_OPENROUTER_MODELS,
        ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"],
      ),
      openrouterReferer: process.env.AI_OPENROUTER_REFERER || "https://trader-bross.vercel.app",
      openrouterTitle: process.env.AI_OPENROUTER_TITLE || "TraderBross Terminal",
      quotaCooldownMs: toNumber(process.env.AI_QUOTA_COOLDOWN_MS, 60 * 60 * 1000),
    },
    okxApiKey: process.env.OKX_API_KEY || "",
    okxSecret: process.env.OKX_SECRET || "",
    okxPassphrase: process.env.OKX_PASSPHRASE || "",
    bybitApiKey: process.env.BYBIT_API_KEY || "",
    bybitSecret: process.env.BYBIT_SECRET || "",
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || "",
    socialRssUrls: (process.env.SOCIAL_RSS_URLS || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    socialTwitterHandles: parseCsvList(
      process.env.SOCIAL_TWITTER_HANDLES,
      ["wublockchain", "tier10k", "lookonchain", "treenewsfeed", "unusual_whales", "glassnode", "santimentfeed", "coindesk"],
    ),
    socialRedditSubreddits: parseCsvList(
      process.env.SOCIAL_REDDIT_SUBREDDITS,
      ["CryptoCurrency", "Bitcoin", "ethereum", "CryptoMarkets", "ethfinance", "solana", "defi"],
    ),
    socialNitterInstances: parseCsvList(
      process.env.SOCIAL_NITTER_INSTANCES,
      ["https://nitter.net", "https://nitter.privacydev.net"],
    ),
    enableDefaultSocialFeeds: toBoolean(process.env.FEATURE_SOCIAL_DEFAULT_FEEDS, true),
    nitterBaseUrl: process.env.NITTER_BASE_URL || "",
    coinMarketCalApiKey: process.env.COINMARKETCAL_API_KEY || "",
    watchlistTickers: (process.env.WATCHLIST_TICKERS || "BTC,ETH,SOL,BNB,XRP")
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean),
    featureFlags: {
      enableCoinGeckoMarket: toBoolean(process.env.FEATURE_COINGECKO_MARKET, true),
      enableCoinGeckoMetadata: toBoolean(process.env.FEATURE_COINGECKO_METADATA, true),
      enableDexScreener: toBoolean(process.env.FEATURE_DEXSCREENER_DISCOVERY, true),
      enableNewsRss: toBoolean(process.env.FEATURE_NEWS_RSS, true),
      enableNewsJson: toBoolean(process.env.FEATURE_NEWS_JSON, true),
      enableNewsExchangeAnnouncements: toBoolean(process.env.FEATURE_NEWS_EXCHANGE_ANNOUNCEMENTS, true),
      enableNewsTree: toBoolean(process.env.FEATURE_NEWS_TREE, true),
      enableNewsTreeWs: toBoolean(process.env.FEATURE_NEWS_TREE_WS, true),
      enableNewsNinja: toBoolean(process.env.FEATURE_NEWS_NINJA, true),
      enableWhaleApi: toBoolean(process.env.FEATURE_WHALE_ALERT, true),
      enableWhaleEngine: toBoolean(process.env.FEATURE_WHALE_ENGINE, true),
      enableHyperliquidWs: toBoolean(process.env.FEATURE_HYPERLIQUID_WS, true),
      enableBinanceFunding: toBoolean(process.env.FEATURE_BINANCE_FUNDING, true),
      enableCoincap: toBoolean(process.env.FEATURE_COINCAP, true),
      enableCoinpaprika: toBoolean(process.env.FEATURE_COINPAPRIKA, true),
      enableCoinlore: toBoolean(process.env.FEATURE_COINLORE, true),
    },
    dataTtl: {
      marketSnapshotMs: toNumber(process.env.TTL_MARKET_SNAPSHOT_MS, 20_000),
      coinMetadataMs: toNumber(process.env.TTL_COIN_METADATA_MS, 6 * 60 * 60 * 1000),
      newsFeedMs: toNumber(process.env.TTL_NEWS_FEED_MS, 45_000),
      exchangeAnnouncementsLimit: toNumber(process.env.EXCHANGE_ANNOUNCEMENTS_LIMIT, 30),
      newsFreshWindowSec: toNumber(process.env.NEWS_FRESH_WINDOW_SEC, 900),
      socialFreshWindowSec: toNumber(process.env.SOCIAL_FRESH_WINDOW_SEC, 900),
      treeNewsLimit: toNumber(process.env.TREE_NEWS_LIMIT, 1000),
      ninjaNewsLimit: toNumber(process.env.NINJA_NEWS_LIMIT, 30),
      whaleScanMs: toNumber(process.env.TTL_WHALE_SCAN_MS, 75_000),
      discoveryMs: toNumber(process.env.TTL_DISCOVERY_MS, 45_000),
      fundingMs: toNumber(process.env.TTL_FUNDING_MS, 20_000),
      leverageBracketsMs: toNumber(process.env.TTL_LEVERAGE_BRACKETS_MS, 6 * 60 * 60 * 1000),
      lsrMs: toNumber(process.env.TTL_LSR_MS, 30_000),
      coincapMs: toNumber(process.env.TTL_COINCAP_MS, 60_000),
    },
    whaleFallback: {
      minUsd: toNumber(process.env.WHALE_FALLBACK_MIN_USD, 1_000_000),
      minIntervalMs: toNumber(process.env.WHALE_FALLBACK_MIN_INTERVAL_MS, 2500),
      symbols: (process.env.WHALE_FALLBACK_SYMBOLS || "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT")
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean),
    },
    rateLimit: {
      redisUrl: process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || "",
      prefix: process.env.RATE_LIMIT_PREFIX || "traderbross:ratelimit",
    },
    upstash: {
      restUrl: process.env.UPSTASH_REDIS_REST_URL || "",
      restToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
      prefix: process.env.UPSTASH_CACHE_PREFIX || "traderbross:cache",
      ttl: {
        bootstrapSec: toNumber(process.env.UPSTASH_CACHE_BOOTSTRAP_TTL_SEC, 2),
        newsSec: toNumber(process.env.UPSTASH_CACHE_NEWS_TTL_SEC, 3),
        pricesSec: toNumber(process.env.UPSTASH_CACHE_PRICES_TTL_SEC, 5),
      },
    },
    security: {
      proxyAuthEnabled: toBoolean(process.env.REQUIRE_PROXY_AUTH, isProductionNodeEnv()),
      proxyAuthHeader: process.env.PROXY_AUTH_HEADER || "x-traderbross-proxy-secret",
      proxyAuthSecret: process.env.PROXY_SHARED_SECRET || "",
      requireProxyMarker: toBoolean(process.env.REQUIRE_PROXY_MARKER, true),
      allowSensitiveOriginBypass: toBoolean(process.env.ALLOW_SENSITIVE_ORIGIN_BYPASS, false),
    },
  };
  return applyFreeTierOverrides(baseConfig, process.env);
}
