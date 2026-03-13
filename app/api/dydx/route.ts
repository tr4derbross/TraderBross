import { NextRequest, NextResponse } from "next/server";

const DYDX_INDEXER = "https://indexer.dydx.trade/v4";

const SUPPORTED = [
  "BTC","ETH","SOL","BNB","XRP","DOGE","AVAX","LINK","ARB","OP","NEAR","INJ","DOT",
];

interface DyDxMarket {
  ticker: string;         // "BTC-USD"
  oraclePrice: string;
  priceChange24H: string;
  volume24H: string;
  openInterest: string;
  nextFundingRate: string;
  initialMarginFraction: string;
}

interface DyDxSubaccount {
  openPerpetualPositions: Record<string, {
    market: string;
    side: "LONG" | "SHORT";
    size: string;
    entryPrice: string;
    unrealizedPnl: string;
    netFunding: string;
  }>;
  equity: string;
  freeCollateral: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "markets") return getMarkets();
  if (type === "account") return getAccount(searchParams.get("address") ?? "");
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}

async function getMarkets() {
  try {
    const res = await fetch(`${DYDX_INDEXER}/perpetualMarkets`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`dYdX ${res.status}`);

    const { markets } = await res.json() as { markets: Record<string, DyDxMarket> };

    const assets = Object.entries(markets)
      .filter(([, m]) => {
        const base = m.ticker.replace("-USD", "").replace("-PERP","");
        return SUPPORTED.includes(base);
      })
      .map(([, m]) => {
        const base = m.ticker.replace("-USD", "").replace("-PERP","");
        const price = parseFloat(m.oraclePrice);
        const change24h = parseFloat(m.priceChange24H);
        const changePct = price > 0 ? (change24h / (price - change24h)) * 100 : 0;
        const maxLev = m.initialMarginFraction ? Math.floor(1 / parseFloat(m.initialMarginFraction)) : 20;
        return {
          name: base,
          ticker: m.ticker,
          markPx: price,
          fundingRate: parseFloat(m.nextFundingRate) * 100, // already 8h, convert to hourly
          openInterest: parseFloat(m.openInterest),
          volume24h: parseFloat(m.volume24H),
          change24h: changePct,
          maxLeverage: maxLev,
        };
      })
      .sort((a, b) => SUPPORTED.indexOf(a.name) - SUPPORTED.indexOf(b.name));

    return NextResponse.json({ assets });
  } catch (err) {
    console.error("dYdX markets:", err);
    return NextResponse.json({ assets: [] });
  }
}

async function getAccount(address: string) {
  if (!address || !address.startsWith("dydx")) {
    return NextResponse.json({ error: "dYdX address must start with 'dydx'" }, { status: 400 });
  }
  try {
    const res = await fetch(`${DYDX_INDEXER}/addresses/${address}/subaccounts`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`dYdX ${res.status}`);

    const { subaccounts } = await res.json() as { subaccounts: DyDxSubaccount[] };
    const sub = subaccounts?.[0];
    if (!sub) return NextResponse.json({ balance: 0, positions: [] });

    const positions = Object.values(sub.openPerpetualPositions)
      .filter((p) => parseFloat(p.size) !== 0)
      .map((p) => {
        const base = p.market.replace("-USD", "").replace("-PERP","");
        const size = parseFloat(p.size);
        const entryPx = parseFloat(p.entryPrice);
        const pnl = parseFloat(p.unrealizedPnl);
        return {
          coin: base,
          side: p.side === "LONG" ? "long" : "short" as "long" | "short",
          size: Math.abs(size),
          entryPx,
          pnl,
          roe: 0,
          margin: 0,
        };
      });

    return NextResponse.json({
      balance: parseFloat(sub.equity),
      freeCollateral: parseFloat(sub.freeCollateral),
      positions,
    });
  } catch (err) {
    console.error("dYdX account:", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
