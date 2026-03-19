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

function resolveApiBaseUrl() {
  const configured = trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_LOCAL_API);
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
  return `${runtimeEnv.apiBaseUrl}${normalized}`;
}
