import { NextRequest, NextResponse } from "next/server";

// Proxy HL exchange endpoint — client sends pre-signed payload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch("https://api.hyperliquid.xyz/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("HL order proxy:", err);
    return NextResponse.json({ error: "Order proxy failed" }, { status: 500 });
  }
}
