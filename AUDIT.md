# TraderBross Terminal — Full Audit Report
> Generated: 2026-03-18 | Auditor: TraderBross AI Senior Engineer

---

## 1. ENV KEYS — Referenced vs Defined

### Frontend (`NEXT_PUBLIC_*` → Vercel env)
| Key | Referenced In | Status |
|-----|---------------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `lib/runtime-env.ts` | **MISSING** — falls back to `http://127.0.0.1:4001` (localhost only) |
| `NEXT_PUBLIC_WS_URL` | `lib/runtime-env.ts` | **MISSING** — falls back to `ws://127.0.0.1:4001/ws` (localhost only) |
| `ANTHROPIC_API_KEY` | `lib/ai-providers.ts` | **MISSING** — falls to mock provider, AI returns "No AI key configured" |
| `GROQ_API_KEY` | `lib/ai-providers.ts` | **MISSING** — optional fallback |
| `GEMINI_API_KEY` | `lib/ai-providers.ts` | **MISSING** — optional fallback |
| `GNEWS_API_KEY` | `lib/news-service.ts` | **MISSING** — fetchGNews returns `[]` without it |
| `CRYPTOPANIC_KEY` | `lib/news-service.ts` | **MISSING** — fetchCryptoPanicNews returns `[]` without it |
| `CRYPTOCOMPARE_KEY` | `lib/news-service.ts` | **MISSING** — fetchCryptoCompareNews returns `[]` without it |
| `COINMARKETCAL_API_KEY` | `app/api/calendar/route.ts` | Optional — falls back to 12 placeholder events |
| `NEXT_PUBLIC_BINANCE_REF` | `app/screener/page.tsx` | Optional — affiliate ref link |

> **CRITICAL**: Without API keys, `/api/news` route returns MOCK_NEWS only. All 3 news sources in `lib/news-service.ts` guard-return `[]` with no key.

### Backend (`process.env.*` → Railway env)
| Key | Referenced In | Required? |
|-----|---------------|-----------|
| `API_HOST` | `backend/config.mjs` | Optional (default: `0.0.0.0`) |
| `PORT` / `API_PORT` | `backend/config.mjs` | Optional (default: `4001`) |
| `LOG_LEVEL` | `backend/config.mjs` | Optional (default: `info`) |
| `CORS_ORIGINS` | `backend/config.mjs` | **Required** for production CORS |
| `CRYPTOPANIC_KEY` | `backend/services/news-service.mjs` | Optional — works without |
| `WHALE_ALERT_KEY` | `backend/services/news-service.mjs` | Optional — falls to mock whales |
| `ANTHROPIC_API_KEY` | `backend/services/ai-service.mjs` | Optional — AI chat |
| `GROQ_API_KEY` | `backend/services/ai-service.mjs` | Optional — fallback AI |
| `GEMINI_API_KEY` | `backend/services/ai-service.mjs` | Optional — fallback AI |
| `OKX_API_KEY/SECRET/PASSPHRASE` | `backend/config.mjs` | Optional — trading only |
| `BYBIT_API_KEY/SECRET` | `backend/config.mjs` | Optional — trading only |
| `ETHERSCAN_API_KEY` | `backend/services/stats-service.mjs` | Optional — ETH gas fallback |
| `SOCIAL_RSS_URLS` | `backend/services/news-service.mjs` | Optional — social tab |
| `NITTER_BASE_URL` | `backend/config.mjs` | Optional — unused currently |

> **No `.env.example` file exists** in the project root.

---

## 2. External APIs & WebSocket Endpoints

### Backend APIs (Railway)
| Endpoint | Auth | Status | Notes |
|----------|------|--------|-------|
| `wss://data-stream.binance.vision/stream?streams=!miniTicker@arr` | None | **WORKING** | Live price stream in backend |
| `https://data-api.binance.vision/api/v3/ticker/24hr` | None | **WORKING** | CDN mirror, no key needed |
| `https://data-api.binance.vision/api/v3/klines` | None | **WORKING** | Candle data |
| `https://fapi.binance.com/fapi/v1/...` | None (public) | **WORKING** | Funding, OI, leverage brackets |
| `wss://fstream.binance.com/ws/!forceOrder@arr` | None | **WORKING** | Liquidation stream |
| `https://api.coingecko.com/api/v3/global` | None | **PARTIAL** — rate limit 30req/min | Returns 429 frequently without key |
| `https://api.coinpaprika.com/v1/global` | None | **WORKING** | Fallback for market stats |
| `https://mempool.space/api/v1/fees/recommended` | None | **WORKING** | BTC fees |
| `https://mempool.space/api/blocks/tip/height` | None | **WORKING** | Block height |
| `https://mempool.space/api/mempool` | None | **WORKING** | Mempool stats |
| `https://api.alternative.me/fng/?limit=7` | None | **WORKING** | Fear & Greed |
| `https://api.frankfurter.app/latest` | None | **WORKING** | EUR/USD forex |
| `https://api.llama.fi/v2/chains` | None | **WORKING** | DeFi TVL |
| `https://beaconcha.in/api/v1/execution/gasnow` | None | **WORKING** | ETH gas fallback |
| `https://www.okx.com/api/v5/market/ticker` | None | **WORKING** | OKX quotes |
| `https://www.okx.com/api/v5/market/history-candles` | None | **WORKING** | OKX candles |
| `https://api.bybit.com/v5/market/tickers` | None | **WORKING** | Bybit quotes |
| `https://api.bybit.com/v5/market/kline` | None | **WORKING** | Bybit candles |
| `https://api.whale-alert.io/v1/transactions` | API key | **BROKEN** without key → mock data |
| `https://cryptopanic.com/api/v1/posts/` | Optional key | **WORKING** — limited without key |
| `https://min-api.cryptocompare.com/data/v2/news/` | None | **WORKING** | Free tier |
| `https://cryptopanic.com/news/rss/` | None | **WORKING** | RSS feed |
| All 15 RSS feeds | None | **WORKING** (most) | Some may have CORS issues on Vercel |

### Frontend APIs (Vercel → Next.js routes)
| Endpoint | Points To | Status |
|----------|-----------|--------|
| `/api/news` → `lib/news-service.ts` | GNews, CryptoPanic, CryptoCompare, RSS | **BROKEN** — all 3 paid sources return `[]` without keys. RSS works but slow |
| `/api/chat` → `lib/ai-providers.ts` | Anthropic/Groq/Gemini | **PARTIAL** — works if key set, returns mock otherwise |
| `/api/screener` | Binance CDN | **WORKING** |
| `/api/calendar` | Static fallback | **WORKING** |
| `/api/prices` | Binance CDN | **WORKING** |
| `/api/feargreed` | alternative.me | **WORKING** |
| `/api/mempool` | mempool.space | **WORKING** |
| `/api/market` | CoinGecko | **PARTIAL** — rate limits |
| `/api/funding` | Binance fapi | **WORKING** |
| Backend WS `ws://{BACKEND}/ws` | Railway backend | **BROKEN** in production — needs `NEXT_PUBLIC_WS_URL` |

---

## 3. Terminal UI Status

### Global Elements
| Component | Status | Notes |
|-----------|--------|-------|
| MarketStatsBar | **PARTIAL** | All `—` if Railway WS not connected; fallback to Next.js routes works but data may be stale |
| MarketSessionBar | **WORKING** | Client-side UTC clock, no API dependency |
| TickerTape | **WORKING** | Gets quotes via `useBinanceWs` → `realtime-client` → Railway WS; falls back gracefully |
| Navbar / SiteNav | **WORKING** | Static navigation |

### Terminal Page
| Component / Control | Status | Notes |
|--------------------|--------|-------|
| PriceChart — BTC/ETH/SOL | **PARTIAL** | Works for Binance/Hyperliquid venues; OKX only has 3 symbols |
| PriceChart — other tickers | **PARTIAL** | Falls back to mock candles for unknown symbols |
| PriceChart — 1H/4H timeframe OKX | **BROKEN** | `TF_CONFIG` sends `interval: "1H"` but `getOkxCandles` maps `"1h"` (lowercase) — case mismatch |
| Timeframe buttons 1m/5m/15m/30m | **WORKING** | Correct interval strings |
| Timeframe buttons 1H/4H/1D/1W | **PARTIAL** | Binance works; OKX broken (case mismatch) |
| Chart loading skeleton | **WORKING** | Present in PriceChart |
| FundingStatsBar | **WORKING** | Fetches from `/api/funding` |
| TradingPanel — Hyperliquid | **PARTIAL** | MetaMask connect works; private key import present (security warning shown) |
| TradingPanel — Binance | **PARTIAL** | Requires API key input; order placement implemented |
| TradingPanel — OKX | **UI-ONLY** | Venue shows but client-side OKX auth not connected |
| TradingPanel — Bybit | **UI-ONLY** | Venue shows but client-side Bybit auth not connected |
| Long/Short toggle | **WORKING** | Sets `isBuy` correctly |
| Leverage selector | **WORKING** | Syncs to order payload |
| Margin mode (Cross/Isolated) | **WORKING** | Syncs to order payload |
| TP/SL inputs | **WORKING** | Placed as bracket orders |
| Liquidation price display | **WORKING** | Calculated client-side |
| Notional/Fee calculation | **WORKING** | Updates in real-time |
| Order confirm modal | **WORKING** | Shows before placing order |
| Positions tab | **PARTIAL** | Works for Binance with key; Hyperliquid needs wallet |
| Orders tab | **PARTIAL** | Works for Binance with key |
| Close position button | **WORKING** (Binance) | Sends `closePosition` action |
| Cancel order button | **WORKING** (Binance) | Sends `cancel` action |
| NewsFeed in terminal | **PARTIAL** | Gets news via Railway WS snapshot; shows mock if WS down |
| ChatPanel — AI input | **PARTIAL** | Direct typing works; news click injection works |
| ChatPanel — provider | **PARTIAL** | Returns mock response if no AI key |
| AlertPanel | **WORKING** | Client-side price alerts |
| WatchlistPanel | **WORKING** | Client-side localStorage watchlist |
| SignalsPanel | **PARTIAL** | Displays signals but signal generation logic is minimal |
| HyperliquidPanel | **PARTIAL** | Connect/disconnect works; trading needs wallet |
| DydxPanel | **PARTIAL** | Shows dYdX markets; trading stub |
| VenuesPanel | **PARTIAL** | Connection status display |
| BottomPanel | **PARTIAL** | Positions/Orders tabs depend on connected venue |
| TradingActivityDrawer | **WORKING** | Trade history display |

### News Page
| Element | Status | Notes |
|---------|--------|-------|
| News feed loading | **WORKING** | `useNews` hook → `/api/news` |
| Source filter tabs | **WORKING** | All/News/Social/Whales |
| Sentiment filter tabs | **WORKING** | Bull/Bear/Neutral multi-select |
| Search bar | **WORKING** | Client-side filter |
| TradingView chart sidebar | **WORKING** | Embedded iframe |
| Trending Topics | **WORKING** | Computed from feed |
| Market Impact panel | **WORKING** | Fetches live prices |

### Screener Page
| Element | Status | Notes |
|---------|--------|-------|
| Data fetching | **WORKING** | Binance CDN, no key needed |
| Volume/Gainers/Losers tabs | **WORKING** |  |
| RSI-14 column | **WORKING** | Computed server-side |
| Open Interest column | **WORKING** | Binance fapi, no key |
| L/S ratio column | **WORKING** | Binance fapi, no key |
| Search filter | **WORKING** | Client-side instant |
| Trade button → terminal | **WORKING** | Routes with `?ticker=` |
| Auto-refresh 45s | **WORKING** |  |

### Calendar Page
| Element | Status | Notes |
|---------|--------|-------|
| Events display | **WORKING** | 12 placeholder events (all future in 2026) |
| Category filters | **WORKING** | All filter buttons functional |
| Show past toggle | **WORKING** | Filters past events |
| CoinMarketCal API | **PARTIAL** | Works only with COINMARKETCAL_API_KEY |

---

## 4. News Data Flow — Broken Links

```
[Source APIs]
     ↓
[Railway Backend: getNewsFeed()]
  ├── fetchCryptoCompareNews() → WORKING (no key needed)
  ├── fetchCryptoPanicNews()   → PARTIAL (works without key, limited)
  ├── fetchRssFeed() × 15     → WORKING (most RSS feeds accessible)
  └── MOCK_NEWS fallback       → WORKING
     ↓
[Railway WS broadcast("news", item)]
     ↓
[Frontend realtime-client.ts]
  ← WebSocket message type:"news"
  → setState({ news: [newItem, ...state.news] })
     ↓
[useRealtimeSelector → NewsFeed component]

BROKEN LINKS:
1. If NEXT_PUBLIC_WS_URL not set → WS connects to localhost:4001 → FAILS on Vercel
2. If Railway is down → fallback to /api/bootstrap → FAILS (also hits Railway)
3. Vercel /api/news route → lib/news-service.ts → requires paid keys (GNEWS_API_KEY, CRYPTOPANIC_KEY, CRYPTOCOMPARE_KEY)
   → Without keys: returns MOCK_NEWS only
4. Backend refreshNewsOnly() caches for 45s but getNewsFeed() also caches for 45s
   → Double caching means news may not update for up to 90s
5. RSS feed IDs use `rss-${feed.id}-${i}-${Date.now()}` → generates new IDs on every fetch
   → deduplication by headline works but IDs cause unnecessary re-renders
```

---

## 5. Responsive Design Issues

### Below 1024px
- Terminal: **BROKEN** — Fixed desktop layout with absolute/flex/grid positioning, no mobile breakpoints
- No single-column fallback
- TradingPanel + Chart side by side too narrow

### Below 768px
- Terminal: **BROKEN** — Completely unusable
- News page: **PARTIAL** — Sidebar hidden on mobile (`hidden lg:flex`), but no hamburger for nav
- Screener: **WORKING** — Has mobile card grid (`grid gap-3 sm:hidden`)
- Calendar: **WORKING** — Grid adjusts `sm:grid-cols-2`

### Below 375px
- All pages: Font sizes go below 10px in some places (e.g., `text-[9px]`, `text-[8px]`)
- MarketStatsBar: horizontal scroll but no way to collapse on mobile

### Navigation
- No hamburger menu at any breakpoint
- Navbar is horizontal and collapses poorly on mobile

---

## 6. Dead Code

| File | Issue |
|------|-------|
| `hooks/useCoinCap.ts` | CoinCap changed to paid API; hook likely returns empty. Never used in production components (imported by none) |
| `hooks/useTrending.ts` | May not be used — need to verify |
| `lib/news-sources.ts` | Defines RSS_NEWS_FEEDS + CRYPTOCOMPARE_NEWS_URL for `lib/news-service.ts`; parallel duplicate of backend news-service |
| `lib/rss-parser.ts` | Client-side RSS parser used by `lib/news-service.ts` → works but duplicates backend capability |
| `app/api/news/stream/route.ts` | SSE streaming route — redundant with Railway WS fanout |
| `app/api/news/rss/route.ts` | RSS proxy route — redundant with backend |
| `app/api/prices/route.ts` | May duplicate backend `/api/prices` |
| `app/api/sentiment/route.ts` | Sentiment classification — check if used |
| `app/api/social/route.ts` | Social data route — may be unused if WS handles it |
| `app/api/trending/route.ts` | Trending endpoint — check if used |
| `app/api/okx/orderbook/route.ts` | OKX orderbook route — check if frontend uses it |
| `app/api/venues/validate/route.ts` | Venue validation — check if used (backend handles Binance validation) |
| `lib/market-data/*.ts` | Large set of market data adapters — some may be partially unused |
| `.claire/` directory | Old worktree from previous agent — can be cleaned up |

---

## 7. Runtime Errors & Bug Analysis

### Critical Bugs

1. **`realtime-client.ts` — No exponential backoff**
   `scheduleReconnect()` always waits exactly 2s. On network failure, this hammers the backend with reconnect attempts.

2. **`PriceChart.tsx` — OKX interval case mismatch**
   `TF_CONFIG["1H"].interval = "1H"` but `getOkxCandles` maps `{ "1h": "1H" }` — key is lowercase "1h".
   Result: Fetching 1H candles for OKX always returns mock data silently.

3. **`lib/news-service.ts` — All sources return `[]` without paid keys**
   `fetchGNews`: returns `[]` if no `GNEWS_API_KEY`
   `fetchCryptoPanicNews`: returns `[]` if no `CRYPTOPANIC_KEY`
   `fetchCryptoCompareNews`: returns `[]` if no `CRYPTOCOMPARE_KEY`
   → `/api/news` falls back to `MOCK_NEWS` only. News page shows stale demo data on Vercel.

4. **`realtime-client.ts` line 134 — `console.log` in production**
   Direct `console.log` calls instead of logger utility. Same issue in several components.

5. **`realtime-client.ts` — No max retry limit**
   Reconnection retries indefinitely with no cooldown. Should stop after N attempts and wait.

6. **`getNewsFeed` vs `getNews` double-caching (backend)**
   `getNews` caches for 45s → `getNewsFeed` wraps it and also caches for 45s.
   Net effect: news may be up to 90s stale even when backend runs.

7. **`backend/server.mjs` — Order endpoint disabled**
   Line 273: `json(reply, 200, { ok: false, error: "Backend order routing is not enabled in this refactor yet." })`
   → Hyperliquid orders go through Next.js API route, not backend. This is intentional but creates confusion.

8. **`useVenueMarketData.ts` — Missing bid/ask spread**
   Returns `bid: quote.price, ask: quote.price` — both same as last price, no spread calculation.

9. **`app/calendar/route.ts` — Hardcoded 2026 dates**
   PLACEHOLDER_EVENTS have dates in March-June 2026, which are current. After June 2026, all will show as past. Need dynamic generation.

10. **`NewsItem.timestamp` type mismatch**
    `lib/news-service.ts` creates `timestamp: new Date(...)` (Date object)
    `backend/services/news-service.mjs` creates `timestamp: new Date().toISOString()` (string)
    Frontend `timeAgo()` calls `new Date(date)` which handles both, but type is `Date | string` — inconsistent.

11. **`components/ChatPanel.tsx` system prompt mismatch**
    Chat route in `app/api/chat/route.ts` uses a different system prompt than what Phase 5 requires.

### Missing Null Checks
- `quotes.map(...)` in `useBinanceWs` — no null guard if quotes is undefined
- `state.news.map(...)` in `realtime-client` — no guard if payload is not array
- `data.rates?.find(...)` in `FundingStatsBar` — has null check ✓
- Multiple `.find()` calls in venue adapters without null checks on result

### Unhandled Promises
- `void refreshNewsOnly()` — error not caught (server handles it)
- `void refreshStatsOnly()` — same
- Calendar page `fetch("/api/calendar").catch(() => {})` — swallows all errors silently

---

## Summary Scores

| Category | Score | Notes |
|----------|-------|-------|
| Backend data services | 8/10 | Well-designed, good fallbacks, Railway-dependent |
| Frontend WebSocket client | 6/10 | Works but no backoff, no max retries |
| News pipeline | 4/10 | Critical: 3 paid-key sources return nothing on Vercel |
| Trading panel | 6/10 | Binance works well; OKX/Bybit UI-only |
| Chart component | 7/10 | Good overall; OKX 1H/4H broken |
| AI chat | 7/10 | Good multi-provider; needs system prompt update |
| Screener | 9/10 | Solid, all features work |
| Calendar | 8/10 | Solid, placeholder events current |
| Mobile responsive | 2/10 | Terminal completely broken on mobile |
| Code quality | 6/10 | console.log in prod, missing null checks |
| Security | 5/10 | No CSP headers, no rate limit awareness |
