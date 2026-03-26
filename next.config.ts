import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const scriptSrc = isProduction ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
const isHostedProduction =
  isProduction &&
  (
    String(process.env.VERCEL || "") === "1" ||
    String(process.env.RAILWAY_ENVIRONMENT || "").toLowerCase() === "production" ||
    String(process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase() === "production"
  );
const DEFAULT_DEV_CONNECT_SRC = [
  "'self'",
  "http://localhost:*",
  "ws://localhost:*",
  "http://127.0.0.1:*",
  "ws://127.0.0.1:*",
];

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function parseCspConnectSrc() {
  const explicit = String(process.env.CSP_CONNECT_SRC || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length > 0) {
    return Array.from(new Set(["'self'", ...explicit]));
  }

  const out = new Set<string>(isProduction ? ["'self'"] : DEFAULT_DEV_CONNECT_SRC);
  const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (supabaseOrigin) {
    out.add(supabaseOrigin);
    if (supabaseOrigin.startsWith("https://")) {
      out.add(supabaseOrigin.replace(/^https:\/\//, "wss://"));
    }
  }
  const apiOrigin = toOrigin(process.env.NEXT_PUBLIC_API_BASE_URL || "");
  if (apiOrigin) out.add(apiOrigin);
  return Array.from(out);
}

function validateProductionConnectSrc(entries: string[]) {
  if (!isHostedProduction) return;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("CSP connect-src must not be empty in production.");
  }
  for (const entry of entries) {
    const value = String(entry || "").trim().toLowerCase();
    if (!value) throw new Error("CSP connect-src contains an empty value in production.");
    if (value === "https:" || value === "wss:" || value === "*") {
      throw new Error("CSP connect-src cannot use wildcard schemes in production.");
    }
    if (value.includes("localhost") || value.includes("127.0.0.1")) {
      throw new Error("CSP connect-src cannot include localhost in production.");
    }
  }
}

const connectSrc = parseCspConnectSrc();
validateProductionConnectSrc(connectSrc);

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
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "frame-src https://www.tradingview.com https://s.tradingview.com",
      `connect-src ${connectSrc.join(" ")}`,
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
