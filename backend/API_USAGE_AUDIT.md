# External API Audit (Free-Tier Focus)

## Core Terminal Data (single backend pipeline)
- CoinGecko
  - `GET /api/v3/coins/markets`
  - `GET /api/v3/global`
  - Use: market snapshot + coin metadata
  - Cost controls: backend TTL + stale fallback + feature flags
- Hyperliquid
  - `wss://api.hyperliquid.xyz/ws` (`allMids`)
  - Use: live mark/mid updates
  - Cost controls: websocket streaming (reduced polling)
- DexScreener
  - `GET /latest/dex/search?q=<symbol>`
  - Use: token/pair discovery
  - Cost controls: backend TTL + feature flag
- News (RSS/JSON)
  - RSS feeds (Cointelegraph, CoinDesk, Decrypt, The Block, social RSS)
  - CryptoCompare JSON news
  - CryptoPanic JSON news
  - Use: normalized news/social feed
  - Cost controls: backend TTL + per-source feature flags
- Whale/Event
  - Whale Alert REST
  - Binance liquidation websocket
  - Use: whale feed + liquidation events
  - Cost controls: backend TTL (REST) + websocket streaming (events)

## Supplemental Endpoints (cached)
- Binance funding (`/fapi/v1/premiumIndex`) via `/api/funding`
- Binance leverage brackets (`/fapi/v1/leverageBracket`) via `/api/leverage-brackets`
- Binance long/short ratio (`/futures/data/globalLongShortAccountRatio`) via `/api/lsr`
- CoinCap assets (`/v2/assets`) via `/api/coincap`

## Client-side request dedupe
- `lib/api-client.ts` now dedupes concurrent identical GET requests and applies short TTL memoization.
- Prevents multiple widgets from triggering duplicate backend fetches for same endpoint.

## Feature flags
- `FEATURE_COINGECKO_MARKET`
- `FEATURE_COINGECKO_METADATA`
- `FEATURE_DEXSCREENER_DISCOVERY`
- `FEATURE_NEWS_RSS`
- `FEATURE_NEWS_JSON`
- `FEATURE_WHALE_ALERT`
- `FEATURE_HYPERLIQUID_WS`
- `FEATURE_BINANCE_FUNDING`
- `FEATURE_COINCAP`

## TTL controls
- `TTL_MARKET_SNAPSHOT_MS`
- `TTL_COIN_METADATA_MS`
- `TTL_NEWS_FEED_MS`
- `TTL_WHALE_SCAN_MS`
- `TTL_DISCOVERY_MS`
- `TTL_FUNDING_MS`
- `TTL_LEVERAGE_BRACKETS_MS`
- `TTL_LSR_MS`
- `TTL_COINCAP_MS`

