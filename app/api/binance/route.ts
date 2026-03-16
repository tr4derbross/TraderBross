/**
 * POST /api/binance
 * Authenticated Binance Futures account data (balance, positions).
 * Credentials retrieved from server-side vault via sessionToken.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { retrieveCredentials } from "@/lib/credential-vault";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type RequestBody = {
  type: "balance" | "positions";
  sessionToken: string;
};

function hmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function signedQuery(secret: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({
    ...params,
    timestamp: Date.now().toString(),
    recvWindow: "5000",
  }).toString();
  return `${qs}&signature=${hmac(secret, qs)}`;
}

async function binanceGet<T>(apiKey: string, apiSecret: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = signedQuery(apiSecret, params);
  const res = await fetch(`https://fapi.binance.com${path}?${qs}`, {
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json() as T & { msg?: string; code?: number };
  if (!res.ok) {
    throw new Error((data as { msg?: string }).msg ?? `Binance API error ${res.status}`);
  }
  return data;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`binance-data:${ip}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sessionToken) {
    return NextResponse.json({ error: "Session token required" }, { status: 401 });
  }

  const creds = retrieveCredentials(body.sessionToken);
  if (!creds) {
    return NextResponse.json({ error: "Session expired. Please re-save credentials." }, { status: 401 });
  }

  const { apiKey, apiSecret } = creds;

  try {
    if (body.type === "balance") {
      const data = await binanceGet<Array<{ asset: string; balance: string; availableBalance: string }>>(
        apiKey,
        apiSecret,
        "/fapi/v2/balance"
      );
      const usdt = data.find((b) => b.asset === "USDT");
      return NextResponse.json({
        total: parseFloat(usdt?.balance ?? "0"),
        available: parseFloat(usdt?.availableBalance ?? "0"),
        currency: "USDT",
      });
    }

    if (body.type === "positions") {
      const data = await binanceGet<Array<{
        symbol: string;
        positionAmt: string;
        entryPrice: string;
        unRealizedProfit: string;
        liquidationPrice: string;
      }>>(apiKey, apiSecret, "/fapi/v2/positionRisk");

      const positions = data
        .filter((p) => parseFloat(p.positionAmt) !== 0)
        .map((p) => {
          const size = parseFloat(p.positionAmt);
          const symbol = p.symbol.replace(/USDT$/, "");
          return {
            coin: symbol,
            side: size > 0 ? "long" : "short",
            size: Math.abs(size),
            entryPx: parseFloat(p.entryPrice),
            pnl: parseFloat(p.unRealizedProfit),
            liquidationPx: parseFloat(p.liquidationPrice) || null,
          };
        });

      return NextResponse.json({ positions });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
