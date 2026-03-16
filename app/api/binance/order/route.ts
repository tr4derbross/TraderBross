/**
 * POST /api/binance/order
 * Authenticated Binance Futures order actions (place, cancel, leverage, margin type).
 * All signing is done server-side. Browser never touches raw API keys after vault store.
 */

// Deploy in Frankfurt to avoid Binance US geo-restriction
export const preferredRegion = ["fra1", "sin1", "hnd1"];

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { retrieveCredentials } from "@/lib/credential-vault";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type OrderBody = {
  type: "order" | "cancel" | "leverage" | "marginType";
  sessionToken: string;
  symbol?: string;
  // order placement
  side?: "long" | "short";
  orderType?: "market" | "limit" | "stop";
  marginAmount?: number;
  leverage?: number;
  limitPrice?: number;
  // cancel
  orderId?: string | number;
  // leverage / marginType
  marginMode?: "isolated" | "cross";
};

function hmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function buildSignedQuery(secret: string, params: Record<string, string>) {
  const qs = new URLSearchParams({
    ...params,
    timestamp: Date.now().toString(),
    recvWindow: "5000",
  }).toString();
  return `${qs}&signature=${hmac(secret, qs)}`;
}

async function binancePost<T>(
  apiKey: string,
  apiSecret: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const qs = buildSignedQuery(apiSecret, params);
  const res = await fetch(`https://fapi.binance.com${path}?${qs}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json() as T & { msg?: string; code?: number };
  if (!res.ok) {
    const msg = (data as { msg?: string }).msg;
    const code = (data as { code?: number }).code;
    // Code -4046: already in this margin mode — treat as success
    if (code === -4046) return data;
    throw new Error(msg ?? `Binance error ${res.status}`);
  }
  return data;
}

async function binanceDelete<T>(
  apiKey: string,
  apiSecret: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const qs = buildSignedQuery(apiSecret, params);
  const res = await fetch(`https://fapi.binance.com${path}?${qs}`, {
    method: "DELETE",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json() as T & { msg?: string };
  if (!res.ok) {
    throw new Error((data as { msg?: string }).msg ?? `Binance error ${res.status}`);
  }
  return data;
}

/** Fetch current mark price to compute quantity from marginAmount × leverage */
async function getMarkPrice(symbol: string): Promise<number> {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
    { cache: "no-store", signal: AbortSignal.timeout(5_000) }
  );
  const data = await res.json() as { markPrice?: string };
  const price = parseFloat(data.markPrice ?? "0");
  if (!price) throw new Error(`Could not fetch mark price for ${symbol}`);
  return price;
}

/** Round to an appropriate lot size without fetching exchange info */
function roundQuantity(qty: number): string {
  if (qty >= 100) return qty.toFixed(0);
  if (qty >= 10) return qty.toFixed(1);
  if (qty >= 1) return qty.toFixed(2);
  if (qty >= 0.1) return qty.toFixed(3);
  return qty.toFixed(4);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`binance-order:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Wait before retrying." }, { status: 429 });
  }

  let body: OrderBody;
  try {
    body = await req.json() as OrderBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sessionToken) {
    return NextResponse.json({ ok: false, error: "Session token required" }, { status: 401 });
  }

  const creds = retrieveCredentials(body.sessionToken);
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "Session expired. Re-save your Binance credentials and try again." },
      { status: 401 }
    );
  }

  const { apiKey, apiSecret } = creds;

  try {
    // ── Set Leverage ────────────────────────────────────────────────────────
    if (body.type === "leverage") {
      if (!body.symbol || body.leverage == null) {
        return NextResponse.json({ ok: false, error: "symbol and leverage required" }, { status: 400 });
      }
      const symbol = `${body.symbol}USDT`;
      await binancePost(apiKey, apiSecret, "/fapi/v1/leverage", {
        symbol,
        leverage: Math.round(body.leverage).toString(),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Set Margin Type ─────────────────────────────────────────────────────
    if (body.type === "marginType") {
      if (!body.symbol || !body.marginMode) {
        return NextResponse.json({ ok: false, error: "symbol and marginMode required" }, { status: 400 });
      }
      const symbol = `${body.symbol}USDT`;
      const marginType = body.marginMode === "cross" ? "CROSSED" : "ISOLATED";
      await binancePost(apiKey, apiSecret, "/fapi/v1/marginType", { symbol, marginType });
      return NextResponse.json({ ok: true });
    }

    // ── Cancel Order ────────────────────────────────────────────────────────
    if (body.type === "cancel") {
      if (!body.symbol || body.orderId == null) {
        return NextResponse.json({ ok: false, error: "symbol and orderId required" }, { status: 400 });
      }
      const symbol = `${body.symbol}USDT`;
      await binanceDelete(apiKey, apiSecret, "/fapi/v1/order", {
        symbol,
        orderId: body.orderId.toString(),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Place Order ─────────────────────────────────────────────────────────
    if (body.type === "order") {
      if (!body.symbol || !body.side || !body.orderType || !body.marginAmount || !body.leverage) {
        return NextResponse.json(
          { ok: false, error: "symbol, side, orderType, marginAmount, leverage required" },
          { status: 400 }
        );
      }

      const symbol = `${body.symbol}USDT`;
      const binanceSide = body.side === "long" ? "BUY" : "SELL";

      // Calculate quantity from margin × leverage / mark price
      const markPrice = await getMarkPrice(symbol);
      const notional = body.marginAmount * body.leverage;
      const qty = notional / markPrice;
      const quantity = roundQuantity(qty);

      let binanceType: string;
      const params: Record<string, string> = { symbol, side: binanceSide, quantity };

      if (body.orderType === "market") {
        binanceType = "MARKET";
      } else if (body.orderType === "limit") {
        if (!body.limitPrice) {
          return NextResponse.json({ ok: false, error: "limitPrice required for limit orders" }, { status: 400 });
        }
        binanceType = "LIMIT";
        params.price = body.limitPrice.toString();
        params.timeInForce = "GTC";
      } else {
        // stop
        if (!body.limitPrice) {
          return NextResponse.json({ ok: false, error: "limitPrice required as stop price" }, { status: 400 });
        }
        binanceType = "STOP_MARKET";
        params.stopPrice = body.limitPrice.toString();
      }
      params.type = binanceType;

      const result = await binancePost<{ orderId?: number; status?: string }>(
        apiKey,
        apiSecret,
        "/fapi/v1/order",
        params
      );

      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ ok: false, error: "Unknown action type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Order request failed" },
      { status: 500 }
    );
  }
}
