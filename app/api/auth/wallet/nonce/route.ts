import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  buildWalletSignMessage,
  generateWalletNonce,
  getWalletNonceCookieName,
  getWalletNonceMaxAgeSeconds,
  issueWalletNonceToken,
} from "@/lib/wallet-auth";

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
    sameSite: "lax",
    path: "/",
    maxAge: getWalletNonceMaxAgeSeconds(),
  });
  return response;
}
