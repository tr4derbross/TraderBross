import WebSocket from "ws";
import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";
import { generateMockCandles, generateMockQuotes } from "./mock-data.mjs";

const cache = new MemoryCache();

const BINANCE_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  ARB: "ARBUSDT",
  OP: "OPUSDT",
  NEAR: "NEARUSDT",
  INJ: "INJUSDT",
  DOT: "DOTUSDT",
  APT: "APTUSDT",
  SUI: "SUIUSDT",
  TIA: "TIAUSDT",
  ATOM: "ATOMUSDT",
  AAVE: "AAVEUSDT",
  WIF: "WIFUSDT",
};

const OKX_SYMBOLS = {
  BTC: "BTC-USDT-SWAP",
  ETH: "ETH-USDT-SWAP",
  SOL: "SOL-USDT-SWAP",
};

const BYBIT_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
};

function decimalsForPrice(value) {
  if (value < 1) return 5;
  if (value < 10) return 4;
  if (value < 1000) return 2;
  return 0;
}

export async function getBinanceQuotes() {
  return cache.remember("quotes:binance", 8000, async () => {
    const symbols = encodeURIComponent(JSON.stringify(Object.values(BINANCE_SYMBOLS)));
    try {
      const payload = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/24hr?type=MINI&symbols=${symbols}`, {
        timeoutMs: 3000,
      });

      const reverse = Object.fromEntries(Object.entries(BINANCE_SYMBOLS).map(([ticker, symbol]) => [symbol, ticker]));
      return payload
        .map((entry) => {
          const symbol = reverse[entry.symbol];
          if (!symbol) {
            return null;
          }
          return {
            symbol,
            price: Number(Number(entry.lastPrice).toFixed(decimalsForPrice(Number(entry.lastPrice)))),
            change: Number(Number(entry.priceChange).toFixed(decimalsForPrice(Number(entry.lastPrice)))),
            changePct: Number(Number(entry.priceChangePercent).toFixed(2)),
          };
        })
        .filter(Boolean);
    } catch {
      return generateMockQuotes();
    }
  });
}

export async function getBinanceCandles(symbol, interval, limit) {
  const raw = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const venueSymbol = BINANCE_SYMBOLS[raw] || (raw.endsWith("USDT") ? raw : `${raw}USDT`);

  return cache.remember(`candles:binance:${symbol}:${interval}:${limit}`, 10000, async () => {
    try {
      const payload = await fetchJson(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${venueSymbol}&interval=${interval}&limit=${limit}`,
        { timeoutMs: 3500 },
      );

      return payload.map((entry) => ({
        time: Math.floor(entry[0] / 1000),
        open: Number(entry[1]),
        high: Number(entry[2]),
        low: Number(entry[3]),
        close: Number(entry[4]),
        volume: Number(entry[5]),
      }));
    } catch {
      return generateMockCandles(symbol, interval, limit);
    }
  });
}

export async function getOkxQuotes() {
  return cache.remember("quotes:okx", 15000, async () => {
    try {
      const result = [];
      for (const [ticker, instId] of Object.entries(OKX_SYMBOLS)) {
        const payload = await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`, { timeoutMs: 3500 });
        const row = payload?.data?.[0];
        if (!row) continue;
        const price = Number(row.last);
        const open = Number(row.open24h || row.last);
        const change = price - open;
        result.push({
          symbol: ticker,
          price: Number(price.toFixed(decimalsForPrice(price))),
          change: Number(change.toFixed(decimalsForPrice(price))),
          changePct: Number((open > 0 ? (change / open) * 100 : 0).toFixed(2)),
        });
      }
      return result;
    } catch {
      return [];
    }
  });
}

export async function getBybitQuotes() {
  return cache.remember("quotes:bybit", 15000, async () => {
    try {
      const result = [];
      for (const [ticker, symbol] of Object.entries(BYBIT_SYMBOLS)) {
        const payload = await fetchJson(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`, { timeoutMs: 3500 });
        const row = payload?.result?.list?.[0];
        if (!row) continue;
        const price = Number(row.lastPrice);
        const open = Number(row.prevPrice24h || row.lastPrice);
        const change = price - open;
        result.push({
          symbol: ticker,
          price: Number(price.toFixed(decimalsForPrice(price))),
          change: Number(change.toFixed(decimalsForPrice(price))),
          changePct: Number((open > 0 ? (change / open) * 100 : 0).toFixed(2)),
        });
      }
      return result;
    } catch {
      return [];
    }
  });
}

export async function getOkxCandles(symbol, interval, limit) {
  const raw = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const instId = OKX_SYMBOLS[raw] || `${raw}-USDT-SWAP`;

  const bar = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W", "1H": "1H", "4H": "4H", "1D": "1D", "1W": "1W" }[interval] || "1D";
  return cache.remember(`candles:okx:${symbol}:${interval}:${limit}`, 12000, async () => {
    try {
      const payload = await fetchJson(`https://www.okx.com/api/v5/market/history-candles?instId=${instId}&bar=${bar}&limit=${limit}`, { timeoutMs: 3500 });
      return (payload?.data || [])
        .map((entry) => ({
          time: Math.floor(Number(entry[0]) / 1000),
          open: Number(entry[1]),
          high: Number(entry[2]),
          low: Number(entry[3]),
          close: Number(entry[4]),
          volume: Number(entry[5]),
        }))
        .reverse();
    } catch {
      return generateMockCandles(symbol, interval, limit);
    }
  });
}

export async function getBybitCandles(symbol, interval, limit) {
  const raw = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const venueSymbol = BYBIT_SYMBOLS[raw] || (raw.endsWith("USDT") ? raw : `${raw}USDT`);

  const bucket = { "1m": "1", "5m": "5", "15m": "15", "30m": "30", "1h": "60", "4h": "240", "1d": "D", "1w": "W" }[interval] || "D";
  return cache.remember(`candles:bybit:${symbol}:${interval}:${limit}`, 12000, async () => {
    try {
      const payload = await fetchJson(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${venueSymbol}&interval=${bucket}&limit=${limit}`, { timeoutMs: 3500 });
      return (payload?.result?.list || [])
        .map((entry) => ({
          time: Math.floor(Number(entry[0]) / 1000),
          open: Number(entry[1]),
          high: Number(entry[2]),
          low: Number(entry[3]),
          close: Number(entry[4]),
          volume: Number(entry[5]),
        }))
        .reverse();
    } catch {
      return generateMockCandles(symbol, interval, limit);
    }
  });
}

export function createBinanceQuoteStream({ logger, onQuotes }) {
  const wsUrl = "wss://data-stream.binance.vision/stream?streams=!miniTicker@arr";
  let socket = null;
  let closed = false;
  let retryTimer = null;

  const connect = () => {
    if (closed) {
      return;
    }

    socket = new WebSocket(wsUrl);

    socket.on("open", () => {
      logger.info("backend.ws.binance.connected");
    });

    socket.on("message", (buffer) => {
      try {
        const payload = JSON.parse(buffer.toString());
        const reverse = Object.fromEntries(Object.entries(BINANCE_SYMBOLS).map(([ticker, symbol]) => [symbol, ticker]));
        const quotes = (payload?.data || [])
          .map((entry) => {
            const symbol = reverse[entry.s];
            if (!symbol) {
              return null;
            }
            const price = Number(entry.c);
            const open = Number(entry.o);
            const change = price - open;
            return {
              symbol,
              price: Number(price.toFixed(decimalsForPrice(price))),
              change: Number(change.toFixed(decimalsForPrice(price))),
              changePct: Number((open > 0 ? (change / open) * 100 : 0).toFixed(2)),
            };
          })
          .filter(Boolean);

        if (quotes.length > 0) {
          cache.set("quotes:binance", quotes, 3000);
          onQuotes(quotes);
        }
      } catch (error) {
        logger.warn("backend.ws.binance.parse_failed", { error: String(error) });
      }
    });

    socket.on("close", () => {
      logger.warn("backend.ws.binance.closed");
      if (!closed) {
        retryTimer = setTimeout(connect, 2500);
      }
    });

    socket.on("error", (error) => {
      logger.warn("backend.ws.binance.error", { error: String(error) });
      socket?.close();
    });
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    socket?.close();
  };
}
