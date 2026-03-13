import { NextRequest, NextResponse } from "next/server";

const BINANCE_BASE = "https://fapi.binance.com";
const OKX_BASE = "https://www.okx.com";
const BYBIT_BASE = "https://api.bybit.com";

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

const OKX_SYMBOLS: Record<string, string> = {
  BTC: "BTC-USDT-SWAP",
  ETH: "ETH-USDT-SWAP",
  SOL: "SOL-USDT-SWAP",
  BNB: "BNB-USDT-SWAP",
  XRP: "XRP-USDT-SWAP",
  DOGE: "DOGE-USDT-SWAP",
  AVAX: "AVAX-USDT-SWAP",
  LINK: "LINK-USDT-SWAP",
  ARB: "ARB-USDT-SWAP",
  OP: "OP-USDT-SWAP",
  NEAR: "NEAR-USDT-SWAP",
  INJ: "INJ-USDT-SWAP",
  DOT: "DOT-USDT-SWAP",
};

const BYBIT_SYMBOLS = BINANCE_SYMBOLS;

type FundingVenue = {
  venue: "Binance" | "OKX" | "Bybit";
  rate: number | null;
  nextFundingTime: number | null;
  intervalHours: number | null;
  status: "live" | "unavailable";
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") ?? "BTC").toUpperCase();

  if (!BINANCE_SYMBOLS[ticker]) {
    return NextResponse.json({
      ticker,
      averageRate: null,
      rates: [] satisfies FundingVenue[],
      updatedAt: new Date().toISOString(),
    });
  }

  const [binance, okx, bybit] = await Promise.all([
    getBinanceFunding(ticker),
    getOkxFunding(ticker),
    getBybitFunding(ticker),
  ]);

  const rates = [binance, okx, bybit];
  const liveRates = rates
    .map((item) => item.rate)
    .filter((value): value is number => typeof value === "number");

  return NextResponse.json({
    ticker,
    averageRate:
      liveRates.length > 0
        ? liveRates.reduce((sum, value) => sum + value, 0) / liveRates.length
        : null,
    rates,
    updatedAt: new Date().toISOString(),
  });
}

async function getBinanceFunding(ticker: string): Promise<FundingVenue> {
  const symbol = BINANCE_SYMBOLS[ticker];

  try {
    const res = await fetch(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) throw new Error(`Binance ${res.status}`);

    const data = (await res.json()) as {
      lastFundingRate?: string;
      nextFundingTime?: number;
    };

    return {
      venue: "Binance",
      rate: data.lastFundingRate ? parseFloat(data.lastFundingRate) : null,
      nextFundingTime: typeof data.nextFundingTime === "number" ? data.nextFundingTime : null,
      intervalHours: 8,
      status: "live",
    };
  } catch (error) {
    console.error("Binance funding:", error);
    return {
      venue: "Binance",
      rate: null,
      nextFundingTime: null,
      intervalHours: 8,
      status: "unavailable",
    };
  }
}

async function getOkxFunding(ticker: string): Promise<FundingVenue> {
  const instId = OKX_SYMBOLS[ticker];

  try {
    const res = await fetch(`${OKX_BASE}/api/v5/public/funding-rate?instId=${instId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) throw new Error(`OKX ${res.status}`);

    const payload = (await res.json()) as {
      data?: Array<{
        fundingRate?: string;
        nextFundingTime?: string;
        fundingTime?: string;
      }>;
    };
    const item = payload.data?.[0];

    const nextFundingTime = item?.nextFundingTime
      ? parseInt(item.nextFundingTime, 10)
      : item?.fundingTime
        ? parseInt(item.fundingTime, 10)
        : null;

    return {
      venue: "OKX",
      rate: item?.fundingRate ? parseFloat(item.fundingRate) : null,
      nextFundingTime: Number.isFinite(nextFundingTime) ? nextFundingTime : null,
      intervalHours: 8,
      status: "live",
    };
  } catch (error) {
    console.error("OKX funding:", error);
    return {
      venue: "OKX",
      rate: null,
      nextFundingTime: null,
      intervalHours: 8,
      status: "unavailable",
    };
  }
}

async function getBybitFunding(ticker: string): Promise<FundingVenue> {
  const symbol = BYBIT_SYMBOLS[ticker];

  try {
    const res = await fetch(
      `${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${symbol}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      }
    );

    if (!res.ok) throw new Error(`Bybit ${res.status}`);

    const payload = (await res.json()) as {
      result?: {
        list?: Array<{
          fundingRate?: string;
          nextFundingTime?: string;
        }>;
      };
    };
    const item = payload.result?.list?.[0];
    const nextFundingTime = item?.nextFundingTime ? parseInt(item.nextFundingTime, 10) : null;

    return {
      venue: "Bybit",
      rate: item?.fundingRate ? parseFloat(item.fundingRate) : null,
      nextFundingTime: Number.isFinite(nextFundingTime) ? nextFundingTime : null,
      intervalHours: 8,
      status: "live",
    };
  } catch (error) {
    console.error("Bybit funding:", error);
    return {
      venue: "Bybit",
      rate: null,
      nextFundingTime: null,
      intervalHours: 8,
      status: "unavailable",
    };
  }
}
