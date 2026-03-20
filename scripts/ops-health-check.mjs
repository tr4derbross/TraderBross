#!/usr/bin/env node

/**
 * Operational health checker.
 * Exits with non-zero status if core backend health is not OK.
 */

const base = (process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");

async function run() {
  const healthRes = await fetch(`${base}/health`).catch((e) => ({ ok: false, status: 0, _error: String(e) }));
  if (!healthRes.ok) {
    console.error(`health check failed: status=${healthRes.status || 0}`);
    process.exit(1);
  }

  const health = await healthRes.json().catch(() => null);
  if (!health || health.status !== "ok") {
    console.error("health payload invalid or status != ok");
    process.exit(1);
  }

  const providerRes = await fetch(`${base}/api/providers/health`).catch((e) => ({ ok: false, status: 0, _error: String(e) }));
  if (!providerRes.ok) {
    console.error(`provider health failed: status=${providerRes.status || 0}`);
    process.exit(1);
  }

  const provider = await providerRes.json().catch(() => null);
  const state = provider?.connectionState || "unknown";

  console.log(`health=ok connectionState=${state}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(`health check exception: ${String(e)}`);
  process.exit(1);
});