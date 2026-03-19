import { MemoryCache } from "./cache.mjs";

const cache = new MemoryCache();
const BASE = "https://data-api.binance.vision";
const FAPI = "https://fapi.binance.com";

const FUTURES_SET = new Set([
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","SUI","OP","NEAR",
  "INJ","ATOM","DOT","APT","HYPE","LTC","UNI","ADA","TRX","FIL","PEPE","WIF",
  "BONK","RUNE","STX","SEI","FTM","1000PEPE","MATIC","FET","RENDER","TAO",
  "PENDLE","WLD","TIA","PYTH","JTO","JUP","DYM","MANTA","STRK","ORDI","SATS",
]);

function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((close, i) => close - closes[i]);
  const gains = changes.map((v) => (v > 0 ? v : 0));
  const losses = changes.map((v) => (v < 0 ? -v : 0));

  let avgGain = gains.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

  for (let i = period; i < changes.length; i += 1) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

async function fetchRSI(symbol) {
  try {
    const res = await fetch(`${BASE}/api/v3/klines?symbol=${symbol}USDT&interval=4h&limit=50`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const klines = await res.json();
    const closes = klines.map((kline) => Number(kline[4]));
    return computeRSI(closes);
  } catch {
    return null;
  }
}

async function fetchOpenInterest(symbol, price) {
  try {
    const res = await fetch(`${FAPI}/fapi/v1/openInterest?symbol=${symbol}USDT`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Math.round(Number(data.openInterest) * price);
  } catch {
    return null;
  }
}

async function fetchLongShortRatio(symbol) {
  try {
    const res = await fetch(
      `${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}USDT&period=1h&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const value = data?.[0]?.longShortRatio;
    return value ? Math.round(Number(value) * 100) / 100 : null;
  } catch {
    return null;
  }
}

export async function getScreenerData(sort = "volume") {
  return cache.remember(`screener:v1:${sort}`, 45_000, async () => {
    const res = await fetch(`${BASE}/api/v3/ticker/24hr`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      throw new Error(`Binance ticker failed: ${res.status}`);
    }

    const raw = await res.json();
    const coins = raw
      .filter((ticker) => ticker.symbol.endsWith("USDT") && !/UP|DOWN|BEAR|BULL/.test(ticker.symbol))
      .map((ticker) => ({
        symbol: ticker.symbol.replace("USDT", ""),
        price: Number(ticker.lastPrice),
        change24h: Number(ticker.priceChangePercent),
        volume24h: Number(ticker.quoteVolume),
        high24h: Number(ticker.highPrice),
        low24h: Number(ticker.lowPrice),
        trades24h: Number(ticker.count) || 0,
      }))
      .filter((coin) => coin.volume24h > 500_000 && coin.price > 0);

    const sorted = [...coins].sort((a, b) => {
      if (sort === "gainers") return b.change24h - a.change24h;
      if (sort === "losers") return a.change24h - b.change24h;
      return b.volume24h - a.volume24h;
    });

    const top100 = sorted.slice(0, 100);
    const enrichTargets = top100.filter((coin) => FUTURES_SET.has(coin.symbol)).slice(0, 20);

    const enrichResults = await Promise.allSettled(
      enrichTargets.map(async (coin) => ({
        symbol: coin.symbol,
        rsi14: await fetchRSI(coin.symbol),
        openInterestUsd: await fetchOpenInterest(coin.symbol, coin.price),
        longShortRatio: await fetchLongShortRatio(coin.symbol),
      }))
    );

    const enrichedMap = new Map();
    for (const result of enrichResults) {
      if (result.status === "fulfilled") {
        enrichedMap.set(result.value.symbol, result.value);
      }
    }

    return top100.map((coin) => ({
      ...coin,
      ...(enrichedMap.get(coin.symbol) || {}),
    }));
  });
}
