import { NextRequest, NextResponse } from "next/server";
import {
  getSiteAccessCookieName,
  isSiteAccessPasswordMatch,
  isSiteAccessEnabled,
  issueSiteAccessToken,
  shouldUnlockAllTiersInPrivateMode,
  verifySiteAccessToken,
} from "@/lib/site-access";
import { getClientIp, rateLimitAsync } from "@/lib/rate-limit";
import { hasValidCsrfToken, isRequestSameOrigin } from "@/lib/request-security";

const ACCESS_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_MAX_ATTEMPTS = 8;

function responseJson(payload: unknown, status = 200) {
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
    return responseJson({ ok: false, error: "Origin mismatch." }, 403);
  }
  if (!hasValidCsrfToken(request)) {
    return responseJson({ ok: false, error: "Missing or invalid CSRF token." }, 403);
  }

  if (!isSiteAccessEnabled()) {
    return responseJson({ ok: true, bypass: true });
  }

  const ip = getClientIp(request);
  const limiter = await rateLimitAsync(`site-access:${ip}`, ACCESS_MAX_ATTEMPTS, ACCESS_WINDOW_MS);
  if (!limiter.allowed) {
    return responseJson({ ok: false, error: "Too many attempts. Please try again later." }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || "");

  if (!isSiteAccessPasswordMatch(password)) {
    return responseJson({ ok: false, error: "Invalid access password." }, 401);
  }

  const token = await issueSiteAccessToken();
  const response = responseJson({ ok: true });
  response.cookies.set(getSiteAccessCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const enabled = isSiteAccessEnabled();
  if (!enabled) {
    return responseJson({ ok: true, enabled: false, unlockAllTiers: false });
  }
  const token = request.cookies.get(getSiteAccessCookieName())?.value || "";
  const hasAccess = await verifySiteAccessToken(token);
  return responseJson({
    ok: true,
    enabled: true,
    hasAccess,
    unlockAllTiers: hasAccess && shouldUnlockAllTiersInPrivateMode(),
  });
}

export async function DELETE(request: NextRequest) {
  if (!isRequestSameOrigin(request)) {
    return responseJson({ ok: false, error: "Origin mismatch." }, 403);
  }
  if (!hasValidCsrfToken(request)) {
    return responseJson({ ok: false, error: "Missing or invalid CSRF token." }, 403);
  }

  const response = responseJson({ ok: true });
  response.cookies.set(getSiteAccessCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
