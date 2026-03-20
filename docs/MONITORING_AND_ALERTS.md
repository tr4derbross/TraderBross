# Monitoring and Alerts Setup

## Minimum Signals
1. Backend uptime (`/health`) every 1 minute.
2. Provider health (`/api/providers/health`) every 2-5 minutes.
3. Error-rate alert from backend logs (warn/error spikes).
4. Frontend availability (Vercel status + synthetic browser check).

## Suggested Thresholds
- Uptime check failed 2 times in a row -> alert.
- `connectionState` not `connected` for > 5 minutes -> warning.
- Backend restart count spike in Railway -> alert.
- WS disconnect/reconnect storm in client logs -> warning.

## Railway
- Enable deployment + runtime failure alerts.
- Set env vars securely (never in repo):
  - `PROXY_SHARED_SECRET`
  - `VAULT_ENCRYPTION_KEY`
- Keep restart policy enabled.

## Vercel
- Keep production protection and project alerts enabled.
- Use same-origin `/api/[...path]` proxy flow only.

## Operational Commands
- `npm run ops:health`
- `npm run security:smoke` (with `BACKEND_BASE_URL`)

## Example (local)
```bash
BACKEND_BASE_URL=http://127.0.0.1:4001 npm run ops:health
BACKEND_BASE_URL=http://127.0.0.1:4001 npm run security:smoke
```