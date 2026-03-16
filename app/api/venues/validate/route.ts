import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { retrieveCredentials } from "@/lib/credential-vault";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type VenueId = "binance" | "okx" | "bybit";

type ValidatePayload = {
  venueId?: VenueId;
  /**
   * Preferred path: server-side vault token.
   * The browser stores only this token — raw keys never leave the server
   * after the initial /api/vault/store call.
   */
  sessionToken?: string;
  /** Legacy / direct path (raw credentials). Still accepted as fallback. */
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
};

const IS_PROD = process.env.NODE_ENV === "production";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function safeError(err: unknown, fallback = "Validation request failed.") {
  if (IS_PROD) return fallback;
  return err instanceof Error ? err.message : fallback;
}

function hmac(secret: string, value: string, encoding: "hex" | "base64") {
  return crypto.createHmac("sha256", secret).update(value).digest(encoding);
}

async function validateBinance(apiKey: string, apiSecret: string) {
  const timestamp = Date.now().toString();
  const query = new URLSearchParams({ timestamp, recvWindow: "5000" }).toString();
  const signature = hmac(apiSecret, query, "hex");
  const path = `/api/v3/account?${query}&signature=${signature}`;

  const response = await fetch(`https://api.binance.com${path}`, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, message: data?.msg || `Binance validation failed (${response.status}).` };
  }
  return {
    ok: true,
    message: "Binance credentials verified.",
    detail: data?.accountType ? `Account type: ${data.accountType}` : "Account access is available.",
  };
}

async function validateOkx(apiKey: string, apiSecret: string, passphrase: string) {
  const path      = "/api/v5/account/balance";
  const timestamp = new Date().toISOString();
  const signature = hmac(apiSecret, `${timestamp}GET${path}`, "base64");

  const response = await fetch(`https://www.okx.com${path}`, {
    method: "GET",
    headers: {
      "OK-ACCESS-KEY":         apiKey,
      "OK-ACCESS-SIGN":        signature,
      "OK-ACCESS-TIMESTAMP":   timestamp,
      "OK-ACCESS-PASSPHRASE":  passphrase,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.code !== "0") {
    return { ok: false, message: data?.msg || `OKX validation failed (${response.status}).` };
  }
  return { ok: true, message: "OKX credentials verified.", detail: "Signed account access is available." };
}

async function validateBybit(apiKey: string, apiSecret: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = "5000";
  const query      = new URLSearchParams({ accountType: "UNIFIED" }).toString();
  const payload    = `${timestamp}${apiKey}${recvWindow}${query}`;
  const signature  = hmac(apiSecret, payload, "hex");

  const response = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${query}`, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY":      apiKey,
      "X-BAPI-SIGN":         signature,
      "X-BAPI-TIMESTAMP":    timestamp,
      "X-BAPI-RECV-WINDOW":  recvWindow,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.retCode !== 0) {
    return { ok: false, message: data?.retMsg || `Bybit validation failed (${response.status}).` };
  }
  return { ok: true, message: "Bybit credentials verified.", detail: "Unified account access is available." };
}

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 validation attempts per minute per IP ────────────────────
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`venue-validate:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many validation attempts. Please wait before retrying." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as ValidatePayload;
  const venueId = body.venueId;

  if (!venueId || !["binance", "okx", "bybit"].includes(venueId)) {
    return jsonError("Unsupported venue for API validation.");
  }

  /* ── Resolve credentials ── */
  let apiKey: string;
  let apiSecret: string;
  let passphrase: string | undefined;

  if (body.sessionToken) {
    // Preferred: retrieve from server-side vault — raw keys never hit the wire again
    const creds = retrieveCredentials(body.sessionToken);
    if (!creds) {
      return jsonError("Session expired or not found. Please re-save your credentials.", 401);
    }
    apiKey     = creds.apiKey;
    apiSecret  = creds.apiSecret;
    passphrase = creds.passphrase;
  } else {
    // Fallback: raw credentials in request body (only allowed in non-production)
    if (IS_PROD) {
      return jsonError("Direct credential submission is disabled. Use the vault flow.", 400);
    }
    apiKey     = body.apiKey?.trim()     ?? "";
    apiSecret  = body.apiSecret?.trim()  ?? "";
    passphrase = body.passphrase?.trim() ?? undefined;

    if (!apiKey || !apiSecret) {
      return jsonError("Provide either a sessionToken or raw apiKey + apiSecret.");
    }
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
      { ok: false, message: safeError(error) },
      { status: 500 },
    );
  }
}
