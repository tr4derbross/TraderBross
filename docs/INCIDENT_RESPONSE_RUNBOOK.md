# Incident Response Runbook

## Scope
Use this runbook when live users report broken data, failed exchange actions, or platform instability.

## Severity Levels
- SEV-1: Exchange order flow broken, major outage, severe data corruption.
- SEV-2: Partial degradation (news/whales stale, websocket unstable, high error spikes).
- SEV-3: Minor bug with workaround.

## First 10 Minutes
1. Confirm incident in logs and health endpoints:
   - `GET /health`
   - `GET /api/providers/health`
2. Verify frontend status on production URL.
3. Freeze risky changes (no direct hotfix pushes without branch/PR notes).
4. Communicate short status update to users/internal channel.

## Diagnosis Checklist
- Backend reachable and not crash-looping.
- Sensitive route responses expected (`401/403/429` on unauthorized direct calls).
- WS client count and reconnect patterns normal.
- Provider health states and freshness windows are acceptable.
- Exchange-specific failures isolated (Binance vs others).

## Mitigation Actions
- Disable expensive/unstable providers via feature flags.
- Restart backend process if memory or transient failures are detected.
- Switch to fallback mode for non-critical feeds.
- Temporarily hide non-functional UI module if trust is impacted.

## Communication Template
- What is affected.
- What still works.
- ETA for next update (15-30 min window).
- Temporary workaround if available.

## Recovery Verification
- `npm run ops:health` passes.
- Critical flows tested:
  - snapshot + websocket live mode
  - news feed freshness
  - one exchange validation path
- No active crash loop for at least 15 minutes.

## Postmortem (Within 24h)
- Root cause
- Impact window
- Detection gap
- Permanent fixes
- Owner and due date