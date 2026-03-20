# Secret Rotation SOP

## Scope
- `PROXY_SHARED_SECRET`
- `VAULT_ENCRYPTION_KEY`

## Rotation Frequency
- Recommended: every 90 days or immediately after suspected exposure.

## Procedure
1. Generate new secure values (32+ random chars for proxy secret, 32-byte key for vault encryption).
2. Update secrets in deployment platform (Railway/Vercel/host).
3. Deploy backend with new values.
4. Verify:
   - `GET /health` returns ok
   - sensitive direct backend calls are blocked
5. Invalidate active sessions if required by incident policy.

## Notes
- Rotating `VAULT_ENCRYPTION_KEY` invalidates existing vault sessions by design.
- Announce maintenance window if user re-authentication is expected.