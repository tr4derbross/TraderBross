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

export function loadConfig() {
  return {
    apiHost: process.env.API_HOST || DEFAULT_API_HOST,
    apiPort: toNumber(process.env.API_PORT, DEFAULT_API_PORT),
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
    nitterBaseUrl: process.env.NITTER_BASE_URL || "",
  };
}
