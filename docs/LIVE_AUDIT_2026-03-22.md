# Live Audit Report (2026-03-22)

Generated at: 2026-03-22 13:12:49 +03:00

## Scope

- Supabase auth + schema integration
- Upstash hot-route cache (`/api/bootstrap`, `/api/news`, `/api/prices`)
- AI provider fallback chain (`Groq -> Gemini -> OpenRouter(:free) -> Mock`)
- Exchange announcement ingestion (Binance, Bybit, OKX)
- Client-side encrypted local credential backup (AES-GCM) + existing server vault flow

## Validation Runbook

Commands executed:

```bash
npm run build
$env:BACKEND_BASE_URL='https://traderbross-production.up.railway.app'; npm run ops:health
$env:BACKEND_BASE_URL='https://traderbross-production.up.railway.app'; npm run security:smoke
$env:FRONTEND_BASE_URL='https://trader-bross.vercel.app'; $env:BACKEND_BASE_URL='https://traderbross-production.up.railway.app'; npm run ops:go-live
```

## Results

- Build: PASS
- Ops health: PASS (`health=ok connectionState=connected`)
- Security smoke: PASS (3/3)
  - Direct access to sensitive routes blocked (`403`)
- Staging go-live preflight: PASS (14/14)
  - Frontend pages reachable
  - CSP check passed (`unsafe-eval` absent)
  - Backend health/provider status passed
  - News freshness available
  - Bootstrap has core data and news data

## Notes

- `ops:go-live` had one transient timeout on first run; immediate rerun passed fully.
- AI is configured with quota guards and fallback behavior to prevent hard outages on provider errors/quota events.
- Execution path remains server-vault-first (no downgrade to unsafe raw-key browser execution).
