#!/usr/bin/env node

/**
 * Security smoke test for backend sensitive routes.
 * Usage:
 *   node scripts/security-smoke-test.mjs
 *   BACKEND_BASE_URL=https://your-backend node scripts/security-smoke-test.mjs
 */

const base = (process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");

function okStatus(status) {
  return [401, 403, 429].includes(status);
}

async function run() {
  const checks = [];

  // Public health should be reachable.
  checks.push(await fetch(`${base}/health`, { method: "GET" }).then((r) => ({
    name: "health endpoint",
    pass: r.ok,
    status: r.status,
    expected: "200",
  })).catch((e) => ({
    name: "health endpoint",
    pass: false,
    status: 0,
    expected: "200",
    error: String(e),
  })));

  // Sensitive routes should never accept direct unauthenticated calls.
  checks.push(await fetch(`${base}/api/vault/store`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venueId: "binance", apiKey: "x", apiSecret: "y" }),
  }).then((r) => ({
    name: "vault/store direct call blocked",
    pass: okStatus(r.status),
    status: r.status,
    expected: "401/403/429",
  })).catch((e) => ({
    name: "vault/store direct call blocked",
    pass: false,
    status: 0,
    expected: "401/403/429",
    error: String(e),
  })));

  checks.push(await fetch(`${base}/api/binance/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "order", symbol: "BTC", side: "long", marginAmount: 20, leverage: 5 }),
  }).then((r) => ({
    name: "binance/order direct call blocked",
    pass: okStatus(r.status),
    status: r.status,
    expected: "401/403/429",
  })).catch((e) => ({
    name: "binance/order direct call blocked",
    pass: false,
    status: 0,
    expected: "401/403/429",
    error: String(e),
  })));

  const failed = checks.filter((c) => !c.pass);

  console.log("\nSecurity Smoke Test:");
  for (const c of checks) {
    const icon = c.pass ? "PASS" : "FAIL";
    console.log(`- [${icon}] ${c.name} (status=${c.status}, expected=${c.expected})${c.error ? ` error=${c.error}` : ""}`);
  }

  if (failed.length > 0) {
    console.error(`\nResult: FAILED (${failed.length}/${checks.length} checks failed)`);
    process.exit(1);
  }

  console.log(`\nResult: OK (${checks.length}/${checks.length} checks passed)`);
}

run();