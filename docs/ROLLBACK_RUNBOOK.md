# Rollback Runbook

## Trigger Conditions
- Failed deployment causes production data outage.
- Exchange/order actions start failing after release.
- Severe regression with no quick safe patch.

## Fast Rollback Steps
1. Identify last known stable commit in `main`.
2. Redeploy backend from that commit.
3. Redeploy frontend from matching stable commit.
4. Verify:
   - `/health` returns `status: ok`
   - `/api/bootstrap` returns non-empty core payload
   - terminal page renders with live/degraded status correctly

## Git Procedure (Non-destructive)
- Prefer `git revert <bad_commit>` over force pushes.
- If multiple commits are involved, revert in reverse order.
- Create a rollback commit message:
  - `Rollback: <reason> (<incident-id/date>)`

## Post-Rollback Validation
- Run `npm run build`
- Run `npm run security:smoke` against backend URL
- Confirm no crash loop in Railway/Vercel logs for 15+ minutes

## Follow-up
- Open hotfix branch from stable state.
- Reintroduce fixes in smaller, testable batches.