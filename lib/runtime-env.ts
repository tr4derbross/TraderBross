function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const DEFAULT_LOCAL_API = "http://127.0.0.1:4001";
const DEFAULT_LOCAL_WS = "ws://127.0.0.1:4001/ws";
const DEFAULT_PROD_API = "https://traderbross-production.up.railway.app";
const DEFAULT_PROD_WS = "wss://traderbross-production.up.railway.app/ws";

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function looksLikeLocalApiUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return isLocalHost(parsed.hostname);
  } catch {
    return raw.includes("localhost") || raw.includes("127.0.0.1");
  }
}

function assertProductionApiBaseSafety(configuredValue: string) {
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const isHostedProduction =
    isProduction &&
    (
      String(process.env.VERCEL || "") === "1" ||
      String(process.env.RAILWAY_ENVIRONMENT || "").toLowerCase() === "production" ||
      String(process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase() === "production"
    );
  if (!isHostedProduction) return;
  if (looksLikeLocalApiUrl(configuredValue)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL cannot point to localhost/127.0.0.1 in production.",
    );
  }
}

function resolveApiBaseUrl() {
  const configured = trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_LOCAL_API);
  assertProductionApiBaseSafety(configured);
  if (typeof window === "undefined") return configured;
  const host = window.location.hostname;
  const configLooksLocal = configured.includes("127.0.0.1") || configured.includes("localhost");
  if (!isLocalHost(host) && configLooksLocal) {
    return DEFAULT_PROD_API;
  }
  return configured;
}

function resolveWsUrl() {
  const configured = process.env.NEXT_PUBLIC_WS_URL || DEFAULT_LOCAL_WS;
  if (typeof window === "undefined") return configured;
  const host = window.location.hostname;
  const configLooksLocal = configured.includes("127.0.0.1") || configured.includes("localhost");
  if (!isLocalHost(host) && configLooksLocal) {
    return DEFAULT_PROD_WS;
  }
  return configured;
}

export const runtimeEnv = {
  apiBaseUrl: resolveApiBaseUrl(),
  wsUrl: resolveWsUrl(),
};

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;

  const normalized = path.startsWith("/") ? path : `/${path}`;
  // In browser, always use same-origin API proxy routes.
  // This avoids CORS and broken production env mismatches.
  if (typeof window !== "undefined") {
    return normalized;
  }
  return `${runtimeEnv.apiBaseUrl}${normalized}`;
}
