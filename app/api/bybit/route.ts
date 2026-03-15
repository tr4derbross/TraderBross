import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withCache } from "@/lib/server-cache";

const BYBIT_BASE = "https://api.bybit.com";

const PERP_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", BNB: "BNBUSDT",
  XRP: "XRPUSDT", DOGE: "DOGEUSDT", AVAX: "AVAXUSDT", LINK: "LINKUSDT",
  ARB: "ARBUSDT", OP: "OPUSDT", NEAR: "NEARUSDT", INJ: "INJUSDT",
  DOT: "DOTUSDT",
};

// Bybit interval mapping
const INTERVAL_MAP: Record<string, string> = {
  "1h": "60", "4h": "240", "1d": "D", "1w": "W",
};

function bybitSign(params: Record<string, string>, body = ""): Record<string, string> {
  const key = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_SECRET;
  if (!key || !secret) return {};

  const ts = Date.now().toString();
  const recvWindow = "5000";
  const payload = ts + key + recvWindow + (body || new URLSearchParams(params).toString());
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "X-BAPI-API-KEY": key,
    "X-BAPI-SIGN": sig,
    "X-BAPI-TIMESTAMP": ts,
    "X-BAPI-RECV-WINDOW": recvWindow,
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const ticker = searchParams.get("ticker") ?? "BTC";
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "90"), 200);

  if (type === "status") return getStatus();
  if (type === "quotes") return getQuotes();
  if (type === "ohlcv") return getOHLCV(ticker, interval, limit);
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // Proxy trading orders — requires BYBIT_API_KEY in .env.local
  const body = await req.json();
  const bodyStr = JSON.stringify(body);
  const headers = bybitSign({}, bodyStr);
  if (!headers["X-BAPI-API-KEY"]) {
    return NextResponse.json({ error: "Bybit API key not configured" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BYBIT_BASE}/v5/order/create`, {
      method: "POST",
      headers,
      body: bodyStr,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function getQuotes() {
  try {
    const result = await withCache("bybit:quotes", 20_000, async () => {
      const res = await fetch(
        `${BYBIT_BASE}/v5/market/tickers?category=linear`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const json = await res.json() as {
        result: { list: Array<{ symbol: string; lastPrice: string; price24hPcnt: string; prevPrice24h: string }> }
      };
      return json.result;
    });
    if (!result) throw new Error("no data");

    const reverseMap = Object.fromEntries(Object.entries(PERP_MAP).map(([t, s]) => [s, t]));
    return NextResponse.json(
      result.list
        .filter((d) => reverseMap[d.symbol])
        .map((d) => {
          const ticker = reverseMap[d.symbol];
          const price = parseFloat(d.lastPrice);
          const changePct = parseFloat(d.price24hPcnt) * 100;
          const open = parseFloat(d.prevPrice24h);
          return { symbol: ticker, price, change: price - open, changePct, exchange: "Bybit" };
        })
    );
  } catch (err) {
    console.error("Bybit quotes:", err);
    return NextResponse.json([]);
  }
}

function getStatus() {
  const configured = Boolean(process.env.BYBIT_API_KEY && process.env.BYBIT_SECRET);
  return NextResponse.json({ configured });
}

async function getOHLCV(ticker: string, interval: string, limit: number) {
  const symbol = PERP_MAP[ticker];
  const bybitInterval = INTERVAL_MAP[interval] ?? "D";
  if (!symbol) return NextResponse.json([]);

  try {
    const res = await fetch(
      `${BYBIT_BASE}/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`,
      { next: { revalidate: interval === "1d" || interval === "1w" ? 300 : 60 } }
    );
    if (!res.ok) throw new Error(`Bybit ${res.status}`);
    const { result } = await res.json() as {
      result: { list: string[][] }
    };

    // Bybit: [startTime, open, high, low, close, volume, turnover] — newest first
    return NextResponse.json(
      result.list.reverse().map((k) => ({
        time: Math.floor(parseInt(k[0]) / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
    );
  } catch (err) {
    console.error("Bybit OHLCV:", err);
    return NextResponse.json([]);
  }
}
