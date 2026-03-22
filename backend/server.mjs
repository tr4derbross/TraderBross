import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { ethers } from "ethers";
import { encode as msgpackEncode } from "@msgpack/msgpack";
import { loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { getProviderLabel, streamChat, classifySentiment } from "./services/ai-service.mjs";
import { getCalendarEvents } from "./services/calendar-service.mjs";
import { getDydxAccount, getDydxCandles, getDydxMarkets } from "./services/dydx-service.mjs";
import { getHyperliquidAccount, getHyperliquidCandles, getHyperliquidMarket } from "./services/hyperliquid-service.mjs";
import {
  getBinanceCandles,
  getBybitCandles,
  getOkxCandles,
} from "./services/market-service.mjs";
import { getScreenerData } from "./services/screener-service.mjs";
import { getMarketStats, getMempoolStats, getFearGreed, getEthGas, getDefiLlamaTvl, getForexRates } from "./services/stats-service.mjs";
import { getTrendingData } from "./services/trending-service.mjs";
import { clearSecret, getSecret, storeSecret } from "./services/vault-service.mjs";
import { createTerminalDataService } from "./data/terminal-data-service.mjs";
import { CORE_SYMBOLS, canonicalSymbol, symbolAliases } from "./data/core/symbol-map.mjs";
import { MemoryCache } from "./services/cache.mjs";
import { createRateLimiter } from "./services/rate-limiter.mjs";
import { createUpstashCache } from "./services/upstash-cache.mjs";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const terminalData = createTerminalDataService({ config, logger });
const endpointCache = new MemoryCache();
const upstashCache = createUpstashCache(config, logger);
const clients = new Set();
let bootstrapRefreshInFlight = false;
const rateLimiter = createRateLimiter(config, logger);
const SENSITIVE_ROUTES = new Set([
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
]);

if (upstashCache.enabled) {
  logger.info("upstash.cache.enabled", {
    prefix: config.upstash?.prefix || "traderbross:cache",
    ttl: upstashCache.ttl,
  });
}

if (config.security.proxyAuthEnabled && !String(config.security.proxyAuthSecret || "").trim()) {
  logger.warn("backend.security.proxy_secret_missing", {
    message:
      "REQUIRE_PROXY_AUTH is enabled but PROXY_SHARED_SECRET is missing. Sensitive routes will be denied until configured.",
  });
}

if (String(process.env.NODE_ENV || "").toLowerCase() === "production" && !String(process.env.VAULT_ENCRYPTION_KEY || "").trim()) {
  logger.warn("backend.security.vault_key_missing", {
    message: "VAULT_ENCRYPTION_KEY is not set. Vault key will rotate on restart and invalidate sessions.",
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error("backend.unhandled_rejection", { reason: String(reason) });
});

process.on("uncaughtException", (error) => {
  logger.error("backend.uncaught_exception", { error: String(error) });
});

function binanceSignedQuery(secret, params = {}) {
  const qs = new URLSearchParams({ ...params, timestamp: Date.now().toString(), recvWindow: "5000" }).toString();
  const sig = crypto.createHmac("sha256", secret).update(qs).digest("hex");
  return `${qs}&signature=${sig}`;
}

function okxSign({ secret, passphrase, apiKey, method, requestPath, body = "" }) {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${String(method || "GET").toUpperCase()}${requestPath}${body}`;
  const signature = crypto.createHmac("sha256", secret).update(prehash).digest("base64");
  return {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };
}

function bybitSign({ secret, apiKey, method, query = "", body = "" }) {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const payload = String(method || "GET").toUpperCase() === "GET"
    ? `${timestamp}${apiKey}${recvWindow}${query}`
    : `${timestamp}${apiKey}${recvWindow}${body}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-SIGN": signature,
    "X-BAPI-SIGN-TYPE": "2",
    "X-BAPI-TIMESTAMP": timestamp,
    "X-BAPI-RECV-WINDOW": recvWindow,
    "Content-Type": "application/json",
  };
}

function canonicalTickerParam(value, fallback = "BTC") {
  return canonicalSymbol(value || fallback) || fallback;
}

function normalizeVenueId(value) {
  const venue = String(value || "").trim().toLowerCase();
  return ["binance", "okx", "bybit", "hyperliquid"].includes(venue) ? venue : "generic";
}

function getClientIp(request) {
  const raw =
    request.headers["x-forwarded-for"] ||
    request.headers["x-real-ip"] ||
    request.socket?.remoteAddress ||
    "unknown";
  return String(raw).split(",")[0].trim();
}

async function enforceRateLimit(reply, key, limit, windowMs) {
  if (!(await rateLimiter.consume(key, limit, windowMs))) {
    json(reply, 429, { error: "Too many requests. Please try again shortly." });
    return false;
  }
  return true;
}

function trustedProxyRequest(request) {
  const marker = String(request.headers["x-traderbross-proxy"] || "");
  if (config.security.requireProxyMarker && marker !== "1") {
    return false;
  }

  if (config.security.proxyAuthEnabled) {
    const expected = String(config.security.proxyAuthSecret || "").trim();
    const headerName = String(config.security.proxyAuthHeader || "x-traderbross-proxy-secret").toLowerCase();
    const provided = String(request.headers[headerName] || "");
    // Fail closed when proxy auth is enabled but secret is missing.
    if (!expected) return false;
    if (!provided) return false;
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return false;
    }
  }

  return true;
}

function isAllowedWsOrigin(request) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return String(process.env.NODE_ENV || "").toLowerCase() !== "production";
  const normalized = origin.replace(/\/+$/, "");
  return config.frontendOrigins.includes(normalized);
}

function sanitizeVaultPayload(scope, payload) {
  const venueId = normalizeVenueId(payload?.venueId || scope);
  if (venueId === "hyperliquid") {
    return {
      venueId,
      privateKey: String(payload?.privateKey || "").trim().slice(0, 256),
      walletAddress: String(payload?.walletAddress || "").trim().slice(0, 128),
    };
  }
  return {
    venueId,
    apiKey: String(payload?.apiKey || "").trim().slice(0, 256),
    apiSecret: String(payload?.apiSecret || "").trim().slice(0, 256),
    passphrase: String(payload?.passphrase || "").trim().slice(0, 256),
    testnet: Boolean(payload?.testnet),
  };
}

function normalizeTradeSymbol(rawSymbol, rawQuote = "USDT") {
  const base = canonicalTickerParam(rawSymbol, "BTC");
  const quote = String(rawQuote || "USDT").toUpperCase() === "USDC" ? "USDC" : "USDT";
  return `${base}${quote}`;
}

function finitePositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toWireDecimal(value, precision = 8) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const fixed = num.toFixed(precision);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed === "" || trimmed === "-0" ? "0" : trimmed;
}

function decimalPlacesFromStep(stepValue) {
  const step = String(stepValue || "1");
  if (!step.includes(".")) return 0;
  return step.replace(/0+$/, "").split(".")[1]?.length || 0;
}

function floorToStep(value, step, precision = 8) {
  const num = Number(value);
  const size = Number(step);
  if (!Number.isFinite(num) || !Number.isFinite(size) || size <= 0) return null;
  const floored = Math.floor(num / size) * size;
  if (floored <= 0) return null;
  return Number(floored.toFixed(Math.max(0, precision)));
}

async function getBinanceExchangeInfo(baseUrl) {
  const cacheKey = `binance:exchangeInfo:${baseUrl}`;
  return endpointCache.remember(cacheKey, 10 * 60_000, async () => {
    const res = await fetch(`${baseUrl}/fapi/v1/exchangeInfo`, { signal: AbortSignal.timeout(8000) });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.msg || `Binance exchangeInfo error ${res.status}`);
    }
    return payload;
  });
}

async function getBinanceSymbolSpec(baseUrl, symbol) {
  const info = await getBinanceExchangeInfo(baseUrl);
  const row = Array.isArray(info?.symbols)
    ? info.symbols.find((item) => String(item?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase())
    : null;
  if (!row) return null;
  const lotFilter = Array.isArray(row.filters)
    ? row.filters.find((f) => f?.filterType === "LOT_SIZE")
    : null;
  const priceFilter = Array.isArray(row.filters)
    ? row.filters.find((f) => f?.filterType === "PRICE_FILTER")
    : null;
  const stepSize = Number(lotFilter?.stepSize || "0");
  const minQty = Number(lotFilter?.minQty || "0");
  const tickSize = Number(priceFilter?.tickSize || "0");
  return {
    stepSize: Number.isFinite(stepSize) && stepSize > 0 ? stepSize : null,
    minQty: Number.isFinite(minQty) && minQty > 0 ? minQty : null,
    tickSize: Number.isFinite(tickSize) && tickSize > 0 ? tickSize : null,
    qtyPrecision: Number(row?.quantityPrecision || 3),
    pricePrecision: Number(row?.pricePrecision || 6),
  };
}

async function normalizeBinanceQuantity(baseUrl, symbol, value) {
  const spec = await getBinanceSymbolSpec(baseUrl, symbol);
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (!spec?.stepSize) return toWireDecimal(qty, 6);
  const precision = Math.max(spec.qtyPrecision || 0, decimalPlacesFromStep(spec.stepSize));
  const floored = floorToStep(qty, spec.stepSize, precision);
  if (!floored) return null;
  if (spec.minQty && floored < spec.minQty) return null;
  return toWireDecimal(floored, precision);
}

async function normalizeBinancePrice(baseUrl, symbol, value) {
  const spec = await getBinanceSymbolSpec(baseUrl, symbol);
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!spec?.tickSize) return toWireDecimal(price, 6);
  const precision = Math.max(spec.pricePrecision || 0, decimalPlacesFromStep(spec.tickSize));
  const floored = floorToStep(price, spec.tickSize, precision);
  if (!floored) return null;
  return toWireDecimal(floored, precision);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function buildHttpCacheKey(pathname, searchParams) {
  const pairs = Array.from(searchParams.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) return aValue.localeCompare(bValue);
    return aKey.localeCompare(bKey);
  });
  const encoded = pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return encoded ? `${pathname}?${encoded}` : pathname;
}

function getPrimaryAiProvider(config) {
  if (!config?.ai?.allowExternal) return "mock";
  if (config.groqApiKey) return "groq";
  if (config.geminiApiKey) return "gemini";
  if (config.openrouterApiKey) return "openrouter";
  return "mock";
}

function hyperAddressToBytes(address) {
  return ethers.getBytes(address);
}

function hyperActionHash(action, vaultAddress, nonce, expiresAfter) {
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(nonce), false);
  const parts = [msgpackEncode(action), nonceBytes];
  if (vaultAddress) {
    parts.push(Uint8Array.from([1]));
    parts.push(hyperAddressToBytes(vaultAddress));
  } else {
    parts.push(Uint8Array.from([0]));
  }
  if (expiresAfter != null) {
    const expBytes = new Uint8Array(8);
    new DataView(expBytes.buffer).setBigUint64(0, BigInt(expiresAfter), false);
    parts.push(Uint8Array.from([0]));
    parts.push(expBytes);
  }
  return ethers.keccak256(concatBytes(parts));
}

async function signHyperL1Action({ privateKey, action, nonce, vaultAddress, expiresAfter = null, isMainnet = true }) {
  const wallet = new ethers.Wallet(privateKey);
  const connectionId = hyperActionHash(action, vaultAddress, nonce, expiresAfter);
  const domain = {
    chainId: 1337,
    name: "Exchange",
    version: "1",
    verifyingContract: "0x0000000000000000000000000000000000000000",
  };
  const types = {
    Agent: [
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ],
  };
  const rawSignature = await wallet.signTypedData(domain, types, {
    source: isMainnet ? "a" : "b",
    connectionId,
  });
  const signature = ethers.Signature.from(rawSignature);
  return { r: signature.r, s: signature.s, v: signature.v };
}

async function getHyperMeta() {
  return endpointCache.remember("hyper:meta", 60_000, async () => {
    const payload = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
      signal: AbortSignal.timeout(5000),
    }).then((res) => res.json());
    return Array.isArray(payload?.universe) ? payload.universe : [];
  });
}

async function getHyperAssetIndex(symbol) {
  const universe = await getHyperMeta();
  const target = canonicalTickerParam(symbol, "BTC");
  const idx = universe.findIndex((row) => canonicalTickerParam(row?.name, "") === target);
  return idx >= 0 ? idx : null;
}

async function getHyperMarkPrice(symbol) {
  const target = canonicalTickerParam(symbol, "BTC");
  const payload = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    signal: AbortSignal.timeout(5000),
  }).then((res) => res.json());
  const raw = payload?.[target];
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function getOkxContractValue(instId) {
  if (!instId) return 1;
  try {
    const meta = await endpointCache.remember(`okx:inst-meta:${instId}`, 6 * 60 * 60 * 1000, async () => {
      const res = await fetch(
        `https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${encodeURIComponent(instId)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      const data = await res.json();
      const row = Array.isArray(data?.data) ? data.data[0] : null;
      return {
        ctVal: parseFloat(row?.ctVal || "1") || 1,
        ctMult: parseFloat(row?.ctMult || "1") || 1,
      };
    });
    return (meta?.ctVal || 1) * (meta?.ctMult || 1);
  } catch {
    return 1;
  }
}

function toBaseSymbol(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[-_/]/g, "")
    .replace(/USDT|USD|USDC|PERP|SWAP|SPOT/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function uniqueSortedSymbols(input) {
  return Array.from(new Set((Array.isArray(input) ? input : []).map((item) => toBaseSymbol(item)).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

async function getVenueSymbols(venueId, quoteAsset = "USDT") {
  const venue = String(venueId || "binance").toLowerCase();
  const quote = String(quoteAsset || "USDT").toUpperCase() === "USDC" ? "USDC" : "USDT";
  return endpointCache.remember(`venue:symbols:${venue}:${quote}`, 60_000, async () => {
    if (venue === "okx") {
      const payload = await fetch("https://www.okx.com/api/v5/public/instruments?instType=SWAP", {
        signal: AbortSignal.timeout(6000),
      }).then((res) => res.json());
      const liveRows = (payload?.data || []).filter((row) => row.state === "live");
      const symbols = liveRows
        .filter((row) => row.state === "live" && String(row.instId || "").includes(`-${quote}-SWAP`))
        .map((row) => String(row.instId || "").split("-")[0]);
      const preferred = uniqueSortedSymbols(symbols);
      if (preferred.length > 0) return preferred;
      // Fallback: return all live swaps if quote-specific list is empty.
      return uniqueSortedSymbols(liveRows.map((row) => String(row.instId || "").split("-")[0]));
    }

    if (venue === "bybit") {
      const allRows = [];
      let cursor = "";
      for (let page = 0; page < 4; page += 1) {
        const query = new URLSearchParams({ category: "linear", limit: "1000" });
        if (cursor) query.set("cursor", cursor);
        const payload = await fetch(`https://api.bybit.com/v5/market/instruments-info?${query.toString()}`, {
          signal: AbortSignal.timeout(7000),
        }).then((res) => res.json());
        const rows = Array.isArray(payload?.result?.list) ? payload.result.list : [];
        allRows.push(...rows);
        const nextCursor = String(payload?.result?.nextPageCursor || "");
        if (!nextCursor || rows.length === 0 || nextCursor === cursor) break;
        cursor = nextCursor;
      }
      const symbols = allRows
        .filter((row) => row.status === "Trading" && String(row.symbol || "").endsWith(quote))
        .map((row) => String(row.baseCoin || row.symbol).replace(new RegExp(`${quote}$`, "i"), ""));
      const preferred = uniqueSortedSymbols(symbols);
      if (preferred.length > 0) return preferred;
      return uniqueSortedSymbols(
        allRows
          .filter((row) => row.status === "Trading")
          .map((row) => String(row.baseCoin || row.symbol || "").replace(/USDT|USDC$/i, "")),
      );
    }

    if (venue === "hyperliquid") {
      const payload = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
        signal: AbortSignal.timeout(7000),
      }).then((res) => res.json());
      const symbols = (payload?.universe || []).map((row) => row?.name || "");
      return uniqueSortedSymbols(symbols);
    }

    if (venue === "dydx") {
      const payload = await fetch("https://indexer.dydx.trade/v4/perpetualMarkets", {
        signal: AbortSignal.timeout(7000),
      }).then((res) => res.json());
      const markets = payload?.markets || {};
      const symbols = Object.keys(markets).map((market) => String(market).split("-")[0]);
      return uniqueSortedSymbols(symbols);
    }

    const payload = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo", {
      signal: AbortSignal.timeout(7000),
    }).then((res) => res.json());
    const symbols = (payload?.symbols || [])
      .filter(
        (row) =>
          row.status === "TRADING" &&
          row.contractType === "PERPETUAL" &&
          String(row.symbol || "").endsWith(quote),
      )
      .map((row) => String(row.baseAsset || row.symbol).replace(new RegExp(`${quote}$`, "i"), ""));
    return uniqueSortedSymbols(symbols);
  });
}

function json(reply, statusCode, payload) {
  const body = JSON.stringify(payload);
  reply.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  reply.end(body);
}

function withCors(request, reply) {
  const origin = request.headers.origin;
  const allowedOrigin = origin && config.frontendOrigins.includes(origin.replace(/\/+$/, "")) ? origin : config.frontendOrigins[0];
  reply.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  reply.setHeader("Access-Control-Allow-Headers", "content-type");
  reply.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendToClient(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(type, payload) {
  const envelope = { type, payload, timestamp: new Date().toISOString() };
  for (const client of clients) {
    sendToClient(client, envelope);
  }
}
function buildSnapshot() {
  return terminalData.getSnapshot();
}

function sliceRecent(items, limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, Math.max(1, Number(limit) || 1));
}

function buildLiteSnapshot(snapshot) {
  const news = sliceRecent(snapshot.news, 32);
  const social = sliceRecent(snapshot.social, 36);
  const whales = sliceRecent(snapshot.whales, 20);
  const liquidations = sliceRecent(snapshot.liquidations, 40);
  const discovery = [];
  const newsSnapshotItems = sliceRecent(snapshot.newsSnapshot?.items, 80);
  return {
    ...snapshot,
    news,
    social,
    whales,
    whaleEvents: [],
    liquidations,
    discovery,
    coinMetadata: {},
    newsSnapshot: {
      ...(snapshot.newsSnapshot || {}),
      items: newsSnapshotItems,
      count: snapshot.newsSnapshot?.count ?? newsSnapshotItems.length,
    },
  };
}

const server = http.createServer(async (request, reply) => {
  withCors(request, reply);

  if (request.method === "OPTIONS") {
    reply.writeHead(204);
    reply.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const requestId = request.headers["x-request-id"] || crypto.randomUUID();
  const startedAt = Date.now();
  let upstreamStatus = "ok";
  reply.setHeader("x-request-id", requestId);
  reply.once("finish", () => {
    logger.info("backend.request.completed", {
      request_id: requestId,
      route: url.pathname,
      method: request.method,
      status_code: reply.statusCode,
      latency_ms: Date.now() - startedAt,
      upstream_status: upstreamStatus,
    });
  });

  try {
    const clientIp = getClientIp(request);
    const isSensitiveRoute = SENSITIVE_ROUTES.has(url.pathname);
    if (isSensitiveRoute && !trustedProxyRequest(request)) {
      logger.warn("backend.request.blocked_untrusted_proxy", {
        path: url.pathname,
        ip: clientIp,
      });
      json(reply, 403, { error: "Forbidden" });
      return;
    }

    if (isSensitiveRoute) {
      const key = `${clientIp}:${url.pathname}:${request.method}`;
      if (!(await enforceRateLimit(reply, key, 40, 60_000))) {
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const status = terminalData.getStatus();
      json(reply, 200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        wsClients: clients.size,
        dependencies: {
          websocket_server: "ok",
          coingecko_market: status.providerState.coingecko_market,
          coingecko_metadata: status.providerState.coingecko_metadata,
          hyperliquid_stream: status.providerState.hyperliquid_ws,
          dexscreener_discovery: status.providerState.dexscreener,
          news_aggregate: status.providerState.news,
          onchain_whales: status.providerState.whales,
          cache_state: {
            quotes: status.quotes,
            news: status.news,
            whales: status.whales,
            liquidations: status.liquidations,
          },
          freshness: status.freshness || null,
          news_sources: status.newsSourceHealth || {},
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/providers/health") {
      const status = terminalData.getStatus();
      const aggregate = Object.values(status.providerState || {});
      const hasOk = aggregate.includes("ok");
      const hasHardFail = aggregate.includes("error") || aggregate.includes("disconnected");
      const connectionState = hasHardFail ? "degraded" : hasOk ? "connected" : "connecting";
      json(reply, 200, {
        ...status,
        connectionState,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      const mode = (url.searchParams.get("mode") || "").toLowerCase();
      const bootstrapCacheKey = buildHttpCacheKey(url.pathname, url.searchParams);
      const cachedBootstrap = await upstashCache.getJson(bootstrapCacheKey);
      if (cachedBootstrap) {
        json(reply, 200, cachedBootstrap);
        return;
      }

      const snapshot = buildSnapshot();
      if ((snapshot.quotes?.length || 0) === 0 && snapshot.connectionState !== "connected") {
        if (!bootstrapRefreshInFlight) {
          bootstrapRefreshInFlight = true;
          void terminalData
            .refreshAll()
            .catch((error) => {
              logger.warn("data.snapshot.refresh_failed", { error: String(error) });
            })
            .finally(() => {
              bootstrapRefreshInFlight = false;
            });
        }
      }
      const latest = buildSnapshot();
      const payload = mode === "lite" ? buildLiteSnapshot(latest) : latest;
      void upstashCache.setJson(bootstrapCacheKey, payload, upstashCache.ttl.bootstrapSec);
      json(reply, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/calendar") {
      json(reply, 200, await getCalendarEvents(config));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/screener") {
      const sort = url.searchParams.get("sort") || "volume";
      json(reply, 200, await getScreenerData(sort));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/trending") {
      json(reply, 200, await getTrendingData());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/prices") {
      const type = url.searchParams.get("type");
      const quote = (url.searchParams.get("quote") || "USDT").toUpperCase();
      if (type === "quotes") {
        const quoteCacheKey = buildHttpCacheKey(url.pathname, url.searchParams);
        const cachedQuotes = await upstashCache.getJson(quoteCacheKey);
        if (cachedQuotes) {
          json(reply, 200, cachedQuotes);
          return;
        }
        const payload = buildSnapshot().quotes || [];
        void upstashCache.setJson(quoteCacheKey, payload, upstashCache.ttl.pricesSec);
        json(reply, 200, payload);
        return;
      }

      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      const candlesCacheKey = buildHttpCacheKey(url.pathname, url.searchParams);
      const cachedCandles = await upstashCache.getJson(candlesCacheKey);
      if (cachedCandles) {
        json(reply, 200, cachedCandles);
        return;
      }
      const payload = await getBinanceCandles(ticker, interval, limit, quote);
      void upstashCache.setJson(candlesCacheKey, payload, upstashCache.ttl.pricesSec);
      json(reply, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/okx") {
      const type = url.searchParams.get("type");
      const quote = (url.searchParams.get("quote") || "USDT").toUpperCase();
      if (type === "quotes") {
        json(reply, 200, buildSnapshot().venueQuotes?.OKX || []);
        return;
      }
      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getOkxCandles(ticker, interval, limit, quote));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/okx/orderbook") {
      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const size = Math.min(Math.max(Number(url.searchParams.get("sz") || 10), 1), 50);
      try {
        const data = await endpointCache.remember(`okx:orderbook:${ticker}:${size}`, 2_500, async () => {
          const swapInst = `${ticker}-USDT-SWAP`;
          const spotInst = `${ticker}-USDT`;

          const fetchBook = async (instId) => {
            const res = await fetch(
              `https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=${size}`,
              { signal: AbortSignal.timeout(5000) },
            );
            if (!res.ok) throw new Error(`okx orderbook ${res.status}`);
            return res.json();
          };

          let payload;
          try {
            payload = await fetchBook(swapInst);
          } catch {
            payload = await fetchBook(spotInst);
          }

          const row = Array.isArray(payload?.data) ? payload.data[0] : null;
          const bids = Array.isArray(row?.bids) ? row.bids.slice(0, size) : [];
          const asks = Array.isArray(row?.asks) ? row.asks.slice(0, size) : [];
          return { bids, asks };
        });
        json(reply, 200, data);
      } catch {
        json(reply, 200, { bids: [], asks: [] });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bybit") {
      const type = url.searchParams.get("type");
      const quote = (url.searchParams.get("quote") || "USDT").toUpperCase();
      if (type === "quotes") {
        json(reply, 200, buildSnapshot().venueQuotes?.Bybit || []);
        return;
      }
      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getBybitCandles(ticker, interval, limit, quote));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/hyperliquid") {
      const type = url.searchParams.get("type");
      if (type === "market") {
        json(reply, 200, await getHyperliquidMarket());
        return;
      }
      if (type === "account") {
        json(reply, 200, await getHyperliquidAccount(url.searchParams.get("address") || ""));
        return;
      }
      if (type === "ohlcv") {
        const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
        const interval = url.searchParams.get("interval") || "1d";
        const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
        json(reply, 200, await getHyperliquidCandles(ticker, interval, limit));
        return;
      }
    }

    if (request.method === "POST" && url.pathname === "/api/hyperliquid/order") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "hyperliquid") {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const privateKey = String(entry.payload?.privateKey || "");
      const vaultAddress = String(entry.payload?.walletAddress || "").trim() || undefined;
      if (!privateKey) {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }

      const postExchange = async (action, expiresAfter = null) => {
        const nonce = Date.now();
        const signature = await signHyperL1Action({
          privateKey,
          action,
          nonce,
          vaultAddress,
          expiresAfter,
          isMainnet: true,
        });
        const payload = {
          action,
          nonce,
          signature,
          ...(vaultAddress ? { vaultAddress } : {}),
          ...(expiresAfter != null ? { expiresAfter } : {}),
        };
        const res = await fetch("https://api.hyperliquid.xyz/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Hyperliquid error ${res.status}`);
        const status = String(data?.status || "").toLowerCase();
        if (status && status !== "ok") {
          throw new Error(data?.response || data?.error || "Hyperliquid rejected the action.");
        }
        return data;
      };

      try {
        const symbol = canonicalTickerParam(body.symbol, "BTC");
        const asset = await getHyperAssetIndex(symbol);
        if (asset == null) {
          json(reply, 400, { ok: false, error: `Unsupported Hyperliquid symbol: ${symbol}` });
          return;
        }

        if (body.type === "cancel") {
          const oid = Number(body.orderId || 0);
          if (!Number.isFinite(oid) || oid <= 0) {
            json(reply, 400, { ok: false, error: "Invalid orderId." });
            return;
          }
          const result = await postExchange({ type: "cancel", cancels: [{ a: asset, o: oid }] });
          json(reply, 200, { ok: true, data: result });
          return;
        }

        if (body.type === "leverage") {
          const leverage = Math.max(1, Math.min(50, Math.round(Number(body.leverage) || 1)));
          const isCross = String(body.marginMode || "").toLowerCase() === "cross";
          const result = await postExchange({ type: "updateLeverage", asset, isCross, leverage });
          json(reply, 200, { ok: true, data: result });
          return;
        }

        if (body.type === "marginMode") {
          json(reply, 200, { ok: true });
          return;
        }

        const markPrice = await getHyperMarkPrice(symbol);
        if (!markPrice) {
          json(reply, 400, { ok: false, error: "Could not fetch Hyperliquid mark price." });
          return;
        }

        if (body.type === "closePosition" || body.type === "tpsl") {
          const closePercent = Math.max(1, Math.min(100, Number(body.closePercent) || 100));
          const accountAddress = vaultAddress;
          if (!accountAddress) {
            json(reply, 400, { ok: false, error: "Wallet address is required for this action." });
            return;
          }
          const account = await getHyperliquidAccount(accountAddress);
          const pos = Array.isArray(account?.positions)
            ? account.positions.find((row) => canonicalTickerParam(row.coin, "") === symbol)
            : null;
          if (!pos || !finitePositiveNumber(pos.size)) {
            json(reply, 200, { ok: true, data: { message: "No open position found." } });
            return;
          }
          const posSize = Number(pos.size);
          const closeIsBuy = String(pos.side || "").toLowerCase() === "short";
          if (body.type === "closePosition") {
            const closeSize = posSize * (closePercent / 100);
            const px = closeIsBuy ? markPrice * 1.03 : markPrice * 0.97;
            const action = {
              type: "order",
              orders: [
                {
                  a: asset,
                  b: closeIsBuy,
                  p: toWireDecimal(px),
                  s: toWireDecimal(closeSize),
                  r: true,
                  t: { limit: { tif: "Ioc" } },
                },
              ],
              grouping: "na",
            };
            const result = await postExchange(action);
            json(reply, 200, { ok: true, data: result });
            return;
          }
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          if (!tp && !sl) {
            json(reply, 400, { ok: false, error: "Provide TP and/or SL price." });
            return;
          }
          if (tp && (!closeIsBuy ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (!closeIsBuy ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          const orders = [];
          if (tp) {
            orders.push({
              a: asset,
              b: closeIsBuy,
              p: toWireDecimal(tp),
              s: toWireDecimal(posSize),
              r: true,
              t: { trigger: { isMarket: true, triggerPx: toWireDecimal(tp), tpsl: "tp" } },
            });
          }
          if (sl) {
            orders.push({
              a: asset,
              b: closeIsBuy,
              p: toWireDecimal(sl),
              s: toWireDecimal(posSize),
              r: true,
              t: { trigger: { isMarket: true, triggerPx: toWireDecimal(sl), tpsl: "sl" } },
            });
          }
          const result = await postExchange({ type: "order", orders, grouping: "positionTpsl" });
          json(reply, 200, { ok: true, data: result });
          return;
        }

        if (body.type === "order") {
          const marginAmount = finitePositiveNumber(body.marginAmount);
          const leverage = Math.max(1, Math.min(50, Math.round(Number(body.leverage) || 1)));
          if (!marginAmount) {
            json(reply, 400, { ok: false, error: "Invalid margin amount." });
            return;
          }
          const size = (marginAmount * leverage) / Math.max(1e-9, markPrice);
          const isBuy = String(body.side || "long").toLowerCase() !== "short";
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          if (tp && (isBuy ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (isBuy ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          let entryOrderType;
          let px;
          if (body.orderType === "limit") {
            const lp = finitePositiveNumber(body.limitPrice);
            if (!lp) {
              json(reply, 400, { ok: false, error: "Invalid limit price." });
              return;
            }
            entryOrderType = { limit: { tif: "Gtc" } };
            px = lp;
          } else {
            // Hyperliquid market route is an aggressive IOC limit.
            entryOrderType = { limit: { tif: "Ioc" } };
            px = isBuy ? markPrice * 1.03 : markPrice * 0.97;
          }
          const orders = [
            {
              a: asset,
              b: isBuy,
              p: toWireDecimal(px),
              s: toWireDecimal(size),
              r: false,
              t: entryOrderType,
            },
          ];
          if (tp || sl) {
            const closeIsBuy = !isBuy;
            if (tp) {
              orders.push({
                a: asset,
                b: closeIsBuy,
                p: toWireDecimal(tp),
                s: toWireDecimal(size),
                r: true,
                t: { trigger: { isMarket: true, triggerPx: toWireDecimal(tp), tpsl: "tp" } },
              });
            }
            if (sl) {
              orders.push({
                a: asset,
                b: closeIsBuy,
                p: toWireDecimal(sl),
                s: toWireDecimal(size),
                r: true,
                t: { trigger: { isMarket: true, triggerPx: toWireDecimal(sl), tpsl: "sl" } },
              });
            }
          }
          const result = await postExchange({
            type: "order",
            orders,
            grouping: tp || sl ? "normalTpsl" : "na",
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }

        json(reply, 400, { ok: false, error: "Unknown action type" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Hyperliquid order request failed.";
        logger.warn("hyperliquid.order.failed", { type: body.type, error: String(err) });
        json(reply, 500, { ok: false, error: message || "Hyperliquid order request failed." });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dydx") {
      const type = url.searchParams.get("type");
      if (type === "markets") {
        json(reply, 200, await getDydxMarkets());
        return;
      }
      if (type === "account") {
        json(reply, 200, await getDydxAccount(url.searchParams.get("address") || ""));
        return;
      }
      if (type === "ohlcv") {
        const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
        const interval = url.searchParams.get("interval") || "1h";
        const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
        json(reply, 200, await getDydxCandles(ticker, interval, limit));
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/api/news") {
      const newsCacheKey = buildHttpCacheKey(url.pathname, url.searchParams);
      const cachedNews = await upstashCache.getJson(newsCacheKey);
      if (cachedNews) {
        json(reply, 200, cachedNews);
        return;
      }
      const payload = terminalData.getNews({
        sector: url.searchParams.get("sector"),
        ticker: url.searchParams.get("ticker")
          ? canonicalTickerParam(url.searchParams.get("ticker"), "BTC")
          : null,
        keyword: url.searchParams.get("keyword"),
      });
      void upstashCache.setJson(newsCacheKey, payload, upstashCache.ttl.newsSec);
      json(reply, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/news/snapshot") {
      json(reply, 200, terminalData.getNewsSnapshot());
      return;
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/api/whales" || url.pathname === "/api/whale")
    ) {
      json(reply, 200, terminalData.getWhales());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/whales/events") {
      json(reply, 200, terminalData.getWhaleEvents());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/social") {
      json(reply, 200, terminalData.getSocial());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/analysis") {
      const kind = (url.searchParams.get("kind") || "news").toLowerCase() === "whale" ? "whale" : "news";
      const id = url.searchParams.get("id") || "";
      const analysis = terminalData.getEventAnalysis({ kind, id });
      if (!analysis) {
        json(reply, 404, { error: "Analysis target not found" });
        return;
      }
      json(reply, 200, analysis);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/coins/meta") {
      json(reply, 200, buildSnapshot().coinMetadata || {});
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/venues/symbols") {
      const venue = (url.searchParams.get("venue") || "binance").toLowerCase();
      const quote = (url.searchParams.get("quote") || "USDT").toUpperCase();
      try {
        const symbols = await getVenueSymbols(venue, quote);
        if (Array.isArray(symbols) && symbols.length > 0) {
          json(reply, 200, symbols);
          return;
        }
        throw new Error("empty_symbols");
      } catch {
        const fallback = [...CORE_SYMBOLS, ...(buildSnapshot().quotes || []).map((q) => q.symbol)];
        json(reply, 200, uniqueSortedSymbols(fallback));
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/symbols") {
      const venue = (url.searchParams.get("venue") || "").toLowerCase();
      const quote = (url.searchParams.get("quote") || "USDT").toUpperCase();
      const snapshot = buildSnapshot();
      const seen = new Set();
      let venueSymbols = [];
      if (venue) {
        try {
          venueSymbols = await getVenueSymbols(venue, quote);
        } catch {
          venueSymbols = [];
        }
      }
      const merged = [
        ...(venueSymbols.length > 0 ? venueSymbols : CORE_SYMBOLS),
        ...(snapshot.quotes || []).map((item) => item.symbol),
      ];
      const symbols = [];
      for (const raw of merged) {
        const canonical = canonicalSymbol(raw);
        if (!canonical || seen.has(canonical)) continue;
        seen.add(canonical);
        symbols.push({
          symbol: canonical,
          aliases: symbolAliases(canonical),
        });
      }
      json(reply, 200, symbols);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/market") {
      json(reply, 200, await getMarketStats());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/mempool") {
      json(reply, 200, await getMempoolStats());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feargreed") {
      json(reply, 200, await getFearGreed());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/liquidations") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);
      json(reply, 200, terminalData.getLiquidations(limit));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/forex") {
      // Frankfurter (ECB) forex rates — EUR/USD, GBP/USD, USD/JPY — free, no key
      json(reply, 200, await getForexRates());
      return;
    }

    // Long/Short Account Ratio (Binance Futures, free, no key) ─────────────────
    if (request.method === "GET" && url.pathname === "/api/lsr") {
      const symbol = canonicalTickerParam(url.searchParams.get("symbol"), "BTC");
      const period = url.searchParams.get("period") || "1h";
      const limit  = Math.min(Number(url.searchParams.get("limit") || 24), 500);
      try {
        const rows = await endpointCache.remember(`lsr:${symbol}:${period}:${limit}`, config.dataTtl.lsrMs, async () => {
          const res = await fetch(
            `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}USDT&period=${period}&limit=${limit}`,
            { signal: AbortSignal.timeout(5000) }
          );
          const data = await res.json();
          return (Array.isArray(data) ? data : []).map((row) => ({
            symbol,
            longShortRatio: parseFloat(row.longShortRatio || "1"),
            longAccount: parseFloat(row.longAccount || "0.5"),
            shortAccount: parseFloat(row.shortAccount || "0.5"),
            timestamp: Number(row.timestamp || Date.now()),
          }));
        });
        json(reply, 200, rows);
      } catch {
        json(reply, 200, []);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/coincap") {
      if (config.featureFlags.enableCoincap === false) {
        json(reply, 200, []);
        return;
      }
      try {
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
        const assets = await endpointCache.remember(`coincap:${limit}`, config.dataTtl.coincapMs, async () => {
          const res = await fetch(`https://api.coincap.io/v2/assets?limit=${limit}`, { signal: AbortSignal.timeout(6000) });
          const data = await res.json();
          return (data?.data || []).map((a) => ({
            id: a.id,
            symbol: (a.symbol || "").toUpperCase(),
            name: a.name,
            rank: Number(a.rank),
            priceUsd: a.priceUsd ? Number(a.priceUsd) : null,
            changePercent24h: a.changePercent24Hr ? Number(a.changePercent24Hr) : null,
            marketCapUsd: a.marketCapUsd ? Number(a.marketCapUsd) : null,
            volumeUsd24h: a.volumeUsd24Hr ? Number(a.volumeUsd24Hr) : null,
            supply: a.supply ? Number(a.supply) : null,
            maxSupply: a.maxSupply ? Number(a.maxSupply) : null,
            vwap24h: a.vwap24Hr ? Number(a.vwap24Hr) : null,
          }));
        });
        json(reply, 200, assets);
      } catch {
        json(reply, 200, []);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/leverage-brackets") {
      try {
        const result = await endpointCache.remember("leverage:brackets", config.dataTtl.leverageBracketsMs, async () => {
          const r0 = await fetch("https://fapi.binance.com/fapi/v1/leverageBracket", { signal: AbortSignal.timeout(6000) });
          const data = await r0.json();
          const next = {};
          for (const item of (Array.isArray(data) ? data : [])) {
            if (!item.symbol || !Array.isArray(item.brackets) || item.brackets.length === 0) continue;
            const maxBracket = item.brackets[0];
            next[item.symbol.replace("USDT", "")] = maxBracket.initialLeverage ?? 20;
          }
          return next;
        });
        json(reply, 200, result);
      } catch {
        json(reply, 200, {});
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/funding") {
      if (config.featureFlags.enableBinanceFunding === false) {
        json(reply, 200, []);
        return;
      }
      try {
        const filtered = await endpointCache.remember("funding:binance", config.dataTtl.fundingMs, async () => {
          const r1 = await fetch("https://fapi.binance.com/fapi/v1/premiumIndex", { signal: AbortSignal.timeout(5000) });
          const data = await r1.json();
          const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","ARBUSDT","INJUSDT","NEARUSDT","OPUSDT","DOTUSDT","SUIUSDT","APTUSDT","ATOMUSDT","HYPEUSDT"];
          return (Array.isArray(data) ? data : [])
            .filter((item) => SYMBOLS.includes(item.symbol))
            .map((item) => ({
              symbol: item.symbol,
              fundingRate: item.lastFundingRate,
              nextFundingTime: item.nextFundingTime,
            }))
            .sort((a, b) => Math.abs(Number(b.fundingRate)) - Math.abs(Number(a.fundingRate)));
        });
        json(reply, 200, filtered);
      } catch {
        json(reply, 200, []);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/chat") {
      json(reply, 200, {
        provider: getProviderLabel(config),
        externalEnabled: Boolean(config?.ai?.allowExternal),
        limits: {
          perMinute: Number(config?.ai?.maxRequestsPerMinute || 12),
          perDay: Number(config?.ai?.maxRequestsPerDay || 200),
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJson(request);
      const clientIp = getClientIp(request);
      const requestId = crypto.randomUUID();
      const primaryProvider = getPrimaryAiProvider(config);
      logger.info("ai.chat.request", {
        requestId,
        clientIp,
        primaryProvider,
        externalEnabled: Boolean(config?.ai?.allowExternal),
      });

      reply.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      for await (const packet of streamChat(config, body, { consumerKey: clientIp })) {
        if (packet?.type === "meta") {
          logger.info("ai.chat.provider_selected", {
            requestId,
            clientIp,
            primaryProvider,
            selectedProvider: packet.provider || "unknown",
            usedFallback: String(packet.provider || "") !== String(primaryProvider),
          });
          reply.write(`data: ${JSON.stringify({ provider: packet.provider })}\n\n`);
          continue;
        }
        if (packet?.type === "chunk" && packet.text) {
          reply.write(`data: ${JSON.stringify({ text: packet.text })}\n\n`);
        }
      }
      reply.write("data: [DONE]\n\n");
      reply.end();
      logger.info("ai.chat.completed", { requestId, clientIp });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/sentiment") {
      const body = await readJson(request);
      json(reply, 200, classifySentiment(body.headline || ""));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/vault/store") {
      const body = await readJson(request);
      const scope = normalizeVenueId(body.scope || body.venueId || "generic");
      const sanitizedPayload = sanitizeVaultPayload(scope, body.payload || body);
      if (
        (scope === "hyperliquid" && !sanitizedPayload.privateKey) ||
        (scope !== "hyperliquid" && (!sanitizedPayload.apiKey || !sanitizedPayload.apiSecret))
      ) {
        json(reply, 400, { ok: false, message: "Missing required credentials." });
        return;
      }
      const token = storeSecret(scope, sanitizedPayload);
      json(reply, 200, { ok: true, sessionToken: token });
      return;
    }

    if ((request.method === "POST" || request.method === "DELETE") && url.pathname === "/api/vault/clear") {
      const body = await readJson(request);
      const token = String(body.token || body.sessionToken || "");
      if (token.length < 16) {
        json(reply, 200, { ok: false });
        return;
      }
      json(reply, 200, { ok: clearSecret(token) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/vault/status") {
      const token = url.searchParams.get("token") || "";
      if (String(token).length < 16) {
        json(reply, 200, { ok: false });
        return;
      }
      json(reply, 200, { ok: Boolean(getSecret(token)) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/venues/validate") {
      const body = await readJson(request);
      const token = String(body.sessionToken || "");
      const entry = token ? getSecret(token) : null;
      const scope = entry?.scope || "";
      if (!entry || !["binance", "okx", "bybit"].includes(scope)) {
        json(reply, 401, { ok: false, message: "Session expired. Re-save your credentials." });
        return;
      }
      try {
        if (scope === "binance") {
          const apiKey = entry?.payload?.apiKey || "";
          const apiSecret = entry?.payload?.apiSecret || "";
          const testnet = entry?.payload?.testnet || false;
          const base = testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
          if (!apiKey || !apiSecret) {
            json(reply, 401, { ok: false, message: "Session expired. Re-save your credentials." });
            return;
          }
          const qs = binanceSignedQuery(apiSecret);
          const res = await fetch(`${base}/fapi/v2/balance?${qs}`, { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (!res.ok) {
            json(reply, 200, { ok: false, message: data.msg || `Binance error ${res.status}` });
            return;
          }
          const usdt = Array.isArray(data) ? data.find((b) => b.asset === "USDT") : null;
          json(reply, 200, { ok: true, message: `Connected${usdt ? ` · USDT balance: ${parseFloat(usdt.availableBalance || "0").toFixed(2)}` : ""}` });
          return;
        }

        if (scope === "okx") {
          const apiKey = entry?.payload?.apiKey || "";
          const apiSecret = entry?.payload?.apiSecret || "";
          const passphrase = entry?.payload?.passphrase || "";
          const testnet = Boolean(entry?.payload?.testnet);
          if (!apiKey || !apiSecret || !passphrase) {
            json(reply, 401, { ok: false, message: "Session expired. Re-save your credentials." });
            return;
          }
          const path = "/api/v5/account/balance?ccy=USDT";
          const headers = okxSign({
            secret: apiSecret,
            passphrase,
            apiKey,
            method: "GET",
            requestPath: path,
          });
          if (testnet) headers["x-simulated-trading"] = "1";
          const res = await fetch(`https://www.okx.com${path}`, { headers, signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (!res.ok || data?.code !== "0") {
            json(reply, 200, { ok: false, message: data?.msg || `OKX error ${res.status}` });
            return;
          }
          const details = Array.isArray(data?.data?.[0]?.details) ? data.data[0].details : [];
          const usdt = details.find((row) => row.ccy === "USDT");
          json(reply, 200, {
            ok: true,
            message: `Connected${usdt ? ` · USDT available: ${parseFloat(usdt.availEq || usdt.cashBal || "0").toFixed(2)}` : ""}`,
          });
          return;
        }

        if (scope === "bybit") {
          const apiKey = entry?.payload?.apiKey || "";
          const apiSecret = entry?.payload?.apiSecret || "";
          const testnet = Boolean(entry?.payload?.testnet);
          const base = testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
          if (!apiKey || !apiSecret) {
            json(reply, 401, { ok: false, message: "Session expired. Re-save your credentials." });
            return;
          }
          const query = "accountType=UNIFIED";
          const headers = bybitSign({
            secret: apiSecret,
            apiKey,
            method: "GET",
            query,
          });
          const res = await fetch(`${base}/v5/account/wallet-balance?${query}`, {
            headers,
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          if (!res.ok || Number(data?.retCode) !== 0) {
            json(reply, 200, { ok: false, message: data?.retMsg || `Bybit error ${res.status}` });
            return;
          }
          const coins = Array.isArray(data?.result?.list?.[0]?.coin) ? data.result.list[0].coin : [];
          const usdt = coins.find((row) => row.coin === "USDT");
          json(reply, 200, {
            ok: true,
            message: `Connected${usdt ? ` · USDT available: ${parseFloat(usdt.walletBalance || "0").toFixed(2)}` : ""}`,
          });
          return;
        }
      } catch (err) {
        logger.warn("venues.validate.failed", { venue: scope, error: String(err) });
        json(reply, 200, { ok: false, message: "Validation request failed. Please try again." });
        return;
      }
      json(reply, 400, { ok: false, message: "Unsupported venue." });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/binance") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "binance") {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
        return;
      }
      if (!["balance", "positions"].includes(String(body.type || ""))) {
        json(reply, 400, { error: "Unknown type" });
        return;
      }
      const { apiKey, apiSecret, testnet } = entry.payload;
      const base = testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
      try {
        if (body.type === "balance") {
          const qs = binanceSignedQuery(apiSecret);
          const res = await fetch(`${base}/fapi/v2/balance?${qs}`, { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.msg || `Binance error ${res.status}`);
          const usdt = data.find((b) => b.asset === "USDT");
          json(reply, 200, { total: parseFloat(usdt?.balance || "0"), available: parseFloat(usdt?.availableBalance || "0"), currency: "USDT" });
          return;
        }
        if (body.type === "positions") {
          const [positionResp, openOrders] = await Promise.all([
            (async () => {
              const qs = binanceSignedQuery(apiSecret);
              const res = await fetch(`${base}/fapi/v2/positionRisk?${qs}`, {
                headers: { "X-MBX-APIKEY": apiKey },
                signal: AbortSignal.timeout(8000),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.msg || `Binance error ${res.status}`);
              return data;
            })(),
            (async () => {
              try {
                const qs = binanceSignedQuery(apiSecret);
                const res = await fetch(`${base}/fapi/v1/openOrders?${qs}`, {
                  headers: { "X-MBX-APIKEY": apiKey },
                  signal: AbortSignal.timeout(5000),
                });
                const data = await res.json();
                return Array.isArray(data) ? data : [];
              } catch {
                return [];
              }
            })(),
          ]);
          const tpslByKey = new Map();
          for (const order of openOrders) {
            const ordType = String(order?.type || "").toUpperCase();
            if (ordType !== "STOP_MARKET" && ordType !== "TAKE_PROFIT_MARKET") continue;
            const orderSymbol = String(order?.symbol || "");
            if (!orderSymbol.endsWith("USDT") && !orderSymbol.endsWith("USDC")) continue;
            const baseCoin = orderSymbol.replace(/USDT$|USDC$/i, "");
            const closeSide = String(order?.side || "").toUpperCase();
            const positionSide = closeSide === "SELL" ? "long" : "short";
            const key = `${baseCoin}_${positionSide}`;
            const current = tpslByKey.get(key) || {};
            const trigger = finitePositiveNumber(order?.stopPrice);
            if (!trigger) continue;
            if (ordType === "TAKE_PROFIT_MARKET" && !current.tpPrice) {
              current.tpPrice = trigger;
            }
            if (ordType === "STOP_MARKET" && !current.slPrice) {
              current.slPrice = trigger;
            }
            tpslByKey.set(key, current);
          }
          const data = positionResp;
          const positions = data
            .filter((p) => parseFloat(p.positionAmt) !== 0)
            .map((p) => {
              const size = parseFloat(p.positionAmt);
              const coin = p.symbol.replace(/USDT$/, "");
              const side = size > 0 ? "long" : "short";
              const key = `${coin}_${side}`;
              const tpsl = tpslByKey.get(key) || {};
              return {
                coin,
                side,
                size: Math.abs(size),
                entryPx: parseFloat(p.entryPrice),
                pnl: parseFloat(p.unRealizedProfit),
                liquidationPx: parseFloat(p.liquidationPrice) || null,
                leverage: parseInt(p.leverage) || 1,
                marginMode: p.marginType === "cross" ? "cross" : "isolated",
                tpPrice: tpsl.tpPrice,
                slPrice: tpsl.slPrice,
              };
            });
          json(reply, 200, { positions });
          return;
        }
        json(reply, 400, { error: "Unknown type" });
      } catch (err) {
        logger.warn("binance.data.failed", { type: body.type, error: String(err) });
        json(reply, 500, { error: "Binance request failed." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/binance/order") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "binance") {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const action = String(body.type || "");
      if (!["leverage", "marginType", "cancel", "closePosition", "tpsl", "order"].includes(action)) {
        json(reply, 400, { ok: false, error: "Unknown action type" });
        return;
      }
      const symbol = normalizeTradeSymbol(body.symbol, body.quoteAsset || "USDT");
      if (!/^[A-Z0-9]{4,20}$/.test(symbol)) {
        json(reply, 400, { ok: false, error: "Invalid symbol." });
        return;
      }
      if (["order", "closePosition", "tpsl"].includes(action) && !["long", "short"].includes(String(body.side || ""))) {
        json(reply, 400, { ok: false, error: "Invalid side." });
        return;
      }
      const { apiKey, apiSecret, testnet } = entry.payload;
      const base = testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
      try {
        const binancePost = async (path, params) => {
          const qs = binanceSignedQuery(apiSecret, params);
          const res = await fetch(`${base}${path}?${qs}`, { method: "POST", headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (!res.ok && data.code !== -4046) throw new Error(data.msg || `Binance error ${res.status}`);
          return data;
        };
        const binanceDelete = async (path, params) => {
          const qs = binanceSignedQuery(apiSecret, params);
          const res = await fetch(`${base}${path}?${qs}`, { method: "DELETE", headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(10000) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.msg || `Binance error ${res.status}`);
          return data;
        };
        if (body.type === "leverage") {
          const leverage = Math.max(1, Math.min(125, Math.round(Number(body.leverage) || 1)));
          await binancePost("/fapi/v1/leverage", { symbol, leverage: String(leverage) });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "marginType") {
          await binancePost("/fapi/v1/marginType", { symbol, marginType: body.marginMode === "cross" ? "CROSSED" : "ISOLATED" });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "cancel") {
          await binanceDelete("/fapi/v1/order", { symbol, orderId: String(body.orderId) });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "closePosition") {
          const closePercent = Math.max(1, Math.min(100, Number(body.closePercent) || 100));
          // 1. Cancel all open conditional orders (TP/SL) for this symbol first
          try {
            const qs0 = binanceSignedQuery(apiSecret, { symbol });
            await fetch(`${base}/fapi/v1/allOpenOrders?${qs0}`, {
              method: "DELETE", headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(5000)
            });
          } catch { /* ignore — no open orders is fine */ }

          // 2. Fetch current position size from Binance for accurate quantity
          const qsPos = binanceSignedQuery(apiSecret, { symbol });
          const posRes = await fetch(`${base}/fapi/v2/positionRisk?${qsPos}`, {
            headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(5000)
          });
          const posData = await posRes.json();
          const posEntry = Array.isArray(posData) ? posData.find((p) => p.symbol === symbol) : null;
          const posAmt = posEntry ? Math.abs(parseFloat(posEntry.positionAmt)) : null;
          if (!posAmt || posAmt === 0) {
            json(reply, 200, { ok: true, data: { msg: "No open position found" } });
            return;
          }
          const closeQty = posAmt * (closePercent / 100);
          const quantity = await normalizeBinanceQuantity(base, symbol, closeQty);
          if (!quantity) {
            json(reply, 400, { ok: false, error: "Close quantity is below minimum lot size for this contract." });
            return;
          }

          // 3. Market order with reduceOnly=true + exact quantity (closePosition=true is NOT valid for MARKET type)
          const closeSide = body.side === "long" ? "SELL" : "BUY";
          const result = await binancePost("/fapi/v1/order", {
            symbol, side: closeSide, type: "MARKET",
            quantity, reduceOnly: "true",
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "tpsl") {
          // Place TP and/or SL conditional orders with closePosition=true
          const tpslSide = body.side === "long" ? "SELL" : "BUY";
          const results = [];
          if (body.tpPrice) {
            const normalizedTp = await normalizeBinancePrice(base, symbol, body.tpPrice);
            if (!normalizedTp) {
              json(reply, 400, { ok: false, error: "Invalid TP price." });
              return;
            }
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "TAKE_PROFIT_MARKET",
              stopPrice: normalizedTp, closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            results.push({ tp: r });
          }
          if (body.slPrice) {
            const normalizedSl = await normalizeBinancePrice(base, symbol, body.slPrice);
            if (!normalizedSl) {
              json(reply, 400, { ok: false, error: "Invalid SL price." });
              return;
            }
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "STOP_MARKET",
              stopPrice: normalizedSl, closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            results.push({ sl: r });
          }
          json(reply, 200, { ok: true, data: results });
          return;
        }
        if (body.type === "order") {
          const marginAmount = finitePositiveNumber(body.marginAmount);
          const leverage = Math.max(1, Math.min(125, Math.round(Number(body.leverage) || 1)));
          if (!marginAmount) {
            json(reply, 400, { ok: false, error: "Invalid margin amount." });
            return;
          }
          // Pre-set margin type and leverage before placing
          const marginType = body.marginMode === "cross" ? "CROSSED" : "ISOLATED";
          await binancePost("/fapi/v1/marginType", { symbol, marginType }).catch(() => {});
          await binancePost("/fapi/v1/leverage", { symbol, leverage: String(leverage) });
          // Fetch mark price
          const mpRes = await fetch(`${base}/fapi/v1/premiumIndex?symbol=${symbol}`, { signal: AbortSignal.timeout(5000) });
          const mpData = await mpRes.json();
          const markPrice = parseFloat(mpData.markPrice || "0");
          if (!markPrice) throw new Error(`Could not fetch mark price for ${symbol}`);
          const qty = (marginAmount * leverage) / markPrice;
          const quantity = await normalizeBinanceQuantity(base, symbol, qty);
          if (!quantity) {
            json(reply, 400, { ok: false, error: "Order size is below minimum lot size for this symbol." });
            return;
          }
          const side = body.side === "long" ? "BUY" : "SELL";
          const params = { symbol, side, quantity };
          if (body.orderType === "market") {
            params.type = "MARKET";
          } else if (body.orderType === "limit") {
            const limitPrice = await normalizeBinancePrice(base, symbol, body.limitPrice);
            if (!limitPrice) {
              json(reply, 400, { ok: false, error: "Invalid limit price." });
              return;
            }
            params.type = "LIMIT";
            params.price = limitPrice;
            params.timeInForce = "GTC";
          } else {
            const stopPrice = await normalizeBinancePrice(base, symbol, body.limitPrice);
            if (!stopPrice) {
              json(reply, 400, { ok: false, error: "Invalid stop price." });
              return;
            }
            params.type = "STOP_MARKET";
            params.stopPrice = stopPrice;
          }
          const result = await binancePost("/fapi/v1/order", params);
          // Place TP / SL conditional orders if provided
          const tpslSide = body.side === "long" ? "SELL" : "BUY";
          const tpslResults = [];
          if (body.tpPrice) {
            const normalizedTp = await normalizeBinancePrice(base, symbol, body.tpPrice);
            if (!normalizedTp) {
              json(reply, 400, { ok: false, error: "Invalid TP price." });
              return;
            }
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "TAKE_PROFIT_MARKET",
              stopPrice: normalizedTp, closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            tpslResults.push({ tp: r });
          }
          if (body.slPrice) {
            const normalizedSl = await normalizeBinancePrice(base, symbol, body.slPrice);
            if (!normalizedSl) {
              json(reply, 400, { ok: false, error: "Invalid SL price." });
              return;
            }
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "STOP_MARKET",
              stopPrice: normalizedSl, closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            tpslResults.push({ sl: r });
          }
          json(reply, 200, { ok: true, data: result, tpsl: tpslResults });
          return;
        }
        json(reply, 400, { ok: false, error: "Unknown action type" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Binance order request failed.";
        logger.warn("binance.order.failed", { type: body.type, symbol, error: String(err) });
        const isClientIssue = /(insufficient|invalid|minimum|size|margin|leverage|position|instrument|parameter|order)/i.test(message);
        json(reply, isClientIssue ? 400 : 500, { ok: false, error: message || "Order request failed." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/okx") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "okx") {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
        return;
      }
      const apiKey = entry.payload?.apiKey || "";
      const apiSecret = entry.payload?.apiSecret || "";
      const passphrase = entry.payload?.passphrase || "";
      const testnet = Boolean(entry.payload?.testnet);
      if (!apiKey || !apiSecret || !passphrase) {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
        return;
      }
      const requestOkx = async (method, requestPath, payload = null) => {
        const bodyStr = payload ? JSON.stringify(payload) : "";
        const headers = okxSign({
          secret: apiSecret,
          passphrase,
          apiKey,
          method,
          requestPath,
          body: bodyStr,
        });
        if (testnet) headers["x-simulated-trading"] = "1";
        const res = await fetch(`https://www.okx.com${requestPath}`, {
          method,
          headers,
          body: bodyStr || undefined,
          signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json();
        if (!res.ok || data?.code !== "0") {
          throw new Error(data?.msg || `OKX error ${res.status}`);
        }
        return data;
      };
      try {
        if (body.type === "balance") {
          const data = await requestOkx("GET", "/api/v5/account/balance?ccy=USDT");
          const details = Array.isArray(data?.data?.[0]?.details) ? data.data[0].details : [];
          const usdt = details.find((row) => row.ccy === "USDT");
          const total = parseFloat(usdt?.eq || usdt?.cashBal || "0");
          const available = parseFloat(usdt?.availEq || usdt?.cashBal || "0");
          json(reply, 200, { total, available, currency: "USDT" });
          return;
        }
        if (body.type === "positions") {
          const data = await requestOkx("GET", "/api/v5/account/positions?instType=SWAP");
          const rows = (Array.isArray(data?.data) ? data.data : [])
            .filter((row) => Math.abs(parseFloat(row.pos || "0")) > 0);
          const [conditionalAlgos, ocoAlgos] = await Promise.all([
            requestOkx("GET", "/api/v5/trade/orders-algo-pending?ordType=conditional&instType=SWAP").catch(() => ({ data: [] })),
            requestOkx("GET", "/api/v5/trade/orders-algo-pending?ordType=oco&instType=SWAP").catch(() => ({ data: [] })),
          ]);
          const algoRows = [
            ...(Array.isArray(conditionalAlgos?.data) ? conditionalAlgos.data : []),
            ...(Array.isArray(ocoAlgos?.data) ? ocoAlgos.data : []),
          ];
          const tpslByKey = new Map();
          for (const algo of algoRows) {
            const algoInstId = String(algo?.instId || "");
            if (!algoInstId) continue;
            const algoPosSideRaw = String(algo?.posSide || "").toLowerCase();
            const algoPosSide = algoPosSideRaw === "short" ? "short" : "long";
            const key = `${algoInstId}_${algoPosSide}`;
            const current = tpslByKey.get(key) || {};
            const nextTp = finitePositiveNumber(algo?.tpTriggerPx || algo?.tpOrdPx);
            const nextSl = finitePositiveNumber(algo?.slTriggerPx || algo?.slOrdPx);
            tpslByKey.set(key, {
              tpPrice: current.tpPrice || nextTp,
              slPrice: current.slPrice || nextSl,
            });
          }
          const instIds = Array.from(new Set(rows.map((row) => String(row.instId || "")).filter(Boolean)));
          const contractValueMap = new Map();
          await Promise.all(
            instIds.map(async (instId) => {
              contractValueMap.set(instId, await getOkxContractValue(instId));
            }),
          );

          const positions = rows.map((row) => {
            const contracts = Math.abs(parseFloat(row.pos || "0"));
            const instId = String(row.instId || "");
            const contractValue = Number(contractValueMap.get(instId) || 1);
            // OKX reports `pos` in contracts. Convert to base-asset quantity for UI parity.
            const size = contracts * contractValue;
            const symbol = instId.split("-")[0] || "BTC";
            const signedPos = parseFloat(row.pos || "0");
            const sideRaw = String(row.posSide || row.direction || "").toLowerCase();
            const side = sideRaw === "short" || (sideRaw !== "long" && signedPos < 0) ? "short" : "long";
            const tpslKey = `${instId}_${side}`;
            const algoTpSl = tpslByKey.get(tpslKey);
            return {
              coin: symbol,
              side,
              size,
              entryPx: parseFloat(row.avgPx || "0"),
              pnl: parseFloat(row.upl || "0"),
              liquidationPx: parseFloat(row.liqPx || "0") || null,
              leverage: parseInt(row.lever || "1", 10) || 1,
              marginMode: String(row.mgnMode || "").toLowerCase() === "cross" ? "cross" : "isolated",
              tpPrice: algoTpSl?.tpPrice || finitePositiveNumber(row.tpTriggerPx || row.tpOrdPx),
              slPrice: algoTpSl?.slPrice || finitePositiveNumber(row.slTriggerPx || row.slOrdPx),
            };
          });
          json(reply, 200, { positions });
          return;
        }
        json(reply, 400, { error: "Unknown type" });
      } catch (err) {
        logger.warn("okx.data.failed", { type: body.type, error: String(err) });
        json(reply, 500, { error: "OKX request failed." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/bybit") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "bybit") {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
        return;
      }
      const apiKey = entry.payload?.apiKey || "";
      const apiSecret = entry.payload?.apiSecret || "";
      const testnet = Boolean(entry.payload?.testnet);
      const base = testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
      if (!apiKey || !apiSecret) {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
        return;
      }
        const requestBybit = async (method, path, query = "", payload = null) => {
        const bodyStr = payload ? JSON.stringify(payload) : "";
        const headers = bybitSign({
          secret: apiSecret,
          apiKey,
          method,
          query,
          body: bodyStr,
        });
        const url = `${base}${path}${query ? `?${query}` : ""}`;
        const res = await fetch(url, {
          method,
          headers,
          body: bodyStr || undefined,
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok || Number(data?.retCode) !== 0) {
          throw new Error(data?.retMsg || `Bybit error ${res.status}`);
        }
        return data;
      };
      try {
        if (body.type === "balance") {
          const data = await requestBybit("GET", "/v5/account/wallet-balance", "accountType=UNIFIED");
          const coins = Array.isArray(data?.result?.list?.[0]?.coin) ? data.result.list[0].coin : [];
          const usdt = coins.find((row) => row.coin === "USDT");
          json(reply, 200, {
            total: parseFloat(usdt?.equity || usdt?.walletBalance || "0"),
            available: parseFloat(usdt?.walletBalance || "0"),
            currency: "USDT",
          });
          return;
        }
        if (body.type === "positions") {
          const data = await requestBybit("GET", "/v5/position/list", "category=linear&settleCoin=USDT");
          const rows = Array.isArray(data?.result?.list) ? data.result.list : [];
          const positions = rows
            .filter((row) => Math.abs(parseFloat(row.size || "0")) > 0)
            .map((row) => ({
              coin: String(row.symbol || "").replace(/USDT$/i, ""),
              side: String(row.side || "").toLowerCase() === "sell" ? "short" : "long",
              size: Math.abs(parseFloat(row.size || "0")),
              entryPx: parseFloat(row.avgPrice || "0"),
              pnl: parseFloat(row.unrealisedPnl || "0"),
              liquidationPx: parseFloat(row.liqPrice || "0") || null,
              leverage: parseInt(row.leverage || "1", 10) || 1,
              marginMode: String(row.tradeMode || row.positionIM || "").toLowerCase().includes("cross") ? "cross" : "isolated",
              tpPrice: finitePositiveNumber(row.takeProfit),
              slPrice: finitePositiveNumber(row.stopLoss),
            }));
          json(reply, 200, { positions });
          return;
        }
        json(reply, 400, { error: "Unknown type" });
      } catch (err) {
        logger.warn("bybit.data.failed", { type: body.type, error: String(err) });
        json(reply, 500, { error: "Bybit request failed." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/bybit/order") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "bybit") {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const apiKey = entry.payload?.apiKey || "";
      const apiSecret = entry.payload?.apiSecret || "";
      const testnet = Boolean(entry.payload?.testnet);
      const base = testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
      if (!apiKey || !apiSecret) {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const symbol = normalizeTradeSymbol(body.symbol, body.quoteAsset || "USDT");
      const requestBybit = async (method, path, query = "", payload = null) => {
        const bodyStr = payload ? JSON.stringify(payload) : "";
        const headers = bybitSign({
          secret: apiSecret,
          apiKey,
          method,
          query,
          body: bodyStr,
        });
        const url = `${base}${path}${query ? `?${query}` : ""}`;
        const res = await fetch(url, { method, headers, body: bodyStr || undefined, signal: AbortSignal.timeout(8_000) });
        const data = await res.json();
        if (!res.ok || Number(data?.retCode) !== 0) throw new Error(data?.retMsg || `Bybit error ${res.status}`);
        return data;
      };
      try {
        if (body.type === "leverage") {
          const leverage = String(Math.max(1, Math.min(100, Math.round(Number(body.leverage) || 1))));
          await requestBybit("POST", "/v5/position/set-leverage", "", {
            category: "linear",
            symbol,
            buyLeverage: leverage,
            sellLeverage: leverage,
          });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "marginType") {
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "cancel") {
          await requestBybit("POST", "/v5/order/cancel", "", {
            category: "linear",
            symbol,
            orderId: String(body.orderId || ""),
          });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "closePosition") {
          const closePercent = Math.max(1, Math.min(100, Number(body.closePercent) || 100));
          const side = body.side === "short" ? "Buy" : "Sell";
          const posData = await requestBybit("GET", "/v5/position/list", `category=linear&symbol=${encodeURIComponent(symbol)}`);
          const pos = Array.isArray(posData?.result?.list)
            ? posData.result.list.find((row) => String(row.symbol || "").toUpperCase() === symbol)
            : null;
          const size = Math.abs(parseFloat(pos?.size || "0"));
          if (!size) {
            json(reply, 200, { ok: true, data: { message: "No open position found." } });
            return;
          }
          const closeQty = size * (closePercent / 100);
          const qty = closeQty >= 100 ? closeQty.toFixed(0) : closeQty >= 1 ? closeQty.toFixed(2) : closeQty.toFixed(3);
          const result = await requestBybit("POST", "/v5/order/create", "", {
            category: "linear",
            symbol,
            side,
            orderType: "Market",
            qty,
            reduceOnly: true,
            closeOnTrigger: true,
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "tpsl") {
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          if (!tp && !sl) {
            json(reply, 400, { ok: false, error: "Provide TP and/or SL price." });
            return;
          }
          const markPrice = parseFloat((await fetch(`${base}/v5/market/tickers?category=linear&symbol=${symbol}`, {
            signal: AbortSignal.timeout(5000),
          }).then((r) => r.json()))?.result?.list?.[0]?.markPrice || "0");
          const isShort = body.side === "short";
          if (tp && (!isShort ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (!isShort ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          let result;
          try {
            result = await requestBybit("POST", "/v5/position/trading-stop", "", {
              category: "linear",
              symbol,
              tpslMode: "Full",
              positionIdx: isShort ? 2 : 1,
              ...(tp ? { takeProfit: String(tp), tpTriggerBy: "LastPrice" } : {}),
              ...(sl ? { stopLoss: String(sl), slTriggerBy: "LastPrice" } : {}),
            });
          } catch {
            // One-way mode fallback.
            result = await requestBybit("POST", "/v5/position/trading-stop", "", {
              category: "linear",
              symbol,
              tpslMode: "Full",
              positionIdx: 0,
              ...(tp ? { takeProfit: String(tp), tpTriggerBy: "LastPrice" } : {}),
              ...(sl ? { stopLoss: String(sl), slTriggerBy: "LastPrice" } : {}),
            });
          }
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "order") {
          const mp = await fetch(`${base}/v5/market/tickers?category=linear&symbol=${symbol}`, {
            signal: AbortSignal.timeout(5000),
          }).then((r) => r.json());
          const markPrice = parseFloat(mp?.result?.list?.[0]?.markPrice || "0");
          const marginAmount = finitePositiveNumber(body.marginAmount);
          const leverage = Math.max(1, Math.min(100, Math.round(Number(body.leverage) || 1)));
          if (!markPrice || !marginAmount) {
            json(reply, 400, { ok: false, error: "Invalid margin amount or mark price." });
            return;
          }
          const qty = (marginAmount * leverage) / markPrice;
          const qtyStr = qty >= 100 ? qty.toFixed(0) : qty >= 1 ? qty.toFixed(2) : qty.toFixed(3);
          const side = body.side === "short" ? "Sell" : "Buy";
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          const isShort = side === "Sell";
          if (tp && (!isShort ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (!isShort ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          const payload = {
            category: "linear",
            symbol,
            side,
            orderType: body.orderType === "limit" ? "Limit" : "Market",
            qty: qtyStr,
            ...(body.orderType === "limit" && body.limitPrice ? { price: String(body.limitPrice), timeInForce: "GTC" } : {}),
            ...(tp ? { takeProfit: String(tp), tpTriggerBy: "LastPrice" } : {}),
            ...(sl ? { stopLoss: String(sl), slTriggerBy: "LastPrice" } : {}),
            ...((tp || sl) ? { tpslMode: "Full" } : {}),
          };
          const result = await requestBybit("POST", "/v5/order/create", "", payload);
          json(reply, 200, { ok: true, data: result });
          return;
        }
        json(reply, 400, { ok: false, error: "Unknown action type" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bybit order request failed.";
        logger.warn("bybit.order.failed", { type: body.type, symbol, error: String(err) });
        const isClientIssue = /(insufficient|invalid|minimum|size|margin|leverage|position|instrument|parameter|order)/i.test(message);
        json(reply, isClientIssue ? 400 : 500, { ok: false, error: message || "Bybit order request failed." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/okx/order") {
      const body = await readJson(request);
      const entry = getSecret(String(body.sessionToken || ""));
      if (!entry || entry.scope !== "okx") {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const apiKey = entry.payload?.apiKey || "";
      const apiSecret = entry.payload?.apiSecret || "";
      const passphrase = entry.payload?.passphrase || "";
      const testnet = Boolean(entry.payload?.testnet);
      if (!apiKey || !apiSecret || !passphrase) {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const instId = `${canonicalTickerParam(body.symbol, "BTC")}-USDT-SWAP`;
      const requestOkx = async (method, requestPath, payload = null) => {
        const bodyStr = payload ? JSON.stringify(payload) : "";
        const headers = okxSign({
          secret: apiSecret,
          passphrase,
          apiKey,
          method,
          requestPath,
          body: bodyStr,
        });
        if (testnet) headers["x-simulated-trading"] = "1";
        const res = await fetch(`https://www.okx.com${requestPath}`, {
          method,
          headers,
          body: bodyStr || undefined,
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok || data?.code !== "0") throw new Error(data?.msg || `OKX error ${res.status}`);
        return data;
      };
      try {
        if (body.type === "leverage") {
          const leverage = String(Math.max(1, Math.min(100, Math.round(Number(body.leverage) || 1))));
          await requestOkx("POST", "/api/v5/account/set-leverage", {
            instId,
            lever: leverage,
            mgnMode: body.marginMode === "cross" ? "cross" : "isolated",
          });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "marginType") {
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "cancel") {
          await requestOkx("POST", "/api/v5/trade/cancel-order", {
            instId,
            ordId: String(body.orderId || ""),
          });
          json(reply, 200, { ok: true });
          return;
        }
        if (body.type === "closePosition") {
          const closePercent = Math.max(1, Math.min(100, Number(body.closePercent) || 100));
          const posData = await requestOkx("GET", `/api/v5/account/positions?instType=SWAP&instId=${encodeURIComponent(instId)}`);
          const rows = Array.isArray(posData?.data) ? posData.data : [];
          const row = rows.find((item) => {
            const itemSide = String(item?.posSide || item?.direction || "").toLowerCase();
            const signedPos = parseFloat(item?.pos || "0");
            const normalizedSide = itemSide === "short" || (itemSide !== "long" && signedPos < 0) ? "short" : "long";
            return normalizedSide === (body.side === "short" ? "short" : "long");
          }) || rows[0] || null;
          const contracts = Math.abs(parseFloat(row?.pos || "0"));
          if (!contracts) {
            json(reply, 200, { ok: true, data: { message: "No open position found." } });
            return;
          }
          const side = body.side === "short" ? "buy" : "sell";
          const closeContracts = contracts * (closePercent / 100);
          const result = await requestOkx("POST", "/api/v5/trade/order", {
            instId,
            tdMode: body.marginMode === "cross" ? "cross" : "isolated",
            side,
            ordType: "market",
            sz: closeContracts >= 100 ? closeContracts.toFixed(0) : closeContracts >= 1 ? closeContracts.toFixed(2) : closeContracts.toFixed(3),
            reduceOnly: true,
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "tpsl") {
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          if (!tp && !sl) {
            json(reply, 400, { ok: false, error: "Provide TP and/or SL price." });
            return;
          }
          const markPrice = parseFloat((await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, {
            signal: AbortSignal.timeout(5000),
          }).then((r) => r.json()))?.data?.[0]?.last || "0");
          const isShort = body.side === "short";
          if (tp && (!isShort ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (!isShort ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          const posData = await requestOkx("GET", `/api/v5/account/positions?instType=SWAP&instId=${encodeURIComponent(instId)}`);
          const rows = Array.isArray(posData?.data) ? posData.data : [];
          const row = rows.find((item) => {
            const itemSide = String(item?.posSide || item?.direction || "").toLowerCase();
            const signedPos = parseFloat(item?.pos || "0");
            const normalizedSide = itemSide === "short" || (itemSide !== "long" && signedPos < 0) ? "short" : "long";
            return normalizedSide === (body.side === "short" ? "short" : "long");
          }) || rows[0] || null;
          const contracts = Math.abs(parseFloat(row?.pos || "0"));
          if (!contracts) {
            json(reply, 400, { ok: false, error: "No open position found for TP/SL." });
            return;
          }
          const side = isShort ? "buy" : "sell";
          const result = await requestOkx("POST", "/api/v5/trade/order-algo", {
            instId,
            tdMode: body.marginMode === "cross" ? "cross" : "isolated",
            side,
            ordType: tp && sl ? "oco" : "conditional",
            sz: contracts >= 100 ? contracts.toFixed(0) : contracts >= 1 ? contracts.toFixed(2) : contracts.toFixed(3),
            ...(tp ? { tpTriggerPx: String(tp), tpOrdPx: "-1" } : {}),
            ...(sl ? { slTriggerPx: String(sl), slOrdPx: "-1" } : {}),
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "order") {
          const [ticker, contractValue] = await Promise.all([
            fetch(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, {
              signal: AbortSignal.timeout(3500),
            }).then((r) => r.json()),
            getOkxContractValue(instId),
          ]);
          const markPrice = parseFloat(ticker?.data?.[0]?.last || "0");
          const marginAmount = finitePositiveNumber(body.marginAmount);
          const leverage = Math.max(1, Math.min(100, Math.round(Number(body.leverage) || 1)));
          if (!markPrice || !marginAmount) {
            json(reply, 400, { ok: false, error: "Invalid margin amount or mark price." });
            return;
          }
          const ctVal = Number(contractValue || 1);
          const rawSz = (marginAmount * leverage) / Math.max(1e-9, markPrice * ctVal);
          const sz = rawSz >= 100 ? rawSz.toFixed(0) : rawSz >= 1 ? rawSz.toFixed(2) : rawSz.toFixed(3);
          const tp = finitePositiveNumber(body.tpPrice);
          const sl = finitePositiveNumber(body.slPrice);
          const side = body.side === "short" ? "sell" : "buy";
          const isShort = side === "sell";
          if (tp && (!isShort ? tp <= markPrice : tp >= markPrice)) {
            json(reply, 400, { ok: false, error: "TP must be above mark for long and below mark for short." });
            return;
          }
          if (sl && (!isShort ? sl >= markPrice : sl <= markPrice)) {
            json(reply, 400, { ok: false, error: "SL must be below mark for long and above mark for short." });
            return;
          }
          const attachAlgoOrds =
            tp || sl
              ? [
                  {
                    ...(tp ? { tpTriggerPx: String(tp), tpOrdPx: "-1", tpTriggerPxType: "last" } : {}),
                    ...(sl ? { slTriggerPx: String(sl), slOrdPx: "-1", slTriggerPxType: "last" } : {}),
                  },
                ]
              : undefined;
          const result = await requestOkx("POST", "/api/v5/trade/order", {
            instId,
            tdMode: body.marginMode === "cross" ? "cross" : "isolated",
            side,
            ordType: body.orderType === "limit" ? "limit" : "market",
            sz,
            ...(body.orderType === "limit" && body.limitPrice ? { px: String(body.limitPrice) } : {}),
            ...(attachAlgoOrds ? { attachAlgoOrds } : {}),
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        json(reply, 400, { ok: false, error: "Unknown action type" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "OKX order request failed.";
        logger.warn("okx.order.failed", { type: body.type, instId, error: String(err) });
        const isClientIssue = /(insufficient|invalid|minimum|size|margin|leverage|position|instrument|parameter|order)/i.test(message);
        json(reply, isClientIssue ? 400 : 500, { ok: false, error: message || "OKX order request failed." });
      }
      return;
    }

    json(reply, 404, { error: "Not found" });
  } catch (error) {
    upstreamStatus = "error";
    logger.error("backend.request.failed", { path: url.pathname, error: String(error) });
    json(reply, 500, { error: "Internal server error" });
  }
});

const websocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  if (!isAllowedWsOrigin(request)) {
    socket.destroy();
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (ws) => {
    websocketServer.emit("connection", ws, request);
  });
});

websocketServer.on("connection", (socket) => {
  clients.add(socket);
  sendToClient(socket, { type: "snapshot", payload: buildLiteSnapshot(buildSnapshot()), timestamp: new Date().toISOString() });

  // Handle client messages (ping keepalive)
  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") {
        sendToClient(socket, { type: "heartbeat", payload: { ok: true, ts: Date.now() }, timestamp: new Date().toISOString() });
      }
    } catch {
      // ignore malformed messages
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
  });
});

try {
  await terminalData.start();
} catch (error) {
  logger.error("backend.bootstrap_failed", { error: String(error) });
}
const unsubscribeStream = terminalData.events.subscribe("stream", (envelope) => {
  broadcast(envelope.type, envelope.payload);
});

server.listen(config.apiPort, config.apiHost, () => {
  logger.info("backend.ready", {
    host: config.apiHost,
    port: config.apiPort,
    origins: config.frontendOrigins,
    node: process.version,
  });
});

process.on("SIGINT", () => {
  unsubscribeStream();
  terminalData.stop();
  server.close(() => process.exit(0));
});





