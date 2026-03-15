import { NextResponse } from "next/server";

const BASE = "https://mempool.space/api";

export async function GET() {
  try {
    const [feesRes, heightRes, mempoolRes, halvingRes] = await Promise.all([
      fetch(`${BASE}/v1/fees/recommended`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${BASE}/blocks/tip/height`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${BASE}/mempool`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${BASE}/v1/halvings/next`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
    ]);

    const [fees, blockHeight, mempool, halving] = await Promise.all([
      feesRes.ok ? feesRes.json() : null,
      heightRes.ok ? heightRes.text().then((t) => parseInt(t.trim(), 10)) : null,
      mempoolRes.ok ? mempoolRes.json() : null,
      halvingRes.ok ? halvingRes.json() : null,
    ]);

    return NextResponse.json({
      fees: fees as {
        fastestFee: number;
        halfHourFee: number;
        hourFee: number;
        economyFee: number;
        minimumFee: number;
      } | null,
      blockHeight: typeof blockHeight === "number" && !isNaN(blockHeight) ? blockHeight : null,
      mempool: mempool as {
        count: number;
        vsize: number;
        total_fee: number;
      } | null,
      halving: halving as {
        remainingBlocks: number;
        remainingTime: number;
        estimatedDatetime: string;
      } | null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Mempool API error:", err);
    return NextResponse.json({
      fees: null,
      blockHeight: null,
      mempool: null,
      halving: null,
      updatedAt: new Date().toISOString(),
    });
  }
}
