import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withCache } from "@/lib/server-cache";
import { logger } from "@/lib/logger";

const OKX_BASE = "https://www.okx.com";

// OKX instId mapping (SWAP = perpetual)
const PERP_MAP: Record<string, string> = {
  BTC: "BTC-USDT-SWAP", ETH: "ETH-USDT-SWAP", SOL: "SOL-USDT-SWAP",
  BNB: "BNB-USDT-SWAP", XRP: "XRP-USDT-SWAP", DOGE: "DOGE-USDT-SWAP",
  AVAX: "AVAX-USDT-SWAP", LINK: "LINK-USDT-SWAP", ARB: "ARB-USDT-SWAP",
  OP: "OP-USDT-SWAP", NEAR: "NEAR-USDT-SWAP", INJ: "INJ-USDT-SWAP",
  DOT: "DOT-USDT-SWAP",
};

// Interval mapping: our format → OKX bar
const BAR_MAP: Record<string, string> = {
  "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W",
};

function okxSign(method: string, path: string, body: string) {
  const key = process.env.OKX_API_KEY;
  const secret = process.env.OKX_SECRET;
  const passphrase = process.env.OKX_PASSPHRASE;
  if (!key || !secret || !passphrase) return null;

  const ts = new Date().toISOString();
  const msg = ts + method.toUpperCase() + path + body;
  const sig = crypto.createHmac("sha256", secret).update(msg).digest("base64");
  return {
    "OK-ACCESS-KEY": key,
    "OK-ACCESS-SIGN": sig,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const ticker = searchParams.get("ticker") ?? "BTC";
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "90"), 300);

  if (type === "status") return getStatus();
  if (type === "quotes") return getQuotes();
  if (type === "ohlcv") return getOHLCV(ticker, interval, limit);
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // Proxy trading orders — requires OKX_API_KEY in .env.local
  const body = await req.json();
  const path = "/api/v5/trade/order";
  const headers = okxSign("POST", path, JSON.stringify(body));
  if (!headers) return NextResponse.json({ error: "OKX API key not configured" }, { status: 401 });

  try {
    const res = await fetch(`${OKX_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function getQuotes() {
  try {
    const data = await withCache("okx:quotes", 20_000, async () => {
      const res = await fetch(
        `${OKX_BASE}/api/v5/market/tickers?instType=SWAP`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`OKX ${res.status}`);
      return (await res.json() as { data: Array<{ instId: string; last: string; open24h: string; volCcy24h: string }> }).data;
    });
    if (!data) throw new Error("no data");
    const reverseMap = Object.fromEntries(Object.entries(PERP_MAP).map(([t, id]) => [id, t]));
    return NextResponse.json(
      data
      .filter((d) => reverseMap[d.instId])
      .map((d) => {
        const ticker = reverseMap[d.instId];
        const price = parseFloat(d.last);
        const open = parseFloat(d.open24h);
        const change = price - open;
        const changePct = open > 0 ? (change / open) * 100 : 0;
        return { symbol: ticker, price, change, changePct, exchange: "OKX" };
      })
    );
  } catch (err) {
    logger.error("OKX quotes:", err);
    return NextResponse.json([]);
  }
}

function getStatus() {
  const configured = Boolean(
    process.env.OKX_API_KEY &&
    process.env.OKX_SECRET &&
    process.env.OKX_PASSPHRASE
  );

  return NextResponse.json({ configured });
}

async function getOHLCV(ticker: string, interval: string, limit: number) {
  const instId = PERP_MAP[ticker];
  const bar = BAR_MAP[interval] ?? "1D";
  if (!instId) return NextResponse.json([]);

  try {
    const res = await fetch(
      `${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
      { next: { revalidate: interval === "1d" || interval === "1w" ? 300 : 60 } }
    );
    if (!res.ok) throw new Error(`OKX ${res.status}`);
    const { data } = await res.json() as { data: string[][] };

    // OKX candle: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    return NextResponse.json(
      data.reverse().map((k) => ({
        time: Math.floor(parseInt(k[0]) / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
    );
  } catch (err) {
    logger.error("OKX OHLCV:", err);
    return NextResponse.json([]);
  }
}
