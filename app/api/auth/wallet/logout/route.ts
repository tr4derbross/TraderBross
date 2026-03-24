import { NextRequest, NextResponse } from "next/server";
import { getWalletSessionCookieName } from "@/lib/wallet-auth";
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
  const limit = rateLimit(`wallet-logout:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return json({ ok: false, error: "Too many logout requests. Please wait." }, 429);
  }

  const response = json({ ok: true });
  response.cookies.set(getWalletSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
