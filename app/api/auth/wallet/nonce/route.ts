import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  buildWalletSignMessage,
  generateWalletNonce,
  getWalletNonceCookieName,
  getWalletNonceMaxAgeSeconds,
  issueWalletNonceToken,
} from "@/lib/wallet-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isRequestSameOrigin } from "@/lib/request-security";

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

  const ip = getClientIp(request);
  const limit = rateLimit(`wallet-nonce:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return json({ ok: false, error: "Too many requests. Try again shortly." }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const address = String(body?.address || "").trim();
  if (!ethers.isAddress(address)) {
    return json({ ok: false, error: "Invalid wallet address." }, 400);
  }

  const nonce = generateWalletNonce();
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  const issuedAt = new Date().toISOString();
  const message = buildWalletSignMessage(address, nonce, origin, issuedAt);
  const nonceToken = issueWalletNonceToken(address, nonce, issuedAt);

  const response = json({ ok: true, nonce, message });
  response.cookies.set(getWalletNonceCookieName(), nonceToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: getWalletNonceMaxAgeSeconds(),
  });
  return response;
}
