function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const runtimeEnv = {
  apiBaseUrl: trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4001"),
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:4001/ws",
};

/**
 * Build the full URL for an API path.
 *
 * Strategy:
 *  - Absolute URLs  → returned as-is
 *  - In the browser, when apiBaseUrl points to localhost (no Railway URL
 *    configured in NEXT_PUBLIC_API_BASE_URL) → use a relative path so that
 *    Next.js API routes on Vercel/local-dev-server handle the request.
 *  - Otherwise (Railway URL explicitly configured) → prefix with apiBaseUrl
 *    so the backend handles it.
 */
export function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;

  const normalized = path.startsWith("/") ? path : `/${path}`;

  // In the browser: fall back to relative URLs when apiBaseUrl is localhost.
  // This makes chart data, OKX/Bybit/Hyperliquid routes work on Vercel
  // even when NEXT_PUBLIC_API_BASE_URL is not set to a Railway URL.
  if (typeof window !== "undefined") {
    const base = runtimeEnv.apiBaseUrl;
    if (base.includes("127.0.0.1") || base.includes("localhost")) {
      return normalized;
    }
  }

  return `${runtimeEnv.apiBaseUrl}${normalized}`;
}
