import { NextRequest, NextResponse } from "next/server";

// Preferred Vercel regions to avoid Binance/OKX geo-restriction (prefer EU/Asia)
export const preferredRegion = ["fra1", "sin1", "hnd1"];
export const runtime = "edge";

const PERP_MAP: Record<string, string> = {
  BTC: "BTC-USDT-SWAP", ETH: "ETH-USDT-SWAP", SOL: "SOL-USDT-SWAP",
  BNB: "BNB-USDT-SWAP", XRP: "XRP-USDT-SWAP", DOGE: "DOGE-USDT-SWAP",
  AVAX: "AVAX-USDT-SWAP", LINK: "LINK-USDT-SWAP", ARB: "ARB-USDT-SWAP",
  OP: "OP-USDT-SWAP", NEAR: "NEAR-USDT-SWAP", INJ: "INJ-USDT-SWAP",
  DOT: "DOT-USDT-SWAP", SUI: "SUI-USDT-SWAP", APT: "APT-USDT-SWAP",
  WIF: "WIF-USDT-SWAP", HYPE: "HYPE-USDT-SWAP", TIA: "TIA-USDT-SWAP",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") ?? "BTC").toUpperCase();
  const sz = Math.min(parseInt(searchParams.get("sz") ?? "4"), 8);

  const instId = PERP_MAP[ticker] ?? `${ticker}-USDT-SWAP`;

  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/books?instId=${instId}&sz=${sz}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) {
      return NextResponse.json({ bids: [], asks: [] }, { status: 200 });
    }
    const json = await res.json();
    const data = json?.data?.[0];
    return NextResponse.json(
      { bids: data?.bids ?? [], asks: data?.asks ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ bids: [], asks: [] }, { status: 200 });
  }
}
