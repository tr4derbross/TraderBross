import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "tb_csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

function normalizeHost(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function extractOriginHost(origin: string) {
  try {
    return normalizeHost(new URL(origin).host);
  } catch {
    return "";
  }
}

function extractRefererHost(referer: string) {
  try {
    return normalizeHost(new URL(referer).host);
  } catch {
    return "";
  }
}

function getRequestHost(request: NextRequest) {
  const trustForwardedHost = String(process.env.TRUST_PROXY_HEADERS || "").toLowerCase() === "true";
  const forwardedHost = trustForwardedHost ? request.headers.get("x-forwarded-host") || "" : "";
  const host = request.headers.get("host") || "";
  return normalizeHost(forwardedHost || host);
}

export function isRequestSameOrigin(request: NextRequest) {
  const method = String(request.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const secFetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "cross-site") return false;

  const origin = request.headers.get("origin") || "";
  if (origin) {
    const originHost = extractOriginHost(origin);
    const requestHost = getRequestHost(request);
    if (!originHost || !requestHost) return false;
    return originHost === requestHost;
  }

  const referer = request.headers.get("referer") || "";
  if (referer) {
    const refererHost = extractRefererHost(referer);
    const requestHost = getRequestHost(request);
    if (!refererHost || !requestHost) return false;
    return refererHost === requestHost;
  }

  // For state-changing requests, require at least Origin or Referer.
  return !isMutation;
}

function generateCsrfToken() {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return randomPart.replace(/-/g, "");
}

export function getCsrfCookieName() {
  return CSRF_COOKIE_NAME;
}

export function getCsrfHeaderName() {
  return CSRF_HEADER_NAME;
}

export function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value || "";
  const token = existing.length >= 16 ? existing : generateCsrfToken();
  if (existing !== token) {
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return token;
}

export function hasValidCsrfToken(request: NextRequest) {
  const method = String(request.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (!isMutation) return true;

  const cookieToken = String(request.cookies.get(CSRF_COOKIE_NAME)?.value || "").trim();
  const headerToken = String(request.headers.get(CSRF_HEADER_NAME) || "").trim();
  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
