import { NextRequest } from "next/server";

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

function getRequestHost(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host") || "";
  const host = request.headers.get("host") || "";
  return normalizeHost(forwardedHost || host);
}

export function isRequestSameOrigin(request: NextRequest) {
  const secFetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "cross-site") return false;

  const origin = request.headers.get("origin") || "";
  if (!origin) return true;

  const originHost = extractOriginHost(origin);
  const requestHost = getRequestHost(request);
  if (!originHost || !requestHost) return false;
  return originHost === requestHost;
}
