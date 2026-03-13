import { NextRequest, NextResponse } from "next/server";
import { generateMockPriceData, generateTickerQuotes } from "@/lib/mock-data";

const BINANCE_REST_BASE = "https://data-api.binance.vision";

// Stock proxies stay on mock data because Binance does not list them.
const BINANCE_SYMBOLS: Record<string, string> = {
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
};

const ALLOWED_INTERVALS = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "BTC";
  const type = searchParams.get("type");
  const interval = searchParams.get("interval") ?? "1d";
  const limit = parseInt(searchParams.get("limit") ?? "90", 10);

  if (type === "quotes") {
    return getQuotes();
  }

  return getOHLCV(ticker, interval, limit);
}

async function getOHLCV(ticker: string, interval: string, limit: number) {
  const symbol = BINANCE_SYMBOLS[ticker];
  const safeInterval = ALLOWED_INTERVALS.has(interval) ? interval : "1d";
  const safeLimit = Math.min(Math.max(limit, 1), 500);

  if (!symbol) {
    return NextResponse.json(generateMockPriceData(ticker, safeLimit));
  }

  try {
    const res = await fetch(
      `${BINANCE_REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${safeInterval}&limit=${safeLimit}`,
      {
        next: { revalidate: safeInterval === "1d" || safeInterval === "1w" ? 300 : 45 },
        signal: AbortSignal.timeout(2500),
      }
    );

    if (!res.ok) {
      throw new Error(`Binance klines error: ${res.status}`);
    }

    const raw: [number, string, string, string, string, string, ...unknown[]][] = await res.json();
    const data = raw.map((kline) => ({
      time: Math.floor(kline[0] / 1000),
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("Binance OHLCV fallback:", err);
    return NextResponse.json(generateMockPriceData(ticker, safeLimit));
  }
}

async function getQuotes() {
  const cryptoSymbols = Object.values(BINANCE_SYMBOLS);

  try {
    const symbolsParam = encodeURIComponent(JSON.stringify(cryptoSymbols));
    const res = await fetch(
      `${BINANCE_REST_BASE}/api/v3/ticker/24hr?type=MINI&symbols=${symbolsParam}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      }
    );

    if (!res.ok) {
      throw new Error(`Binance ticker error: ${res.status}`);
    }

    const raw: Array<{
      symbol: string;
      lastPrice: string;
      priceChange: string;
      priceChangePercent: string;
    }> = await res.json();

    const symbolToTicker = Object.fromEntries(
      Object.entries(BINANCE_SYMBOLS).map(([ticker, symbol]) => [symbol, ticker])
    );

    const quotes = raw.map((item) => ({
      symbol: symbolToTicker[item.symbol],
      price: parseFloat(item.lastPrice),
      change: parseFloat(item.priceChange),
      changePct: parseFloat(item.priceChangePercent),
    }));

    const mockAll = generateTickerQuotes();
    for (const symbol of ["COIN", "MSTR"]) {
      const quote = mockAll.find((entry) => entry.symbol === symbol);
      if (quote) quotes.push(quote);
    }

    return NextResponse.json(quotes);
  } catch (err) {
    console.error("Binance quotes fallback:", err);
    return NextResponse.json(generateTickerQuotes());
  }
}
