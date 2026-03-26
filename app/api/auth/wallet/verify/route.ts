import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  buildWalletSignMessage,
  getWalletNonceCookieName,
  getWalletSessionCookieName,
  getWalletSessionMaxAgeSeconds,
  issueWalletSessionToken,
  verifyWalletNonceToken,
} from "@/lib/wallet-auth";
import { consumeWalletNonceOnce } from "@/lib/wallet-nonce-store";
import { getWalletTier } from "@/lib/wallet-subscriptions";
import { getClientIp, rateLimitAsync } from "@/lib/rate-limit";
import { hasValidCsrfToken, isRequestSameOrigin } from "@/lib/request-security";

function json(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request)) {
    return json({ ok: false, error: "Origin mismatch." }, 403);
  }
  if (!hasValidCsrfToken(request)) {
    return json({ ok: false, error: "Missing or invalid CSRF token." }, 403);
  }

  const ip = getClientIp(request);
  const limit = await rateLimitAsync(`wallet-verify:${ip}`, 20, 60_000);
  if (!limit.allowed) {
    return json({ ok: false, error: "Too many verification attempts. Please wait." }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const address = String(body?.address || "").trim();
  const signature = String(body?.signature || "").trim();
  const message = String(body?.message || "");
  if (!ethers.isAddress(address)) {
    return json({ ok: false, error: "Invalid wallet address." }, 400);
  }
  if (!signature || !message) {
    return json({ ok: false, error: "Missing signature or message." }, 400);
  }

  const nonceCookie = request.cookies.get(getWalletNonceCookieName())?.value || "";
  const noncePayload = verifyWalletNonceToken(nonceCookie);
  if (!noncePayload) {
    return json({ ok: false, error: "Nonce expired. Request a new nonce." }, 401);
  }

  const normalizedAddress = address.toLowerCase();
  if (noncePayload.address !== normalizedAddress) {
    return json({ ok: false, error: "Nonce address mismatch." }, 401);
  }
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  const expectedMessage = buildWalletSignMessage(address, noncePayload.nonce, origin, noncePayload.issuedAt);
  if (message.trim() !== expectedMessage.trim()) {
    return json({ ok: false, error: "Signed message mismatch." }, 401);
  }

  let recovered = "";
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
  } catch {
    return json({ ok: false, error: "Signature verification failed." }, 401);
  }
  if (recovered !== normalizedAddress) {
    return json({ ok: false, error: "Signer address mismatch." }, 401);
  }
  const nonceAccepted = await consumeWalletNonceOnce({
    address: normalizedAddress,
    nonce: noncePayload.nonce,
    issuedAt: noncePayload.issuedAt,
  });
  if (!nonceAccepted) {
    return json({ ok: false, error: "Nonce already used. Request a new nonce." }, 401);
  }

  const sessionToken = issueWalletSessionToken(address);
  const tier = await getWalletTier(address);
  const response = json({
    ok: true,
    walletAddress: normalizedAddress,
    tier: tier.tier,
    tierExpiresAt: tier.expiresAt,
  });
  response.cookies.set(getWalletSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: getWalletSessionMaxAgeSeconds(),
  });
  response.cookies.set(getWalletNonceCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
