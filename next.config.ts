import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      [
        "connect-src 'self'",
        "wss://stream.binance.com:9443",
        "wss://stream.binance.com:443",
        "https://api.binance.com",
        "wss://ws.okx.com:8443",
        "https://www.okx.com",
        "wss://stream.bybit.com",
        "https://api.bybit.com",
        "wss://api.hyperliquid.xyz",
        "https://api.hyperliquid.xyz",
        "wss://indexer.dydx.trade",
        "https://indexer.dydx.trade",
        "https://api.alternative.me",
        "https://api.coingecko.com",
      ].join(" "),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
