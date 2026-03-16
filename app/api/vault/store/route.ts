/**
 * POST /api/vault/store
 *
 * Accepts CEX API credentials, encrypts them server-side with AES-256-CBC,
 * and returns a short-lived session token.
 *
 * The browser should store ONLY the session token (in sessionStorage).
 * Raw API keys are never returned after this call.
 */

import { NextRequest, NextResponse } from "next/server";
import { storeCredentials } from "@/lib/credential-vault";

type StorePayload = {
  venueId?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
};

const SUPPORTED_VENUES = ["binance", "okx", "bybit"];

export async function POST(req: NextRequest) {
  let body: StorePayload;
  try {
    body = (await req.json()) as StorePayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const { venueId, apiKey, apiSecret, passphrase } = body;

  if (!venueId || !SUPPORTED_VENUES.includes(venueId)) {
    return NextResponse.json({ ok: false, message: "Unsupported venue." }, { status: 400 });
  }

  const trimmedKey    = apiKey?.trim()    ?? "";
  const trimmedSecret = apiSecret?.trim() ?? "";

  if (!trimmedKey || !trimmedSecret) {
    return NextResponse.json(
      { ok: false, message: "API key and secret are required." },
      { status: 400 }
    );
  }

  if (venueId === "okx" && !passphrase?.trim()) {
    return NextResponse.json(
      { ok: false, message: "OKX requires a passphrase." },
      { status: 400 }
    );
  }

  const sessionToken = storeCredentials({
    venueId,
    apiKey:     trimmedKey,
    apiSecret:  trimmedSecret,
    passphrase: passphrase?.trim() || undefined,
  });

  return NextResponse.json({ ok: true, sessionToken });
}
