import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";

const BASE  = "https://data-api.binance.vision";
const FAPI  = "https://fapi.binance.com";

// Symbols known to have perpetual futures on Binance
const FUTURES_SET = new Set([
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","SUI","OP","NEAR",
  "INJ","ATOM","DOT","APT","HYPE","LTC","UNI","ADA","TRX","FIL","PEPE","WIF",
  "BONK","RUNE","STX","SEI","FTM","1000PEPE","MATIC","FET","RENDER","TAO",
  "PENDLE","WLD","TIA","PYTH","JTO","JUP","DYM","MANTA","STRK","ORDI","SATS",
]);

interface BinanceTicker {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  count: string;
}

export interface ScreenerCoin {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  trades24h: number;
  /** RSI-14 on 4h candles — null if unavailable */
  rsi14?: number | null;
  /** Open Interest in USD (Binance perp futures) — null if no futures */
  openInterestUsd?: number | null;
  /** Long/Short ratio (global accounts) — null if unavailable */
  longShortRatio?: number | null;
}

// ─── RSI-14 (Wilder's smoothing, no external library needed) ─────────────────
function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains   = changes.map((c) => (c > 0 ? c : 0));
  const losses  = changes.map((c) => (c < 0 ? -c : 0));

  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

async function fetchRSI(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE}/api/v3/klines?symbol=${symbol}USDT&interval=4h&limit=50`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    // kline format: [openTime, open, high, low, close, volume, ...]
    const klines: [number, string, string, string, string][] = await res.json();
    const closes = klines.map((k) => parseFloat(k[4]));
    return computeRSI(closes);
  } catch {
    return null;
  }
}

async function fetchOpenInterest(symbol: string, price: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${FAPI}/fapi/v1/openInterest?symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data: { openInterest: string } = await res.json();
    return Math.round(parseFloat(data.openInterest) * price);
  } catch {
    return null;
  }
}

async function fetchLongShortRatio(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}USDT&period=1h&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data: { longShortRatio: string }[] = await res.json();
    const v = data?.[0]?.longShortRatio;
    return v ? Math.round(parseFloat(v) * 100) / 100 : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "volume";

  try {
    const data = await withCache(`screener-v3:${sort}`, 45_000, async () => {
      // Step 1: Fetch 24h ticker data from Binance CDN
      const res = await fetch(`${BASE}/api/v3/ticker/24hr`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Binance ${res.status}`);

      const raw: BinanceTicker[] = await res.json();

      const coins: ScreenerCoin[] = raw
        .filter(
          (t) =>
            t.symbol.endsWith("USDT") &&
            !/UP|DOWN|BEAR|BULL/.test(t.symbol)
        )
        .map((t) => ({
          symbol: t.symbol.replace("USDT", ""),
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          volume24h: parseFloat(t.quoteVolume),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          trades24h: parseInt(t.count, 10) || 0,
        }))
        .filter((t) => t.volume24h > 500_000 && t.price > 0);

      const sorted = [...coins].sort((a, b) => {
        if (sort === "gainers") return b.change24h - a.change24h;
        if (sort === "losers") return a.change24h - b.change24h;
        return b.volume24h - a.volume24h;
      });

      const top100 = sorted.slice(0, 100);

      // Step 2: Enrich top 20 futures coins with RSI + OI + L/S ratio
      const enrichTargets = top100
        .filter((c) => FUTURES_SET.has(c.symbol))
        .slice(0, 20);

      if (enrichTargets.length > 0) {
        const enrichResults = await Promise.allSettled(
          enrichTargets.map(async (coin) => {
            const [rsi14, openInterestUsd, longShortRatio] = await Promise.all([
              fetchRSI(coin.symbol),
              fetchOpenInterest(coin.symbol, coin.price),
              fetchLongShortRatio(coin.symbol),
            ]);
            return { symbol: coin.symbol, rsi14, openInterestUsd, longShortRatio };
          })
        );

        const enrichMap = new Map<
          string,
          { rsi14: number | null; openInterestUsd: number | null; longShortRatio: number | null }
        >();
        for (const r of enrichResults) {
          if (r.status === "fulfilled") {
            enrichMap.set(r.value.symbol, {
              rsi14: r.value.rsi14,
              openInterestUsd: r.value.openInterestUsd,
              longShortRatio: r.value.longShortRatio,
            });
          }
        }

        return top100.map((coin) => ({
          ...coin,
          ...(enrichMap.get(coin.symbol) ?? {}),
        }));
      }

      return top100;
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Screener error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
