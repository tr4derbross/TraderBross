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
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type StorePayload = {
  venueId?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  /** Hyperliquid: API wallet private key (stored as apiKey in vault) */
  privateKey?: string;
  /** Hyperliquid: wallet address (stored as apiSecret in vault) */
  walletAddress?: string;
};

const SUPPORTED_VENUES = ["binance", "okx", "bybit", "hyperliquid"];

/** Ethereum private key: 0x + 64 hex chars */
const HL_PRIVATE_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 stores per minute per IP ─────────────────────────────────
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`vault-store:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  // ── CSRF: only accept same-origin requests (JSON body + Origin check) ───────
  const origin = req.headers.get("origin");
  const host   = req.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
    }
  }

  let body: StorePayload;
  try {
    body = (await req.json()) as StorePayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const { venueId, apiKey, apiSecret, passphrase, privateKey, walletAddress } = body;

  if (!venueId || !SUPPORTED_VENUES.includes(venueId)) {
    return NextResponse.json({ ok: false, message: "Unsupported venue." }, { status: 400 });
  }

  // ── Hyperliquid: validate EVM private key format ────────────────────────────
  if (venueId === "hyperliquid") {
    const trimmedKey = privateKey?.trim() ?? "";
    if (!trimmedKey) {
      return NextResponse.json(
        { ok: false, message: "Private key is required for Hyperliquid." },
        { status: 400 },
      );
    }

    if (!HL_PRIVATE_KEY_RE.test(trimmedKey)) {
      return NextResponse.json(
        { ok: false, message: "Invalid private key format. Expected 64-character hex string." },
        { status: 400 },
      );
    }

    const sessionToken = storeCredentials({
      venueId,
      apiKey:    trimmedKey,
      apiSecret: walletAddress?.trim() ?? "",
    });

    return NextResponse.json({ ok: true, sessionToken });
  }

  // ── CEX venues ──────────────────────────────────────────────────────────────
  const trimmedKey    = apiKey?.trim()    ?? "";
  const trimmedSecret = apiSecret?.trim() ?? "";

  if (!trimmedKey || !trimmedSecret) {
    return NextResponse.json(
      { ok: false, message: "API key and secret are required." },
      { status: 400 },
    );
  }

  if (trimmedKey.length > 256 || trimmedSecret.length > 256) {
    return NextResponse.json(
      { ok: false, message: "Credential fields exceed maximum length." },
      { status: 400 },
    );
  }

  if (venueId === "okx" && !passphrase?.trim()) {
    return NextResponse.json(
      { ok: false, message: "OKX requires a passphrase." },
      { status: 400 },
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
