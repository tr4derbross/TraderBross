#!/usr/bin/env node

const frontendBase = (process.env.FRONTEND_BASE_URL || "https://trader-bross.vercel.app").replace(/\/+$/, "");
const backendBase = (process.env.BACKEND_BASE_URL || "https://traderbross-production.up.railway.app").replace(/\/+$/, "");

async function fetchText(url, timeoutMs = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  return { res, text };
}

async function fetchJson(url, timeoutMs = 15000) {
  const { res, text } = await fetchText(url, timeoutMs);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { res, json, text };
}

function check(label, pass, detail) {
  return { label, pass: Boolean(pass), detail: detail || "" };
}

async function run() {
  const checks = [];

  // 1) Frontend availability
  const home = await fetchText(`${frontendBase}/`);
  checks.push(check("Frontend home reachable", home.res.ok, `status=${home.res.status}`));

  const terminal = await fetchText(`${frontendBase}/terminal`);
  checks.push(check("Frontend terminal reachable", terminal.res.ok, `status=${terminal.res.status}`));

  // 2) Security headers on frontend
  const csp = home.res.headers.get("content-security-policy") || "";
  checks.push(
    check(
      "CSP blocks unsafe-eval",
      !csp.includes("unsafe-eval"),
      csp ? "unsafe-eval not present" : "no csp header",
    ),
  );

  // 3) Legal pages reachable
  const terms = await fetchText(`${frontendBase}/terms`);
  const privacy = await fetchText(`${frontendBase}/privacy`);
  checks.push(check("Terms page reachable", terms.res.ok, `status=${terms.res.status}`));
  checks.push(check("Privacy page reachable", privacy.res.ok, `status=${privacy.res.status}`));
  checks.push(
    check(
      "Terms has risk disclosure",
      /No Financial Advice|Risk Disclosure/i.test(terms.text),
      "keyword scan",
    ),
  );

  // 4) Backend core health
  const health = await fetchJson(`${backendBase}/health`);
  checks.push(check("Backend health endpoint reachable", health.res.ok, `status=${health.res.status}`));
  checks.push(check("Backend health payload status", health.json?.status === "ok", `status=${health.json?.status || "n/a"}`));

  // 5) Provider status + freshness
  const providers = await fetchJson(`${backendBase}/api/providers/health`);
  checks.push(check("Provider health endpoint reachable", providers.res.ok, `status=${providers.res.status}`));
  checks.push(
    check(
      "Provider connection state healthy",
      ["connected", "degraded"].includes(String(providers.json?.connectionState || "")),
      `connectionState=${providers.json?.connectionState || "unknown"}`,
    ),
  );
  checks.push(
    check(
      "News freshness available",
      typeof providers.json?.freshness?.newsFresh === "boolean",
      `newsFresh=${providers.json?.freshness?.newsFresh}`,
    ),
  );

  // 6) Sensitive routes blocked for direct access
  const blocked1 = await fetchJson(`${backendBase}/api/vault/store`, 15000).catch(() => ({ res: { status: 0 } }));
  checks.push(
    check(
      "Sensitive route /api/vault/store blocked direct",
      [401, 403, 405, 429].includes(Number(blocked1.res.status || 0)),
      `status=${blocked1.res.status || 0}`,
    ),
  );

  // 7) Snapshot quality
  const bootstrap = await fetchJson(`${frontendBase}/api/bootstrap?mode=lite`);
  checks.push(
    check(
      "Bootstrap has core data",
      Array.isArray(bootstrap.json?.quotes) && bootstrap.json.quotes.length > 0,
      `quotes=${bootstrap.json?.quotes?.length ?? 0}`,
    ),
  );
  checks.push(
    check(
      "Bootstrap has news data",
      Array.isArray(bootstrap.json?.news) && bootstrap.json.news.length > 0,
      `news=${bootstrap.json?.news?.length ?? 0}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);

  console.log("\nStaging Go-Live Preflight");
  for (const c of checks) {
    const icon = c.pass ? "PASS" : "FAIL";
    console.log(`- [${icon}] ${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  }

  if (failed.length > 0) {
    console.error(`\nResult: FAILED (${failed.length}/${checks.length} checks failed)`);
    process.exit(1);
  }

  console.log(`\nResult: OK (${checks.length}/${checks.length} checks passed)`);
}

run().catch((error) => {
  console.error(`staging go-live check exception: ${String(error)}`);
  process.exit(1);
});

