import { NextRequest } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWalletSessionCookieName, type WalletTier, verifyWalletSessionToken } from "@/lib/wallet-auth";
import { isWalletSessionRevoked } from "@/lib/wallet-session-revocation";
import { getWalletTier } from "@/lib/wallet-subscriptions";
import { getClientIp, rateLimitAsync } from "@/lib/rate-limit";
import { hasValidCsrfToken } from "@/lib/request-security";

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:4001";
const DEFAULT_PROD_BACKEND = "https://traderbross-production.up.railway.app";
const EMERGENCY_CACHE_TTL_MS = 45_000;
const MUTATION_PROXY_TIMEOUT_MS = 30_000;
const MAX_MUTATION_PROXY_BODY_BYTES = 1024 * 1024; // 1 MB
const emergencyCache = new Map<string, { expiresAt: number; value: unknown }>();
type Tier = WalletTier;
const TIER_ORDER: Tier[] = ["free", "dex", "full"];
const FULL_TIER_PATH_PREFIXES = [
  "/api/vault/status",
  "/api/venues/validate",
  "/api/binance",
  "/api/binance/order",
  "/api/okx",
  "/api/okx/order",
  "/api/bybit",
  "/api/bybit/order",
];
const DEX_TIER_PATH_PREFIXES = [
  "/api/hyperliquid/order",
];
const SENSITIVE_PROXY_PATH_PREFIXES = [
  "/api/vault/store",
  "/api/vault/clear",
  "/api/vault/status",
  "/api/venues/validate",
  "/api/binance",
  "/api/binance/order",
  "/api/okx",
  "/api/okx/order",
  "/api/bybit",
  "/api/bybit/order",
  "/api/hyperliquid/order",
];
const ALLOWED_PROXY_METHODS = new Set(["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"]);
const SAFE_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalBackendUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return raw.includes("localhost") || raw.includes("127.0.0.1");
  }
}

function resolveBackendBaseUrl() {
  const explicit =
    process.env.BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  const isHostedProduction =
    String(process.env.NODE_ENV || "").toLowerCase() === "production" &&
    (
      String(process.env.VERCEL || "") === "1" ||
      String(process.env.RAILWAY_ENVIRONMENT || "").toLowerCase() === "production" ||
      String(process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase() === "production"
    );

  if (
    isHostedProduction &&
    explicit &&
    isLocalBackendUrl(explicit)
  ) {
    throw new Error("BACKEND_API_BASE_URL/NEXT_PUBLIC_API_BASE_URL cannot target localhost in production.");
  }

  if (explicit) return trimSlash(explicit);
  if (process.env.NODE_ENV === "production") return DEFAULT_PROD_BACKEND;
  return DEFAULT_LOCAL_BACKEND;
}

function resolveBackendCandidates() {
  const preferred = resolveBackendBaseUrl();
  const candidates = [preferred];

  if (preferred !== DEFAULT_PROD_BACKEND) {
    candidates.push(DEFAULT_PROD_BACKEND);
  }
  if (process.env.NODE_ENV !== "production" && preferred !== DEFAULT_LOCAL_BACKEND) {
    candidates.push(DEFAULT_LOCAL_BACKEND);
  }

  return Array.from(new Set(candidates.map((value) => trimSlash(value))));
}

function cloneHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");
  headers.delete("x-traderbross-proxy");
  headers.delete("x-traderbross-proxy-secret");
  return headers;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function extractTickers(text: string) {
  const matches = (String(text || "").toUpperCase().match(/\b(BTC|ETH|SOL|BNB|XRP|DOGE|AVAX|LINK|DOT|ADA|TRX)\b/g) || []);
  return Array.from(new Set(matches)).slice(0, 3);
}

function toBinanceSymbol(ticker: string, quoteAsset = "USDT") {
  const symbol = String(ticker || "BTC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const quote = String(quoteAsset || "USDT").toUpperCase() === "USDC" ? "USDC" : "USDT";
  return `${symbol || "BTC"}${quote}`;
}

async function fetchEmergencyCandles(params: { ticker?: string; interval?: string; limit?: string; quote?: string }) {
  const ticker = String(params.ticker || "BTC").toUpperCase();
  const interval = String(params.interval || "1h");
  const limit = Math.min(Math.max(Number(params.limit || 120) || 120, 10), 500);
  const symbol = toBinanceSymbol(ticker, params.quote);
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!res.ok) return [];
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    time: Math.floor(Number(row[0] || 0) / 1000),
    open: Number(row[1] || 0),
    high: Number(row[2] || 0),
    low: Number(row[3] || 0),
    close: Number(row[4] || 0),
    volume: Number(row[5] || 0),
  }));
}

async function fetchEmergencyQuotes() {
  const symbols = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "DOT", "ADA", "TRX"];
  const ids = "bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,avalanche-2,chainlink,polkadot,cardano,tron";
  const [marketsRes, globalRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }),
    fetch("https://api.coingecko.com/api/v3/global", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }),
  ]);
  const markets = marketsRes.ok ? await marketsRes.json() : [];
  const global = globalRes.ok ? await globalRes.json() : null;

  const idToSymbol: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
    solana: "SOL",
    binancecoin: "BNB",
    ripple: "XRP",
    dogecoin: "DOGE",
    "avalanche-2": "AVAX",
    chainlink: "LINK",
    polkadot: "DOT",
    cardano: "ADA",
    tron: "TRX",
  };

  const quotes = (Array.isArray(markets) ? markets : [])
    .map((row) => ({
      symbol: idToSymbol[row.id] || String(row.symbol || "").toUpperCase(),
      price: Number(row.current_price || 0),
      change: Number(row.price_change_24h || 0),
      changePct: Number(row.price_change_percentage_24h || 0),
    }))
    .filter((row) => symbols.includes(row.symbol));

  const venueQuotes = {
    Binance: quotes,
    OKX: quotes.slice(0, 6),
    Bybit: quotes.slice(0, 6),
  };

  const data = global?.data || {};
  const marketStats = {
    marketCapUsd: Number(data.total_market_cap?.usd || 0) || null,
    btcDominance: Number(data.market_cap_percentage?.btc || 0) || null,
    ethDominance: Number(data.market_cap_percentage?.eth || 0) || null,
    marketCapChange24h: Number(data.market_cap_change_percentage_24h_usd || 0) || null,
    total24hVolume: Number(data.total_volume?.usd || 0) || null,
    defiMarketCap: null,
    activeCryptos: Number(data.active_cryptocurrencies || 0) || null,
  };

  return { quotes, venueQuotes, marketStats };
}

async function fetchEmergencyNews() {
  const feeds = [
    { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    { source: "Decrypt", url: "https://decrypt.co/feed" },
  ];
  const allItems: any[] = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const block of itemBlocks.slice(0, 15)) {
        const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "#").trim();
        const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "").trim();
        const desc = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
        if (!title) continue;
        const tickers = extractTickers(`${title} ${desc}`);
        allItems.push({
          id: `rss-${feed.source.toLowerCase()}-${Math.abs(hashCode(title + link))}`,
          headline: title,
          summary: desc.slice(0, 320),
          source: feed.source,
          ticker: tickers,
          sector: tickers[0] || "Crypto",
          timestamp: new Date(pubDate || Date.now()).toISOString(),
          url: link || "#",
          type: "news",
          sentiment: "neutral",
          importance: "market-moving",
          relatedAssets: tickers,
          watchlistRelevance: tickers.length > 0 ? 72 : 15,
          relevanceLabels: tickers.length > 0 ? ["watchlist_hit", "direct_exposure"] : ["low_relevance"],
          priorityLabel: tickers.length > 0 ? "watchlist hit" : "low relevance",
        });
      }
    } catch {
      // continue
    }
  }

  allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return allItems.slice(0, 80);
}

function hashCode(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return h;
}

function readEmergencyCache<T>(key: string): T | null {
  const hit = emergencyCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    emergencyCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function writeEmergencyCache(key: string, value: unknown, ttlMs = EMERGENCY_CACHE_TTL_MS) {
  emergencyCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function stripHtml(input: string) {
  return String(input || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactBootstrapPayload(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  const news = Array.isArray(payload.news) ? payload.news.slice(0, 32) : [];
  const social = Array.isArray(payload.social) ? payload.social.slice(0, 36) : [];
  const whales = Array.isArray(payload.whales) ? payload.whales.slice(0, 20) : [];
  const liquidations = Array.isArray(payload.liquidations) ? payload.liquidations.slice(0, 40) : [];
  const discovery: any[] = [];
  const snapshotItems = Array.isArray(payload?.newsSnapshot?.items) ? payload.newsSnapshot.items.slice(0, 80) : [];
  return {
    ...payload,
    news,
    social,
    whales,
    whaleEvents: [],
    liquidations,
    discovery,
    coinMetadata: {},
    newsSnapshot: payload.newsSnapshot
      ? {
          ...payload.newsSnapshot,
          items: snapshotItems,
          count: payload.newsSnapshot.count ?? snapshotItems.length,
        }
      : payload.newsSnapshot,
  };
}

async function buildEmergencyBootstrap(options: { lite?: boolean } = {}) {
  const [market, news, social] = await Promise.all([fetchEmergencyQuotes(), fetchEmergencyNews(), fetchEmergencySocial()]);
  const lite = options.lite !== false;
  const newsItems = lite ? news.slice(0, 40) : news;
  const socialItems = lite ? social.slice(0, 48) : social;
  return {
    quotes: market.quotes,
    venueQuotes: market.venueQuotes,
    marketStats: market.marketStats,
    mempoolStats: null,
    fearGreed: null,
    ethGas: null,
    defiTvl: null,
    forex: null,
    liquidations: [],
    news: newsItems,
    whales: [],
    whaleEvents: [],
    social: socialItems,
    newsSnapshot: {
      generatedAt: new Date().toISOString(),
      count: newsItems.length,
      items: newsItems.map((n) => ({
        kind: "news",
        id: n.id,
        source: n.source,
        title: n.headline,
        summary: n.summary,
        url: n.url,
        publishedAt: n.timestamp,
        tickers: n.ticker,
        relatedAssets: n.relatedAssets,
        tags: [],
        priority: { score: n.watchlistRelevance || 30, label: "medium", components: { source: 8, recency: 8, keyword: 6, watchlist: 8 } },
        priorityLabel: n.priorityLabel,
        sentiment: "neutral",
        watchlistRelevance: n.watchlistRelevance || 0,
        relevanceLabels: n.relevanceLabels || [],
        eventType: "watchlist",
      })),
      clusters: [],
      status: newsItems.length > 0 ? "ok" : "empty",
      errors: [],
    },
    coinMetadata: {},
    discovery: [],
    providerState: {
      emergency_fallback: "ok",
    },
    providerHealth: {
      emergency_fallback: {
        status: "ok",
        providerCalls: 1,
        cacheHits: 0,
        staleServed: 0,
        lastSuccessAt: new Date().toISOString(),
        lastErrorAt: null,
        lastError: null,
      },
    },
    connectionState: "degraded",
  };
}

async function fetchEmergencySocial() {
  const feeds = [
    { source: "Reddit r/CryptoCurrency", url: "https://www.reddit.com/r/CryptoCurrency/.rss" },
    { source: "Reddit r/Bitcoin", url: "https://www.reddit.com/r/Bitcoin/.rss" },
    { source: "Reddit r/ethfinance", url: "https://www.reddit.com/r/ethfinance/.rss" },
  ];
  const allItems: any[] = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      for (const block of entryBlocks.slice(0, 12)) {
        const title = stripHtml(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
        const link =
          (block.match(/<link[^>]+href=\"([^\"]+)\"/i)?.[1] || block.match(/<id>([\s\S]*?)<\/id>/i)?.[1] || "#").trim();
        const publishedAt = (block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] || new Date().toISOString()).trim();
        const summary = stripHtml(
          block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
            block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
            "",
        );
        if (!title) continue;
        const tickers = extractTickers(`${title} ${summary}`);
        allItems.push({
          id: `social-rss-${Math.abs(hashCode(`${feed.source}:${title}:${link}`))}`,
          headline: title,
          summary: summary.slice(0, 320),
          source: feed.source,
          ticker: tickers,
          sector: tickers[0] || "Crypto",
          timestamp: new Date(publishedAt).toISOString(),
          url: link || "#",
          type: "social",
          sentiment: "neutral",
          importance: "watch",
          relatedAssets: tickers,
          watchlistRelevance: tickers.length > 0 ? 55 : 20,
          relevanceLabels: tickers.length > 0 ? ["watchlist_hit"] : ["low_relevance"],
          priorityLabel: tickers.length > 0 ? "watchlist hit" : "low relevance",
        });
      }
    } catch {
      // continue
    }
  }

  allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return allItems.slice(0, 80);
}

function buildEmergencyScreenerFromQuotes(quotes: Array<{ symbol: string; price: number; changePct: number }>, sort: string) {
  const rows = quotes.map((q) => ({
    symbol: q.symbol,
    name: q.symbol,
    price: q.price,
    change24h: q.changePct,
    volume24h: Math.max(100_000, Math.abs(q.price * 120_000)),
    trades24h: Math.max(100, Math.round(Math.abs(q.price * 80))),
    marketCap: Math.max(1_000_000, Math.abs(q.price * 1_000_000)),
    high24h: q.price * 1.03,
    low24h: q.price * 0.97,
    rsi14: 45 + (q.changePct % 20),
    openInterestUsd: Math.max(50_000, Math.abs(q.price * 300_000)),
    longShortRatio: 1 + q.changePct / 100,
  }));
  if (sort === "gainers") return rows.sort((a, b) => b.change24h - a.change24h);
  if (sort === "losers") return rows.sort((a, b) => a.change24h - b.change24h);
  return rows.sort((a, b) => b.volume24h - a.volume24h);
}

async function fetchEmergencyScreenerRows(sort: string) {
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`Binance ticker failed: ${res.status}`);
    const payload = await res.json();
    const rows = (Array.isArray(payload) ? payload : [])
      .map((row: any) => {
        const symbolRaw = String(row?.symbol || "").toUpperCase();
        if (!symbolRaw.endsWith("USDT")) return null;
        const symbol = symbolRaw.replace(/USDT$/i, "");
        const price = Number(row?.lastPrice || 0);
        const change24h = Number(row?.priceChangePercent || 0);
        const volume24h = Number(row?.quoteVolume || 0);
        const high24h = Number(row?.highPrice || 0);
        const low24h = Number(row?.lowPrice || 0);
        const trades24h = Number(row?.count || 0);
        if (!symbol || !Number.isFinite(price) || price <= 0) return null;
        if (!Number.isFinite(volume24h) || volume24h <= 0) return null;
        return {
          symbol,
          price,
          change24h,
          volume24h,
          high24h: Number.isFinite(high24h) && high24h > 0 ? high24h : price * 1.03,
          low24h: Number.isFinite(low24h) && low24h > 0 ? low24h : price * 0.97,
          trades24h: Number.isFinite(trades24h) && trades24h > 0 ? Math.round(trades24h) : 0,
          rsi14: 45 + (change24h % 20),
          openInterestUsd: Math.max(50_000, Math.abs(price * 300_000)),
          longShortRatio: 1 + change24h / 100,
        };
      })
      .filter(Boolean) as Array<{
      symbol: string;
      price: number;
      change24h: number;
      volume24h: number;
      high24h: number;
      low24h: number;
      trades24h: number;
      rsi14: number;
      openInterestUsd: number;
      longShortRatio: number;
    }>;

    if (sort === "gainers") rows.sort((a, b) => b.change24h - a.change24h);
    else if (sort === "losers") rows.sort((a, b) => a.change24h - b.change24h);
    else rows.sort((a, b) => b.volume24h - a.volume24h);

    return rows.slice(0, 120);
  } catch {
    const market = await fetchEmergencyQuotes();
    return buildEmergencyScreenerFromQuotes(market.quotes, sort);
  }
}

function normalizeSymbols(input: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(input) ? input : [])
        .map((row) =>
          String(row || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .replace(/(USDT|USDC|USD|PERP|SWAP)$/i, ""),
        )
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function normalizeTier(value: unknown): Tier {
  if (value === "full" || value === "dex") return value;
  return "free";
}

function hasRequiredTier(tier: Tier, required: Tier) {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(required);
}

function requiresTierCheck(pathname: string, method: string) {
  const upperMethod = String(method || "").toUpperCase();
  if (!["POST", "DELETE", "PUT", "PATCH", "OPTIONS", "GET"].includes(upperMethod)) return null;
  if (FULL_TIER_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "full" as Tier;
  }
  if (DEX_TIER_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "dex" as Tier;
  }
  if (pathname === "/api/vault/store" || pathname.startsWith("/api/vault/store/")) {
    return "dex" as Tier;
  }
  return null;
}

function hasUnsafePathSegments(path: string[]) {
  return path.some((segment) => {
    const value = String(segment || "");
    if (!value || value === "." || value === "..") return true;
    if (value.includes("/") || value.includes("\\")) return true;
    return !SAFE_PATH_SEGMENT_REGEX.test(value);
  });
}

function isSensitiveProxyPath(pathname: string) {
  return SENSITIVE_PROXY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function enforceProxyRateLimit(request: NextRequest, method: string, upstreamPath: string) {
  const ip = getClientIp(request);
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const isSensitive = isSensitiveProxyPath(upstreamPath);
  const ipLimit = isMutation ? (isSensitive ? 30 : 60) : 180;
  const ipWindowMs = 60_000;
  const ipResult = await rateLimitAsync(`proxy:${method}:ip:${ip}`, ipLimit, ipWindowMs);
  if (!ipResult.allowed) {
    return json({ error: "Too many requests. Please try again shortly." }, 429);
  }

  const walletSessionToken = request.cookies.get(getWalletSessionCookieName())?.value || "";
  const walletSession = verifyWalletSessionToken(walletSessionToken);
  if (walletSession?.address) {
    const userLimit = isMutation ? (isSensitive ? 50 : 80) : 240;
    const userResult = await rateLimitAsync(`proxy:${method}:wallet:${walletSession.address}`, userLimit, ipWindowMs);
    if (!userResult.allowed) {
      return json({ error: "Too many requests. Please try again shortly." }, 429);
    }
  }
  return null;
}

async function resolveRequestTier(request: NextRequest) {
  const walletSessionToken = request.cookies.get(getWalletSessionCookieName())?.value || "";
  if (walletSessionToken) {
    const walletSession = verifyWalletSessionToken(walletSessionToken);
    if (walletSession?.address && !(await isWalletSessionRevoked(walletSessionToken))) {
      const walletTier = await getWalletTier(walletSession.address);
      return {
        authenticated: true,
        tier: walletTier.tier,
      };
    }
  }

  if (!hasSupabasePublicEnv()) {
    return { authenticated: false, tier: "free" as Tier };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false, tier: "free" as Tier };
  }

  const now = Date.now();
  try {
    const profileQuery = await supabase
      .from("profiles")
      .select("tier, tier_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileQuery.data) {
      const expiresAt = profileQuery.data.tier_expires_at
        ? new Date(profileQuery.data.tier_expires_at).getTime()
        : null;
      const expired = typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt < now;
      return {
        authenticated: true,
        tier: expired ? ("free" as Tier) : normalizeTier(profileQuery.data.tier),
      };
    }
  } catch {
    // fall through to subscriptions
  }

  try {
    const subsQuery = await supabase
      .from("subscriptions")
      .select("tier, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const expiresAt = subsQuery.data?.expires_at ? new Date(subsQuery.data.expires_at).getTime() : null;
    const expired = typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt < now;
    return {
      authenticated: true,
      tier: expired ? ("free" as Tier) : normalizeTier(subsQuery.data?.tier),
    };
  } catch {
    return { authenticated: true, tier: "free" as Tier };
  }
}

async function determineVaultStoreRequiredTier(request: NextRequest): Promise<Tier> {
  try {
    const body = await request.clone().json().catch(() => ({}));
    const scopeRaw = String(body?.scope || body?.venueId || body?.payload?.venueId || "").toLowerCase();
    if (scopeRaw === "binance" || scopeRaw === "okx" || scopeRaw === "bybit") {
      return "full";
    }
  } catch {
    // ignore parse issues and keep safest default for dex flow
  }
  return "dex";
}

async function enforceApiTier(request: NextRequest, upstreamPath: string, method: string) {
  let required = requiresTierCheck(upstreamPath, method);
  if (upstreamPath === "/api/vault/store" && String(method || "").toUpperCase() === "POST") {
    required = await determineVaultStoreRequiredTier(request);
  }
  if (!required) return null;

  const current = await resolveRequestTier(request);
  if (!current.authenticated) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!hasRequiredTier(current.tier, required)) {
    return json(
      {
        error: "Upgrade required",
        requiredTier: required,
        currentTier: current.tier,
      },
      403,
    );
  }

  return null;
}

async function fetchEmergencyVenueSymbols(venueId: string, quoteAsset: string) {
  const venue = String(venueId || "binance").toLowerCase();
  const quote = String(quoteAsset || "USDT").toUpperCase() === "USDC" ? "USDC" : "USDT";

  if (venue === "okx") {
    const payload = await fetch("https://www.okx.com/api/v5/public/instruments?instType=SWAP", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }).then((res) => res.json());
    return normalizeSymbols(
      (payload?.data || [])
        .filter((row: any) => row?.state === "live" && String(row?.instId || "").includes(`-${quote}-SWAP`))
        .map((row: any) => String(row?.instId || "").split("-")[0]),
    );
  }

  if (venue === "bybit") {
    const allRows: any[] = [];
    let cursor = "";
    for (let page = 0; page < 4; page += 1) {
      const query = new URLSearchParams({ category: "linear", limit: "1000" });
      if (cursor) query.set("cursor", cursor);
      const payload = await fetch(`https://api.bybit.com/v5/market/instruments-info?${query.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      }).then((res) => res.json());
      const rows = Array.isArray(payload?.result?.list) ? payload.result.list : [];
      allRows.push(...rows);
      const nextCursor = String(payload?.result?.nextPageCursor || "");
      if (!nextCursor || rows.length === 0 || nextCursor === cursor) break;
      cursor = nextCursor;
    }
    return normalizeSymbols(
      allRows
        .filter((row: any) => row?.status === "Trading" && String(row?.symbol || "").endsWith(quote))
        .map((row: any) => String(row?.baseCoin || row?.symbol || "").replace(new RegExp(`${quote}$`, "i"), "")),
    );
  }

  if (venue === "hyperliquid") {
    const payload = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }).then((res) => res.json());
    return normalizeSymbols((payload?.universe || []).map((row: any) => row?.name || ""));
  }

  if (venue === "aster") {
    const payload = await fetch("https://fapi.asterdex.com/fapi/v1/ticker/24hr", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }).then((res) => res.json());
    return normalizeSymbols(
      (Array.isArray(payload) ? payload : [])
        .map((row: any) => String(row?.symbol || ""))
        .filter((symbol: string) => symbol.endsWith("USDT"))
        .map((symbol: string) => symbol.replace(/USDT$/i, "")),
    );
  }

  const payload = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo", {
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  }).then((res) => res.json());
  return normalizeSymbols(
    (payload?.symbols || [])
      .filter((row: any) => row?.status === "TRADING" && row?.contractType === "PERPETUAL" && String(row?.symbol || "").endsWith(quote))
      .map((row: any) => String(row?.baseAsset || row?.symbol || "").replace(new RegExp(`${quote}$`, "i"), "")),
  );
}

async function emergencyResponse(path: string[], request: NextRequest) {
  const key = (path?.[0] || "").toLowerCase();
  const cacheKey = `${key}:${request.nextUrl.searchParams.toString()}`;
  const cached = readEmergencyCache<unknown>(cacheKey);
  if (cached != null) {
    return json(cached);
  }

  if (key === "bootstrap") {
    const mode = (request.nextUrl.searchParams.get("mode") || "").toLowerCase();
    const payload = await buildEmergencyBootstrap({ lite: mode !== "full" });
    writeEmergencyCache(cacheKey, payload, 30_000);
    return json(payload);
  }
  if (key === "news") {
    const payload = await fetchEmergencyNews();
    writeEmergencyCache(cacheKey, payload, 20_000);
    return json(payload);
  }
  if (key === "social") {
    const payload = await fetchEmergencySocial();
    writeEmergencyCache(cacheKey, payload, 20_000);
    return json(payload);
  }
  if (key === "prices" && request.nextUrl.searchParams.get("type") === "quotes") {
    const market = await fetchEmergencyQuotes();
    writeEmergencyCache(cacheKey, market.quotes, 10_000);
    return json(market.quotes);
  }
  if (key === "prices") {
    const payload = await fetchEmergencyCandles({
      ticker: request.nextUrl.searchParams.get("ticker") || "BTC",
      interval: request.nextUrl.searchParams.get("interval") || "1h",
      limit: request.nextUrl.searchParams.get("limit") || "120",
      quote: request.nextUrl.searchParams.get("quote") || "USDT",
    });
    writeEmergencyCache(cacheKey, payload, 10_000);
    return json(payload);
  }
  if (key === "okx" || key === "bybit" || key === "hyperliquid" || key === "aster") {
    const type = request.nextUrl.searchParams.get("type") || "";
    if (type === "ohlcv" || !type) {
      const payload = await fetchEmergencyCandles({
        ticker: request.nextUrl.searchParams.get("ticker") || "BTC",
        interval: request.nextUrl.searchParams.get("interval") || "1h",
        limit: request.nextUrl.searchParams.get("limit") || "120",
        quote: request.nextUrl.searchParams.get("quote") || "USDT",
      });
      writeEmergencyCache(cacheKey, payload, 10_000);
      return json(payload);
    }
    if (type === "quotes") {
      const market = await fetchEmergencyQuotes();
      const payload = market.quotes.slice(0, 12);
      writeEmergencyCache(cacheKey, payload, 10_000);
      return json(payload);
    }
  }
  if (key === "market") {
    const market = await fetchEmergencyQuotes();
    writeEmergencyCache(cacheKey, market.marketStats, 20_000);
    return json(market.marketStats);
  }
  if (key === "symbols") {
    return json([
      { symbol: "BTC", aliases: ["BTC", "XBT", "WBTC"] },
      { symbol: "ETH", aliases: ["ETH", "WETH", "STETH"] },
      { symbol: "SOL", aliases: ["SOL", "WSOL"] },
      { symbol: "BNB", aliases: ["BNB"] },
      { symbol: "XRP", aliases: ["XRP"] },
      { symbol: "DOGE", aliases: ["DOGE"] },
      { symbol: "AVAX", aliases: ["AVAX", "WAVAX"] },
      { symbol: "LINK", aliases: ["LINK"] },
      { symbol: "DOT", aliases: ["DOT"] },
      { symbol: "ADA", aliases: ["ADA"] },
      { symbol: "TRX", aliases: ["TRX"] },
    ]);
  }
  if (key === "screener") {
    const sort = request.nextUrl.searchParams.get("sort") || "volume";
    const payload = await fetchEmergencyScreenerRows(sort);
    writeEmergencyCache(cacheKey, payload, 20_000);
    return json(payload);
  }
  if (key === "venues" && (path?.[1] || "").toLowerCase() === "symbols") {
    const venue = request.nextUrl.searchParams.get("venue") || "binance";
    const quote = request.nextUrl.searchParams.get("quote") || "USDT";
    try {
      const symbols = await fetchEmergencyVenueSymbols(venue, quote);
      if (Array.isArray(symbols) && symbols.length > 0) {
        writeEmergencyCache(cacheKey, symbols, 60_000);
        return json(symbols);
      }
    } catch {
      // fall through to curated core set
    }
    return json(["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "DOT", "ADA", "TRX"]);
  }
  if (key === "health") {
    return json({ status: "degraded", emergencyFallback: true, timestamp: new Date().toISOString() });
  }
  return json([]);
}

async function proxy(request: NextRequest, method: string, path: string[]) {
  const normalizedMethod = String(method || "").toUpperCase();
  if (!ALLOWED_PROXY_METHODS.has(normalizedMethod)) {
    return json({ error: "Method not allowed." }, 405);
  }
  const normalizedPath = Array.isArray(path) ? path.filter(Boolean) : [];
  if (hasUnsafePathSegments(normalizedPath)) {
    return json({ error: "Invalid API path." }, 400);
  }
  const upstreamPath =
    normalizedPath.length === 1 && normalizedPath[0] === "health"
      ? "/health"
      : `/api/${normalizedPath.join("/")}`;
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD" && normalizedMethod !== "OPTIONS") {
    if (!hasValidCsrfToken(request)) {
      return json({ error: "Missing or invalid CSRF token." }, 403);
    }
  }
  if (isSensitiveProxyPath(upstreamPath) && !String(process.env.PROXY_SHARED_SECRET || "").trim()) {
    return json({ error: "Proxy is not securely configured." }, 503);
  }
  const rateLimitBlock = await enforceProxyRateLimit(request, normalizedMethod, upstreamPath);
  if (rateLimitBlock) return rateLimitBlock;
  const tierBlock = await enforceApiTier(request, upstreamPath, normalizedMethod);
  if (tierBlock) return tierBlock;
  const backendCandidates = resolveBackendCandidates();

  const init: RequestInit = {
    method: normalizedMethod,
    headers: cloneHeaders(request),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(normalizedMethod === "GET" || normalizedMethod === "HEAD" ? 6000 : MUTATION_PROXY_TIMEOUT_MS),
  };
  const headers = init.headers as Headers;
  headers.set("x-traderbross-proxy", "1");
  if (process.env.PROXY_SHARED_SECRET) {
    headers.set("x-traderbross-proxy-secret", process.env.PROXY_SHARED_SECRET);
  }

  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_MUTATION_PROXY_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }
    const bodyBytes = await request.arrayBuffer();
    if (bodyBytes.byteLength > MAX_MUTATION_PROXY_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }
    init.body = bodyBytes;
  }

  let upstream: Response | null = null;
  let lastError: unknown = null;

  for (const backendBase of backendCandidates) {
    const upstreamUrl = new URL(`${backendBase}${upstreamPath}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value);
    });

    try {
      upstream = await fetch(upstreamUrl.toString(), init);
      if (upstream.ok || normalizedMethod === "GET" || normalizedMethod === "HEAD") {
        break;
      }
      // For POST/DELETE, retry another backend candidate if we hit 5xx.
      if (upstream.status < 500) {
        break;
      }
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  if (!upstream) {
    if (normalizedMethod === "GET") return emergencyResponse(normalizedPath, request);
    const fallbackMessage = normalizedPath[0] === "okx" || normalizedPath[0] === "bybit"
      ? "Trade backend temporarily unavailable. Please retry in a few seconds."
      : "upstream_unavailable";
    return json({ error: fallbackMessage }, 503);
  }
  if (normalizedMethod === "GET" && upstream.status >= 500) {
    return emergencyResponse(normalizedPath, request);
  }
  if (normalizedMethod === "GET" && upstream.ok) {
    const primary = (normalizedPath?.[0] || "").toLowerCase();
    if (["bootstrap", "news", "market", "screener", "prices", "okx", "bybit", "hyperliquid", "aster", "symbols", "venues"].includes(primary)) {
      try {
        const clone = upstream.clone();
        const payload = await clone.json();
        const mode = (request.nextUrl.searchParams.get("mode") || "").toLowerCase();
        if (primary === "bootstrap" && mode === "lite") {
          return json(compactBootstrapPayload(payload));
        }
        const looksEmptyBootstrap =
          primary === "bootstrap" &&
          (!Array.isArray(payload?.quotes) || payload.quotes.length === 0) &&
          (!Array.isArray(payload?.news) || payload.news.length === 0);
        const looksEmptyNews = primary === "news" && Array.isArray(payload) && payload.length === 0;
        const looksEmptyMarket = primary === "market" && (!payload || (!payload.marketCapUsd && !payload.total24hVolume));
        const type = request.nextUrl.searchParams.get("type") || "";
        const looksEmptyCandles =
          ["prices", "okx", "bybit", "hyperliquid", "aster"].includes(primary) &&
          (type === "ohlcv" || type === "" || primary === "prices") &&
          Array.isArray(payload) &&
          payload.length === 0;
        const looksEmptyVenueSymbols =
          primary === "venues" &&
          (normalizedPath?.[1] || "").toLowerCase() === "symbols" &&
          Array.isArray(payload) &&
          payload.length === 0;
        const looksEmptySymbols = primary === "symbols" && Array.isArray(payload) && payload.length === 0;
        if (
          looksEmptyBootstrap ||
          looksEmptyNews ||
          looksEmptyMarket ||
          looksEmptyCandles ||
          looksEmptyVenueSymbols ||
          looksEmptySymbols
        ) {
          return emergencyResponse(normalizedPath, request);
        }
      } catch {
        // If response is not JSON, keep upstream response as-is.
      }
    }
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "GET", path || []);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "POST", path || []);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "DELETE", path || []);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "OPTIONS", path || []);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "PUT", path || []);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "PATCH", path || []);
}
