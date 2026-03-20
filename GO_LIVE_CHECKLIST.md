# TraderBross Go-Live Checklist

Date: 2026-03-21
Scope: MVP launch readiness for terminal/news/trading integrations.

## 1) Legal & Compliance
- [x] Terms of Service includes no-investment-advice and liability limitation.
- [x] Privacy Policy includes security and third-party provider disclosures.
- [x] Exchange API key responsibility is explicitly assigned to the user.
- [ ] Final legal review by counsel for target sales region(s).

## 2) Exchange Credential Security
- [x] Raw CEX credentials are not persisted in localStorage.
- [x] Browser stores only short-lived vault session tokens.
- [x] Vault payload storage is encrypted (AES-256-GCM).
- [x] Vault sessions have TTL and max-entry cleanup.
- [x] Sensitive endpoints reject non-proxy traffic.
- [x] Sensitive endpoints are rate-limited.
- [x] Frontend CEX execution path requires vault token (raw-key fallback removed).
- [ ] Enforce API permission linting per exchange (read/trade only, no withdrawal) via automated checks.

## 3) Runtime Security Configuration
- [x] Proxy shared-secret support implemented (Next proxy -> backend).
- [x] Backend fails fast if proxy auth is required but secret is missing.
- [x] Production warning if VAULT_ENCRYPTION_KEY is missing.
- [ ] Secret rotation SOP documented (PROXY_SHARED_SECRET + VAULT_ENCRYPTION_KEY).

## 4) Abuse & Reliability Controls
- [x] Sensitive route request throttling in backend.
- [x] Input validation for trading actions (symbol/side/margin/leverage).
- [x] Sanitized user-facing error messages on exchange failures.
- [ ] Add WAF/bot rules at edge (Cloudflare/Vercel protection profile).

## 5) Product Transparency (User Trust)
- [x] News panel includes informational-only label.
- [x] Order confirmation includes execution risk + non-advice note.
- [x] Connection-state architecture supports degraded/live modes.
- [ ] Add explicit status badge in all modules (live/loading/stale/degraded/disconnected parity check).

## 6) Operations
- [x] Health endpoint exists for backend dependency checks.
- [x] Build and type checks pass after hardening changes.
- [ ] Alerting integration (uptime, error rate, websocket disconnect spikes).
- [ ] Incident runbook + rollback runbook written in repo.

## 7) Pre-Launch Test Gate
- [ ] End-to-end test pass on staging (connect, save keys, validate, place, close, TP/SL).
- [ ] Load test for sensitive endpoints and websocket concurrency.
- [ ] Manual security smoke test (direct backend calls to sensitive routes should fail).

## Minimum Required Before Paid Launch
1. Set `PROXY_SHARED_SECRET` and `VAULT_ENCRYPTION_KEY` in production.
2. Complete legal review and publish final legal texts.
3. Run staging E2E + security smoke tests and archive results.
4. Enable monitoring + alerting and verify incident response flow.
