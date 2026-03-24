import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import {
  getSiteAccessCookieName,
  isSiteAccessEnabled,
  verifySiteAccessToken,
} from "@/lib/site-access";

const PUBLIC_PATH_PREFIXES = [
  "/access",
  "/api/site-access",
  "/_next",
  "/favicon.ico",
];

export async function proxy(request: NextRequest) {
  if (isSiteAccessEnabled()) {
    const pathname = request.nextUrl.pathname;
    const isPublicPath = PUBLIC_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!isPublicPath) {
      const token = request.cookies.get(getSiteAccessCookieName())?.value || "";
      const hasAccess = await verifySiteAccessToken(token);
      if (!hasAccess) {
        const redirectUrl = new URL("/access", request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
