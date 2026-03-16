import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options",                    value: "DENY" },
  { key: "X-Content-Type-Options",             value: "nosniff" },
  { key: "X-Permitted-Cross-Domain-Policies",  value: "none" },
  { key: "Referrer-Policy",                    value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",                 value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS: 1 year, include subdomains
  { key: "Strict-Transport-Security",          value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "frame-src https://www.tradingview.com https://s.tradingview.com",
      "connect-src 'self' https: wss:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Remove X-Powered-By header to avoid fingerprinting
  poweredByHeader: false,

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
