import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";

const HL_INFO = "https://api.hyperliquid.xyz/info";

const SUPPORTED = [
  // Majors
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP",
  "NEAR","INJ","DOT","APT","SUI","TIA","SEI","ATOM","AAVE","UNI",
  // Mid-caps
  "LTC","FIL","WLD","RNDR","PENDLE","JTO","GMX","SNX","CRV","LDO",
  "RUNE","ETC","BLUR","PYTH","WIF","HYPE","STX","TRB","DYDX","GRT",
];

interface HLUniverse { name: string; szDecimals: number; maxLeverage: number }
interface HLAssetCtx {
  dayNtlVlm: string;
  funding: string;
  openInterest: string;
  markPx: string;
  prevDayPx: string;
}
interface HLPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    marginUsed: string;
    liquidationPx: string | null;
  };
}
interface HLAccountResponse {
  assetPositions: HLPosition[];
  crossMarginSummary: { accountValue: string };
  withdrawable: string;
}

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
  "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000, "1w": 604_800_000,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "market") return getMarket();
  if (type === "account") return getAccount(searchParams.get("address") ?? "");
  if (type === "ohlcv") return getOhlcv(
    searchParams.get("ticker") ?? "BTC",
    searchParams.get("interval") ?? "1h",
    parseInt(searchParams.get("limit") ?? "240", 10),
  );
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

async function getOhlcv(ticker: string, interval: string, limit: number) {
  const safeInterval = INTERVAL_MS[interval] ? interval : "1h";
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const endTime = Date.now();
  const startTime = endTime - safeLimit * (INTERVAL_MS[safeInterval] ?? 3_600_000);

  try {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: { coin: ticker, interval: safeInterval, startTime, endTime },
      }),
      next: { revalidate: safeInterval === "1d" || safeInterval === "1w" ? 300 : 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HL candle ${res.status}`);

    const candles: Array<{ t: number; T: number; o: string; h: string; l: string; c: string; v: string }> = await res.json();
    const data = candles.map((c) => ({
      time: Math.floor(c.t / 1000),
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));
    return NextResponse.json(data);
  } catch (err) {
    console.error("HL ohlcv:", err);
    return NextResponse.json([], { status: 200 });
  }
}

async function getMarket() {
  try {
    const [meta, ctxs] = await withCache<[{ universe: HLUniverse[] }, HLAssetCtx[]]>(
      "hl:market",
      15_000,
      async () => {
        const res = await fetch(HL_INFO, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HL ${res.status}`);
        return res.json();
      }
    );
    const assetIndex: Record<string, number> = {};
    const assets = [];

    for (let i = 0; i < meta.universe.length; i++) {
      const name = meta.universe[i].name;
      if (!SUPPORTED.includes(name)) continue;
      assetIndex[name] = i;
      const ctx = ctxs[i];
      if (!ctx) continue;

      const markPx = parseFloat(ctx.markPx);
      const prevPx = parseFloat(ctx.prevDayPx);
      const change24h = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;

      assets.push({
        name,
        markPx,
        fundingRate: parseFloat(ctx.funding) * 100,  // hourly %
        openInterest: parseFloat(ctx.openInterest),
        volume24h: parseFloat(ctx.dayNtlVlm),
        change24h,
        maxLeverage: meta.universe[i].maxLeverage,
      });
    }

    return NextResponse.json({ assets, assetIndex });
  } catch (err) {
    console.error("HL market:", err);
    return NextResponse.json({ assets: [], assetIndex: {} });
  }
}

async function getAccount(address: string) {
  if (!address || !address.startsWith("0x")) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  try {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HL ${res.status}`);

    const data: HLAccountResponse = await res.json();
    const balance = parseFloat(data.crossMarginSummary?.accountValue ?? "0");
    const positions = (data.assetPositions ?? [])
      .filter((p) => parseFloat(p.position.szi) !== 0)
      .map((p) => {
        const size = parseFloat(p.position.szi);
        const entryPx = parseFloat(p.position.entryPx);
        const pnl = parseFloat(p.position.unrealizedPnl);
        const margin = parseFloat(p.position.marginUsed);
        return {
          coin: p.position.coin,
          side: size > 0 ? "long" : "short",
          size: Math.abs(size),
          entryPx,
          pnl,
          roe: margin > 0 ? (pnl / margin) * 100 : 0,
          margin,
          liquidationPx: p.position.liquidationPx
            ? parseFloat(p.position.liquidationPx)
            : null,
        };
      });

    return NextResponse.json({ balance, positions, withdrawable: parseFloat(data.withdrawable ?? "0") });
  } catch (err) {
    console.error("HL account:", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
