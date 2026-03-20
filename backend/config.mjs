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

export function loadConfig() {
  return {
    apiHost: process.env.API_HOST || DEFAULT_API_HOST,
    apiPort: toNumber(process.env.PORT || process.env.API_PORT, DEFAULT_API_PORT),
    logLevel: process.env.LOG_LEVEL || "info",
    frontendOrigins: parseOrigins(process.env.CORS_ORIGINS),
    cryptopanicKey: process.env.CRYPTOPANIC_KEY || "",
    whaleAlertKey: process.env.WHALE_ALERT_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
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
      newsFeedMs: toNumber(process.env.TTL_NEWS_FEED_MS, 60_000),
      whaleScanMs: toNumber(process.env.TTL_WHALE_SCAN_MS, 75_000),
      discoveryMs: toNumber(process.env.TTL_DISCOVERY_MS, 45_000),
      fundingMs: toNumber(process.env.TTL_FUNDING_MS, 20_000),
      leverageBracketsMs: toNumber(process.env.TTL_LEVERAGE_BRACKETS_MS, 6 * 60 * 60 * 1000),
      lsrMs: toNumber(process.env.TTL_LSR_MS, 30_000),
      coincapMs: toNumber(process.env.TTL_COINCAP_MS, 60_000),
    },
    whaleFallback: {
      minUsd: toNumber(process.env.WHALE_FALLBACK_MIN_USD, 250_000),
      symbols: (process.env.WHALE_FALLBACK_SYMBOLS || "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT")
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean),
    },
  };
}
