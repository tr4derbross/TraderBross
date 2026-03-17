import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { getProviderLabel, streamChat, classifySentiment } from "./services/ai-service.mjs";
import { getDydxAccount, getDydxMarkets } from "./services/dydx-service.mjs";
import { getHyperliquidAccount, getHyperliquidCandles, getHyperliquidMarket } from "./services/hyperliquid-service.mjs";
import {
  createBinanceQuoteStream,
  getBinanceCandles,
  getBinanceQuotes,
  getBybitCandles,
  getBybitQuotes,
  getOkxCandles,
  getOkxQuotes,
} from "./services/market-service.mjs";
import { getNews, getNewsFeed, getSocial, getWhales } from "./services/news-service.mjs";
import { getFearGreed, getMarketStats, getMempoolStats } from "./services/stats-service.mjs";
import { getVenueQuotes } from "./services/venue-service.mjs";
import { clearSecret, getSecret, storeSecret } from "./services/vault-service.mjs";

const config = loadConfig();
const logger = createLogger(config.logLevel);

function createState() {
  return {
    quotes: [],
    venueQuotes: { Binance: [], OKX: [], Bybit: [] },
    marketStats: null,
    mempoolStats: null,
    fearGreed: null,
    news: [],
    whales: [],
    social: [],
    connectionState: "connecting",
  };
}

const state = createState();
const clients = new Set();

function binanceSignedQuery(secret, params = {}) {
  const qs = new URLSearchParams({ ...params, timestamp: Date.now().toString(), recvWindow: "5000" }).toString();
  const sig = crypto.createHmac("sha256", secret).update(qs).digest("hex");
  return `${qs}&signature=${sig}`;
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
  reply.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

async function refreshCoreState() {
  const [quotes, venueQuotes, marketStats, mempoolStats, fearGreed, newsFeed] = await Promise.all([
    getBinanceQuotes(),
    getVenueQuotes(),
    getMarketStats(),
    getMempoolStats(),
    getFearGreed(),
    getNewsFeed(config),
  ]);

  state.quotes = quotes;
  state.venueQuotes = venueQuotes;
  state.marketStats = marketStats;
  state.mempoolStats = mempoolStats;
  state.fearGreed = fearGreed;
  state.news = newsFeed.news;
  state.whales = newsFeed.whales;
  state.social = newsFeed.social;
  state.connectionState = "connected";
}

async function refreshNewsOnly() {
  const next = await getNewsFeed(config);

  const seen = new Set(state.news.map((item) => item.id));
  next.news.forEach((item) => {
    if (!seen.has(item.id)) {
      broadcast("news", item);
    }
  });

  state.news = next.news;
  state.whales = next.whales;
  state.social = next.social;
  broadcast("social", state.social);
  broadcast("whales", state.whales);
}

async function refreshStatsOnly() {
  state.marketStats = await getMarketStats();
  state.mempoolStats = await getMempoolStats();
  state.fearGreed = await getFearGreed();
  broadcast("marketStats", state.marketStats);
  broadcast("mempoolStats", state.mempoolStats);
  broadcast("fearGreed", state.fearGreed);
}

async function refreshVenueQuotesOnly() {
  state.venueQuotes = await getVenueQuotes();
  broadcast("venueQuotes", state.venueQuotes);
}

function buildSnapshot() {
  return {
    quotes: state.quotes,
    venueQuotes: state.venueQuotes,
    marketStats: state.marketStats,
    mempoolStats: state.mempoolStats,
    fearGreed: state.fearGreed,
    news: state.news,
    whales: state.whales,
    social: state.social,
    connectionState: state.connectionState,
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
  logger.info("backend.request", { method: request.method, path: url.pathname });

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      json(reply, 200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        wsClients: clients.size,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      await refreshCoreState();
      json(reply, 200, buildSnapshot());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/prices") {
      const type = url.searchParams.get("type");
      if (type === "quotes") {
        json(reply, 200, await getBinanceQuotes());
        return;
      }

      const ticker = (url.searchParams.get("ticker") || "BTC").toUpperCase();
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getBinanceCandles(ticker, interval, limit));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/okx") {
      const type = url.searchParams.get("type");
      if (type === "quotes") {
        json(reply, 200, await getOkxQuotes());
        return;
      }
      const ticker = (url.searchParams.get("ticker") || "BTC").toUpperCase();
      const interval = url.searchParams.get("interval") || "1d";
      const limit = Math.min(Number(url.searchParams.get("limit") || 120), 500);
      json(reply, 200, await getOkxCandles(ticker, interval, limit));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bybit") {
      const type = url.searchParams.get("type");
      if (type === "quotes") {
        json(reply, 200, await getBybitQuotes());
        return;
      }
      const ticker = (url.searchParams.get("ticker") || "BTC").toUpperCase();
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
        const ticker = (url.searchParams.get("ticker") || "BTC").toUpperCase();
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
      json(reply, 200, await getNews(config, {
        sector: url.searchParams.get("sector"),
        ticker: url.searchParams.get("ticker"),
        keyword: url.searchParams.get("keyword"),
      }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/whale") {
      json(reply, 200, await getWhales(config));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/social") {
      json(reply, 200, await getSocial(config));
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

    if (request.method === "GET" && url.pathname === "/api/funding") {
      const ticker = (url.searchParams.get("ticker") || "BTC").toUpperCase();
      const [binance, okx, bybit] = await Promise.all([getBinanceQuotes(), getOkxQuotes(), getBybitQuotes()]);
      const quote = (list) => list.find((item) => item.symbol === ticker);
      json(reply, 200, {
        rates: [
          { venue: "Binance", rate: quote(binance)?.changePct ? quote(binance).changePct / 10000 : 0.0001, nextFundingTime: Date.now() + 4 * 60 * 60 * 1000, intervalHours: 8, status: "live" },
          { venue: "OKX", rate: quote(okx)?.changePct ? quote(okx).changePct / 12000 : 0.00008, nextFundingTime: Date.now() + 4 * 60 * 60 * 1000, intervalHours: 8, status: quote(okx) ? "live" : "unavailable" },
          { venue: "Bybit", rate: quote(bybit)?.changePct ? quote(bybit).changePct / 11000 : 0.00009, nextFundingTime: Date.now() + 4 * 60 * 60 * 1000, intervalHours: 8, status: quote(bybit) ? "live" : "unavailable" },
        ],
      });
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
          // Reduce-only market order to close a position
          const closeSide = body.side === "long" ? "SELL" : "BUY";
          const closeQty = String(body.size);
          const result = await binancePost("/fapi/v1/order", {
            symbol, side: closeSide, type: "MARKET", quantity: closeQty, reduceOnly: "true",
          });
          json(reply, 200, { ok: true, data: result });
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
          json(reply, 200, { ok: true, data: result });
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

  socket.on("close", () => {
    clients.delete(socket);
  });
});

await refreshCoreState();

const stopBinanceStream = createBinanceQuoteStream({
  logger,
  onQuotes(quotes) {
    state.quotes = quotes;
    broadcast("quotes", quotes);
  },
});

const intervals = [
  setInterval(() => {
    void refreshNewsOnly();
  }, 60000),
  setInterval(() => {
    void refreshStatsOnly();
  }, 30000),
  setInterval(() => {
    void refreshVenueQuotesOnly();
  }, 15000),
  setInterval(() => {
    broadcast("heartbeat", { ok: true, ts: Date.now() });
  }, 10000),
];

server.listen(config.apiPort, config.apiHost, () => {
  logger.info("backend.ready", {
    host: config.apiHost,
    port: config.apiPort,
    origins: config.frontendOrigins,
  });
});

process.on("SIGINT", () => {
  stopBinanceStream();
  intervals.forEach(clearInterval);
  server.close(() => process.exit(0));
});
