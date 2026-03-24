import { NextRequest, NextResponse } from "next/server";
import {
  getSiteAccessCookieName,
  getSiteAccessPassword,
  isSiteAccessEnabled,
  issueSiteAccessToken,
  shouldUnlockAllTiersInPrivateMode,
  verifySiteAccessToken,
} from "@/lib/site-access";

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
  if (!isSiteAccessEnabled()) {
    return responseJson({ ok: true, bypass: true });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || "");

  if (password !== getSiteAccessPassword()) {
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

export async function DELETE() {
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
