# Staging Acceptance Checklist (Manual Trade Certification)

Use this checklist before every production release that touches execution, wallet connections, or market data routing.

## A. Preflight (Automated)
1. Run:
```bash
npm run build
BACKEND_BASE_URL=https://traderbross-production.up.railway.app npm run ops:health
BACKEND_BASE_URL=https://traderbross-production.up.railway.app npm run security:smoke
FRONTEND_BASE_URL=https://trader-bross.vercel.app BACKEND_BASE_URL=https://traderbross-production.up.railway.app npm run ops:go-live
```
2. Expected:
- All commands pass.
- No empty bootstrap (quotes/news/social).
- Sensitive routes return `401/403/429/405` for direct access.

## B. Exchange Flow Certification (Manual, Staging Keys)

Run the same flow for `Binance`, `OKX`, and `Bybit` with **trade-only, withdrawal-disabled** staging API keys.

1. Connect / save credentials in terminal header.
2. Test connection -> must show `Connected`.
3. Load symbols list from selected venue:
- verify list is not fallback-only and contains long-tail futures pairs.
4. Open one market order:
- low size, isolated mode, leverage 3x-5x.
5. Set TP/SL at order time:
- check both exchange UI and TraderBross UI reflect TP/SL.
6. Update TP/SL from TraderBross:
- confirm update lands on exchange.
7. Partial close:
- close 25% using `Close` flow.
8. Full close:
- close remaining position with `Market Close`.
9. Verify positions, open orders, and balance are consistent with exchange native UI.

Acceptance:
- No `HTTP 5xx`.
- No stale position mismatch > 10 seconds.
- Mark price and notional align with venue values.

## C. Hyperliquid Certification (Manual)
1. Connect wallet + API wallet key flow.
2. Place one small order.
3. Set TP/SL.
4. Close position.
5. Confirm position mirror consistency in TraderBross and Hyperliquid.

Acceptance:
- Signed routing works.
- No silent failures.

## D. News/Social/Whale Freshness
1. Confirm `/api/providers/health`:
- `newsFresh=true` and `socialFresh=true` (or documented degraded state).
2. In terminal:
- new items appear and sort by newest first.
- source links open correctly.
- no empty panel loops or loading lock.

## E. Legal and Trust
1. Terms page accessible and up to date.
2. Privacy page accessible and up to date.
3. In-UI risk copy visible where orders are confirmed.

## F. Release Decision
Release only if:
1. Automated preflight is green.
2. Manual exchange certification is green for all enabled venues.
3. No open P0 defects.

