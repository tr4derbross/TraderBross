# Live Readiness Audit (2026-03-20)

## Scope
- Full codebase pass for production readiness
- News pipeline deep-check
- External API call audit
- Dead/unused code cleanup

## What Was Fixed Now
- Removed unused frontend/backend files that were no longer referenced.
- Replaced broken JSON news defaults with a working free JSON source.
- Preserved existing backend-first data architecture and snapshot+WS flow.

## Critical News Finding
- Previous JSON news setup was effectively dead in free mode:
  - `min-api.cryptocompare.com/data/v2/news` now requires a valid API key.
  - `cryptopanic.com/api/v1/posts` returned 404 in current keyless/default flow.
- Result: JSON adapter could silently contribute `0` items unless other adapters filled news.

## News Engine Changes
- `backend/data/adapters/news-json.adapter.mjs`
  - Added Blockchair News JSON ingestion (`https://api.blockchair.com/news`).
  - Kept CryptoCompare optional (`CRYPTOCOMPARE_API_KEY` or `CRYPTOCOMPARE_KEY`).
  - Kept CryptoPanic optional only when key is provided (avoid free-tier waste).
  - Added safer timestamp parsing for JSON rows.
- `backend/data/terminal-data-service.mjs`
  - Wired `cryptocompareApiKey` into JSON adapter call.
- `backend/config.mjs`
  - Added `cryptocompareApiKey` config support for:
    - `CRYPTOCOMPARE_API_KEY`
    - `CRYPTOCOMPARE_KEY` (backward-compatible alias)

## Dead Code Cleanup
Removed unreferenced files to reduce confusion and maintenance risk:
- `backend/services/news-service.mjs`
- `components/EmptyState.tsx`
- `components/LivePricesBadge.tsx`
- `components/SiteNav.tsx`
- `components/TerminalMvpApp.tsx`
- `components/TickerTape.tsx`
- `components/VenuesPanel.tsx`
- `components/ui/StatusDot.tsx`
- `components/ui/TbBadge.tsx`
- `hooks/useCoinCap.ts`
- `hooks/useTrending.ts`
- `lib/ai-providers.ts`
- `lib/binance-liquidation-ws.ts`
- `lib/credential-vault.ts`
- `lib/server-cache.ts`
- `lib/telegram-scraper.ts`

## External API Audit (Current Code Paths)
### Core market
- CoinGecko
- CoinCap (fallback)
- Coinpaprika (fallback)
- Coinlore (fallback)
- Hyperliquid WS
- DexScreener

### News/Social
- RSS: Cointelegraph, CoinDesk, Decrypt, The Block
- Tree of Alpha (`/api/news`, optional WS with key)
- Blockchair News JSON
- Reddit RSS feeds
- Optional Nitter RSS feeds

### On-chain / whales / events
- Whale Alert API (optional paid key)
- Binance large-trade fallback

## Live Validation After Changes
- Frontend build: success (`next build`)
- Data-service runtime snapshot test: success
  - quotes: populated
  - news: populated
  - social: populated
  - provider states: healthy (`ok` for core providers)

## Deployment Risk Notes Before Mainnet-Style Launch
- Wallet connect + exchange order APIs need a dedicated security hardening pass next:
  - key scopes, rotation, revocation UX
  - per-venue permission validation
  - stricter vault/session lifecycle
  - signed request audit logs
- For legal/compliance safety:
  - keep source attribution links in UI
  - follow source ToS and robots/publisher policies
  - avoid scraping private/non-public endpoints

## Recommended Next Phase
1. Wallet connection security hardening checklist and implementation.
2. Exchange-by-exchange integration certification (Binance, OKX, Bybit, Hyperliquid, dYdX).
3. Production observability panel (provider errors, stale windows, reconnect metrics).
4. Canary deploy + synthetic monitoring on `/api/bootstrap`, `/api/news/snapshot`, `/ws`.
