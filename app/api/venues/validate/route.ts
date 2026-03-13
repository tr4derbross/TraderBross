import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type VenueId = "binance" | "okx" | "bybit";

type ValidatePayload = {
  venueId?: VenueId;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function hmac(secret: string, value: string, encoding: "hex" | "base64") {
  return crypto.createHmac("sha256", secret).update(value).digest(encoding);
}

async function validateBinance(apiKey: string, apiSecret: string) {
  const timestamp = Date.now().toString();
  const query = new URLSearchParams({
    timestamp,
    recvWindow: "5000",
  }).toString();
  const signature = hmac(apiSecret, query, "hex");
  const path = `/api/v3/account?${query}&signature=${signature}`;

  const response = await fetch(`https://api.binance.com${path}`, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: data?.msg || `Binance validation failed (${response.status}).`,
    };
  }

  return {
    ok: true,
    message: "Binance credentials verified.",
    detail: data?.accountType ? `Account type: ${data.accountType}` : "Account access is available.",
  };
}

async function validateOkx(apiKey: string, apiSecret: string, passphrase: string) {
  const path = "/api/v5/account/balance";
  const timestamp = new Date().toISOString();
  const signature = hmac(apiSecret, `${timestamp}GET${path}`, "base64");

  const response = await fetch(`https://www.okx.com${path}`, {
    method: "GET",
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": passphrase,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.code !== "0") {
    return {
      ok: false,
      message: data?.msg || `OKX validation failed (${response.status}).`,
    };
  }

  return {
    ok: true,
    message: "OKX credentials verified.",
    detail: "Signed account access is available.",
  };
}

async function validateBybit(apiKey: string, apiSecret: string) {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const query = new URLSearchParams({
    accountType: "UNIFIED",
  }).toString();
  const payload = `${timestamp}${apiKey}${recvWindow}${query}`;
  const signature = hmac(apiSecret, payload, "hex");

  const response = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${query}`, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.retCode !== 0) {
    return {
      ok: false,
      message: data?.retMsg || `Bybit validation failed (${response.status}).`,
    };
  }

  return {
    ok: true,
    message: "Bybit credentials verified.",
    detail: "Unified account access is available.",
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ValidatePayload;
  const venueId = body.venueId;
  const apiKey = body.apiKey?.trim();
  const apiSecret = body.apiSecret?.trim();
  const passphrase = body.passphrase?.trim();

  if (!venueId || !["binance", "okx", "bybit"].includes(venueId)) {
    return jsonError("Unsupported venue for API validation.");
  }

  if (!apiKey || !apiSecret) {
    return jsonError("API key and secret are required.");
  }

  if (venueId === "okx" && !passphrase) {
    return jsonError("OKX passphrase is required.");
  }

  try {
    const result =
      venueId === "binance"
        ? await validateBinance(apiKey, apiSecret)
        : venueId === "okx"
          ? await validateOkx(apiKey, apiSecret, passphrase!)
          : await validateBybit(apiKey, apiSecret);

    return NextResponse.json(result, { status: result.ok ? 200 : 401 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Validation request failed.",
      },
      { status: 500 }
    );
  }
}
