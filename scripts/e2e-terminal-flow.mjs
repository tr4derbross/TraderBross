#!/usr/bin/env node

const preferredBase = (process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const fallbackBase = "https://trader-bross.vercel.app";
let activeBase = preferredBase;

async function getJson(path) {
  const res = await fetch(`${activeBase}${path}`, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const checks = [];
  try {
    await getJson("/api/health");
  } catch {
    if (!process.env.FRONTEND_BASE_URL && preferredBase !== fallbackBase) {
      activeBase = fallbackBase;
      await getJson("/api/health");
    } else {
      throw new Error(`Frontend not reachable at ${preferredBase}. Set FRONTEND_BASE_URL.`);
    }
  }

  const bootstrap = await getJson("/api/bootstrap?mode=lite");
  assert(Array.isArray(bootstrap.quotes) && bootstrap.quotes.length > 0, "bootstrap quotes empty");
  assert(Array.isArray(bootstrap.news) && bootstrap.news.length > 0, "bootstrap news empty");
  checks.push("bootstrap");

  const health = await getJson("/api/health");
  assert(health?.status === "ok" || health?.status === "degraded", "health payload invalid");
  checks.push("health");

  const venues = ["binance", "okx", "bybit"];
  for (const venue of venues) {
    const symbols = await getJson(`/api/venues/symbols?venue=${venue}&quote=USDT`);
    assert(Array.isArray(symbols) && symbols.length >= 10, `${venue} symbols too low`);
    checks.push(`symbols:${venue}`);
  }

  const prices = await getJson("/api/prices?type=quotes&limit=12");
  assert(Array.isArray(prices) && prices.length > 0, "quotes empty");
  checks.push("quotes");

  console.log(`E2E terminal flow OK on ${activeBase} (${checks.length} checks): ${checks.join(", ")}`);
}

run().catch((error) => {
  console.error(`E2E terminal flow failed: ${String(error)}`);
  process.exit(1);
});
