import { NextRequest, NextResponse } from "next/server";
import { getWalletSessionCookieName } from "@/lib/wallet-auth";
import { revokeWalletSessionToken } from "@/lib/wallet-session-revocation";
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
  const limit = await rateLimitAsync(`wallet-logout:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return json({ ok: false, error: "Too many logout requests. Please wait." }, 429);
  }

  const existingToken = request.cookies.get(getWalletSessionCookieName())?.value || "";
  if (existingToken) {
    await revokeWalletSessionToken(existingToken);
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
