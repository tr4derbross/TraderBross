import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { getProviderLabel, streamChat, classifySentiment } from "./services/ai-service.mjs";
import { getCalendarEvents } from "./services/calendar-service.mjs";
import { getDydxAccount, getDydxMarkets } from "./services/dydx-service.mjs";
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
import { canonicalSymbol } from "./data/core/symbol-map.mjs";
import { MemoryCache } from "./services/cache.mjs";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const terminalData = createTerminalDataService({ config, logger });
const endpointCache = new MemoryCache();
const clients = new Set();

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

function canonicalTickerParam(value, fallback = "BTC") {
  return canonicalSymbol(value || fallback) || fallback;
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
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/providers/health") {
      json(reply, 200, terminalData.getStatus());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      const snapshot = buildSnapshot();
      if ((snapshot.quotes?.length || 0) === 0 && snapshot.connectionState !== "connected") {
        await terminalData.refreshAll().catch((error) => {
          logger.warn("data.snapshot.refresh_failed", { error: String(error) });
        });
      }
      json(reply, 200, buildSnapshot());
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
      if (type === "quotes") {
        json(reply, 200, buildSnapshot().quotes || []);
        return;
      }

      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getBinanceCandles(ticker, interval, limit));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/okx") {
      const type = url.searchParams.get("type");
      if (type === "quotes") {
        json(reply, 200, buildSnapshot().venueQuotes?.OKX || []);
        return;
      }
      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getOkxCandles(ticker, interval, limit));
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
      if (type === "quotes") {
        json(reply, 200, buildSnapshot().venueQuotes?.Bybit || []);
        return;
      }
      const ticker = canonicalTickerParam(url.searchParams.get("ticker"), "BTC");
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getBybitCandles(ticker, interval, limit));
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
      json(reply, 200, { ok: false, error: "Backend order routing is not enabled in this refactor yet." });
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
    }

    if (request.method === "GET" && url.pathname === "/api/news") {
      json(reply, 200, terminalData.getNews({
        sector: url.searchParams.get("sector"),
        ticker: url.searchParams.get("ticker")
          ? canonicalTickerParam(url.searchParams.get("ticker"), "BTC")
          : null,
        keyword: url.searchParams.get("keyword"),
      }));
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
      json(reply, 200, { provider: getProviderLabel(config) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJson(request);
      reply.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      for await (const chunk of streamChat(config, body)) {
        reply.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      reply.write("data: [DONE]\n\n");
      reply.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/sentiment") {
      const body = await readJson(request);
      json(reply, 200, classifySentiment(body.headline || ""));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/vault/store") {
      const body = await readJson(request);
      const token = storeSecret(body.scope || "generic", body.payload || body);
      json(reply, 200, { ok: true, sessionToken: token });
      return;
    }

    if ((request.method === "POST" || request.method === "DELETE") && url.pathname === "/api/vault/clear") {
      const body = await readJson(request);
      json(reply, 200, { ok: clearSecret(body.token || body.sessionToken || "") });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/vault/status") {
      const token = url.searchParams.get("token") || "";
      json(reply, 200, { ok: Boolean(getSecret(token)) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/venues/validate") {
      const body = await readJson(request);
      const token = body.sessionToken;
      const entry = token ? getSecret(token) : null;
      const apiKey = entry?.payload?.apiKey || body.apiKey || "";
      const apiSecret = entry?.payload?.apiSecret || body.apiSecret || "";
      const testnet = entry?.payload?.testnet || false;
      const base = testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
      if (!apiKey || !apiSecret) {
        json(reply, 200, { ok: false, message: "API key and secret are required." });
        return;
      }
      try {
        const qs = binanceSignedQuery(apiSecret);
        const res = await fetch(`${base}/fapi/v2/balance?${qs}`, { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) {
          json(reply, 200, { ok: false, message: data.msg || `Binance error ${res.status}` });
          return;
        }
        const usdt = Array.isArray(data) ? data.find((b) => b.asset === "USDT") : null;
        json(reply, 200, { ok: true, message: `Connected${usdt ? ` · USDT balance: ${parseFloat(usdt.availableBalance || "0").toFixed(2)}` : ""}` });
      } catch (err) {
        json(reply, 200, { ok: false, message: String(err) });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/binance") {
      const body = await readJson(request);
      const entry = getSecret(body.sessionToken || "");
      if (!entry) {
        json(reply, 401, { error: "Session expired. Re-save your credentials." });
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
          const qs = binanceSignedQuery(apiSecret);
          const res = await fetch(`${base}/fapi/v2/positionRisk?${qs}`, { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.msg || `Binance error ${res.status}`);
          const positions = data
            .filter((p) => parseFloat(p.positionAmt) !== 0)
            .map((p) => {
              const size = parseFloat(p.positionAmt);
              return {
                coin: p.symbol.replace(/USDT$/, ""),
                side: size > 0 ? "long" : "short",
                size: Math.abs(size),
                entryPx: parseFloat(p.entryPrice),
                pnl: parseFloat(p.unRealizedProfit),
                liquidationPx: parseFloat(p.liquidationPrice) || null,
                leverage: parseInt(p.leverage) || 1,
                marginMode: p.marginType === "cross" ? "cross" : "isolated",
              };
            });
          json(reply, 200, { positions });
          return;
        }
        json(reply, 400, { error: "Unknown type" });
      } catch (err) {
        json(reply, 500, { error: String(err) });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/binance/order") {
      const body = await readJson(request);
      const entry = getSecret(body.sessionToken || "");
      if (!entry) {
        json(reply, 401, { ok: false, error: "Session expired. Re-save your credentials." });
        return;
      }
      const { apiKey, apiSecret, testnet } = entry.payload;
      const base = testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
      try {
        const binancePost = async (path, params) => {
          const qs = binanceSignedQuery(apiSecret, params);
          const res = await fetch(`${base}${path}?${qs}`, { method: "POST", headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(10000) });
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
        const symbol = `${body.symbol}USDT`;
        if (body.type === "leverage") {
          await binancePost("/fapi/v1/leverage", { symbol, leverage: String(Math.round(body.leverage)) });
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

          // 3. Market order with reduceOnly=true + exact quantity (closePosition=true is NOT valid for MARKET type)
          const closeSide = body.side === "long" ? "SELL" : "BUY";
          const result = await binancePost("/fapi/v1/order", {
            symbol, side: closeSide, type: "MARKET",
            quantity: String(posAmt), reduceOnly: "true",
          });
          json(reply, 200, { ok: true, data: result });
          return;
        }
        if (body.type === "tpsl") {
          // Place TP and/or SL conditional orders with closePosition=true
          const tpslSide = body.side === "long" ? "SELL" : "BUY";
          const results = [];
          if (body.tpPrice) {
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "TAKE_PROFIT_MARKET",
              stopPrice: String(body.tpPrice), closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            results.push({ tp: r });
          }
          if (body.slPrice) {
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "STOP_MARKET",
              stopPrice: String(body.slPrice), closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            results.push({ sl: r });
          }
          json(reply, 200, { ok: true, data: results });
          return;
        }
        if (body.type === "order") {
          // Pre-set margin type and leverage before placing
          const marginType = body.marginMode === "cross" ? "CROSSED" : "ISOLATED";
          await binancePost("/fapi/v1/marginType", { symbol, marginType }).catch(() => {});
          await binancePost("/fapi/v1/leverage", { symbol, leverage: String(Math.round(body.leverage || 1)) });
          // Fetch mark price
          const mpRes = await fetch(`${base}/fapi/v1/premiumIndex?symbol=${symbol}`, { signal: AbortSignal.timeout(5000) });
          const mpData = await mpRes.json();
          const markPrice = parseFloat(mpData.markPrice || "0");
          if (!markPrice) throw new Error(`Could not fetch mark price for ${symbol}`);
          const qty = (body.marginAmount * body.leverage) / markPrice;
          const quantity = qty >= 100 ? qty.toFixed(0) : qty >= 10 ? qty.toFixed(1) : qty >= 1 ? qty.toFixed(2) : qty.toFixed(3);
          const side = body.side === "long" ? "BUY" : "SELL";
          const params = { symbol, side, quantity };
          if (body.orderType === "market") {
            params.type = "MARKET";
          } else if (body.orderType === "limit") {
            params.type = "LIMIT";
            params.price = String(body.limitPrice);
            params.timeInForce = "GTC";
          } else {
            params.type = "STOP_MARKET";
            params.stopPrice = String(body.limitPrice);
          }
          const result = await binancePost("/fapi/v1/order", params);
          // Place TP / SL conditional orders if provided
          const tpslSide = body.side === "long" ? "SELL" : "BUY";
          const tpslResults = [];
          if (body.tpPrice) {
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "TAKE_PROFIT_MARKET",
              stopPrice: String(body.tpPrice), closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            tpslResults.push({ tp: r });
          }
          if (body.slPrice) {
            const r = await binancePost("/fapi/v1/order", {
              symbol, side: tpslSide, type: "STOP_MARKET",
              stopPrice: String(body.slPrice), closePosition: "true", workingType: "CONTRACT_PRICE",
            }).catch((e) => ({ error: String(e) }));
            tpslResults.push({ sl: r });
          }
          json(reply, 200, { ok: true, data: result, tpsl: tpslResults });
          return;
        }
        json(reply, 400, { ok: false, error: "Unknown action type" });
      } catch (err) {
        json(reply, 500, { ok: false, error: String(err) });
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

  websocketServer.handleUpgrade(request, socket, head, (ws) => {
    websocketServer.emit("connection", ws, request);
  });
});

websocketServer.on("connection", (socket) => {
  clients.add(socket);
  sendToClient(socket, { type: "snapshot", payload: buildSnapshot(), timestamp: new Date().toISOString() });

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





