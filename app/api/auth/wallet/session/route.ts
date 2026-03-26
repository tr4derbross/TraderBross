import { NextRequest, NextResponse } from "next/server";
import {
  getWalletSessionCookieName,
  getWalletSessionIdleTimeoutSeconds,
  getWalletSessionMaxAgeSeconds,
  issueWalletSessionToken,
  verifyWalletSessionToken,
} from "@/lib/wallet-auth";
import { isWalletSessionRevoked } from "@/lib/wallet-session-revocation";
import { getWalletTier } from "@/lib/wallet-subscriptions";

function json(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getWalletSessionCookieName())?.value || "";
  const session = verifyWalletSessionToken(token, request.nextUrl.origin);
  if (!session || (token && await isWalletSessionRevoked(token))) {
    return json({ ok: true, authenticated: false, tier: "free" });
  }

  const tier = await getWalletTier(session.address);
  const response = json({
    ok: true,
    authenticated: true,
    walletAddress: session.address,
    tier: tier.tier,
    tierExpiresAt: tier.expiresAt,
    sessionIdleTimeoutSec: getWalletSessionIdleTimeoutSeconds(),
  });
  const refreshed = issueWalletSessionToken(session.address, request.nextUrl.origin, {
    iat: session.iat,
    jti: session.jti,
    lat: Math.floor(Date.now() / 1000),
  });
  response.cookies.set(getWalletSessionCookieName(), refreshed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: getWalletSessionMaxAgeSeconds(),
  });
  return response;
}
