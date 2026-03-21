import { NextRequest } from "next/server";

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:4001";
const DEFAULT_PROD_BACKEND = "https://traderbross-production.up.railway.app";
const EMERGENCY_CACHE_TTL_MS = 45_000;
const emergencyCache = new Map<string, { expiresAt: number; value: unknown }>();

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveBackendBaseUrl() {
  const explicit =
    process.env.BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (explicit) return trimSlash(explicit);
  if (process.env.NODE_ENV === "production") return DEFAULT_PROD_BACKEND;
  return DEFAULT_LOCAL_BACKEND;
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

async function buildEmergencyBootstrap() {
  const [market, news, social] = await Promise.all([fetchEmergencyQuotes(), fetchEmergencyNews(), fetchEmergencySocial()]);
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
    news,
    whales: [],
    whaleEvents: [],
    social,
    newsSnapshot: {
      generatedAt: new Date().toISOString(),
      count: news.length,
      items: news.map((n) => ({
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
      status: news.length > 0 ? "ok" : "empty",
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
    const payload = await fetch("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }).then((res) => res.json());
    return normalizeSymbols(
      (payload?.result?.list || [])
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

  if (venue === "dydx") {
    const payload = await fetch("https://indexer.dydx.trade/v4/perpetualMarkets", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    }).then((res) => res.json());
    return normalizeSymbols(Object.keys(payload?.markets || {}).map((market) => String(market).split("-")[0]));
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
    const payload = await buildEmergencyBootstrap();
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
  if (key === "okx" || key === "bybit" || key === "hyperliquid" || key === "dydx") {
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
    const market = await fetchEmergencyQuotes();
    const sort = request.nextUrl.searchParams.get("sort") || "volume";
    const payload = buildEmergencyScreenerFromQuotes(market.quotes, sort);
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
  const backendBase = resolveBackendBaseUrl();
  const normalizedPath = Array.isArray(path) ? path.filter(Boolean) : [];
  const upstreamPath =
    normalizedPath.length === 1 && normalizedPath[0] === "health"
      ? "/health"
      : `/api/${normalizedPath.join("/")}`;
  const upstreamUrl = new URL(`${backendBase}${upstreamPath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const init: RequestInit = {
    method,
    headers: cloneHeaders(request),
    redirect: "manual",
    cache: "no-store",
  };
  const headers = init.headers as Headers;
  headers.set("x-traderbross-proxy", "1");
  if (process.env.PROXY_SHARED_SECRET) {
    headers.set("x-traderbross-proxy-secret", process.env.PROXY_SHARED_SECRET);
  }

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), init);
  } catch {
    if (method === "GET") return emergencyResponse(normalizedPath, request);
    return json({ error: "upstream_unavailable" }, 502);
  }
  if (method === "GET" && upstream.status >= 500) {
    return emergencyResponse(normalizedPath, request);
  }
  if (method === "GET" && upstream.ok) {
    const primary = (normalizedPath?.[0] || "").toLowerCase();
    if (["bootstrap", "news", "market", "screener", "prices", "okx", "bybit", "hyperliquid", "dydx", "symbols", "venues"].includes(primary)) {
      try {
        const clone = upstream.clone();
        const payload = await clone.json();
        const looksEmptyBootstrap =
          primary === "bootstrap" &&
          (!Array.isArray(payload?.quotes) || payload.quotes.length === 0) &&
          (!Array.isArray(payload?.news) || payload.news.length === 0);
        const looksEmptyNews = primary === "news" && Array.isArray(payload) && payload.length === 0;
        const looksEmptyMarket = primary === "market" && (!payload || (!payload.marketCapUsd && !payload.total24hVolume));
        const type = request.nextUrl.searchParams.get("type") || "";
        const looksEmptyCandles =
          ["prices", "okx", "bybit", "hyperliquid", "dydx"].includes(primary) &&
          (type === "ohlcv" || type === "" || primary === "prices") &&
          Array.isArray(payload) &&
          payload.length === 0;
        if (looksEmptyBootstrap || looksEmptyNews || looksEmptyMarket || looksEmptyCandles) {
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
