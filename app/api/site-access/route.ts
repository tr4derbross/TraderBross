import { NextRequest, NextResponse } from "next/server";
import {
  getSiteAccessCookieName,
  isSiteAccessPasswordMatch,
  isSiteAccessEnabled,
  issueSiteAccessToken,
  shouldUnlockAllTiersInPrivateMode,
  verifySiteAccessToken,
} from "@/lib/site-access";
import { getClientIp } from "@/lib/rate-limit";
import { hasValidCsrfToken, isRequestSameOrigin } from "@/lib/request-security";

const ACCESS_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_MAX_ATTEMPTS = 8;
const ACCESS_LOCK_MS = 15 * 60 * 1000; // 15 minutes
const accessAttempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function responseJson(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getAttemptState(ip: string, now: number) {
  const current = accessAttempts.get(ip);
  if (!current) return { count: 0, firstAt: now, lockedUntil: 0 };
  if (current.lockedUntil > now) return current;
  if (now - current.firstAt > ACCESS_WINDOW_MS) return { count: 0, firstAt: now, lockedUntil: 0 };
  return current;
}

function registerFailedAttempt(ip: string, now: number) {
  const current = getAttemptState(ip, now);
  const nextCount = current.count + 1;
  const lockedUntil = nextCount >= ACCESS_MAX_ATTEMPTS ? now + ACCESS_LOCK_MS : 0;
  accessAttempts.set(ip, {
    count: nextCount,
    firstAt: current.firstAt || now,
    lockedUntil,
  });
  return { nextCount, lockedUntil };
}

function clearAttemptState(ip: string) {
  accessAttempts.delete(ip);
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

  const now = Date.now();
  const ip = getClientIp(request);
  const state = getAttemptState(ip, now);
  if (state.lockedUntil > now) {
    const retryAfterSec = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
    return responseJson(
      { ok: false, error: "Too many attempts. Please try again later.", retryAfterSec },
      429,
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || "");

  if (!isSiteAccessPasswordMatch(password)) {
    const attempt = registerFailedAttempt(ip, now);
    const retryAfterSec =
      attempt.lockedUntil > now ? Math.max(1, Math.ceil((attempt.lockedUntil - now) / 1000)) : 0;
    return responseJson({ ok: false, error: "Invalid access password.", retryAfterSec }, 401);
  }

  clearAttemptState(ip);

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
