# Trading Terminal (Split Architecture)

This project now runs with a strict split:

- Frontend: Next.js (Vercel)
- Backend: Node.js service (Railway or VPS)
- Realtime: Backend WebSocket (`/ws`)

## Architecture

Frontend only reads from:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WS_URL`

All runtime API calls are routed through:

- `lib/runtime-env.ts`
- `lib/api-client.ts`
- `lib/realtime-client.ts`

`app/api/*` routes were fully decommissioned, so Next.js no longer serves backend endpoints.

## Backend Endpoints

- `GET /health`
- `GET /api/bootstrap`
- `GET /api/news`
- `GET /api/whales`
- `GET /api/social`
- `GET /api/prices`
- `GET /api/market`
- `GET /api/mempool`
- `GET /api/feargreed`
- `GET /api/hyperliquid`
- `POST /api/hyperliquid/order`
- `GET /api/dydx`
- `POST /api/chat`
- `POST /api/sentiment`
- `POST|DELETE /api/vault/clear`
- `POST /api/vault/store`
- `GET /api/vault/status`
- `GET /api/calendar`
- `GET /api/screener`
- `GET /api/trending`
- `GET /api/liquidations`
- `WS /ws`

## Backend Structure

```text
backend/
  server.mjs
  config.mjs
  logger.mjs
  Procfile
  ecosystem.config.cjs
  services/
    ai-service.mjs
    cache.mjs
    calendar-service.mjs
    dydx-service.mjs
    http.mjs
    hyperliquid-service.mjs
    market-service.mjs
    mock-data.mjs
    news-service.mjs
    screener-service.mjs
    stats-service.mjs
    trending-service.mjs
    vault-service.mjs
    venue-service.mjs
```

## Environment Variables

Frontend:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
NEXT_PUBLIC_WS_URL=wss://your-backend.example.com/ws
```

Backend:

```env
API_HOST=0.0.0.0
API_PORT=4001
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://your-domain.com
LOG_LEVEL=info
```

## Local Run

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Frontend: `http://localhost:3000`  
Backend health: `http://localhost:4001/health`

## Deployment Runbook

Vercel:

1. Deploy Next.js frontend only.
2. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL` to backend domain.
3. Confirm build output does not list `app/api/*` routes.

Railway/VPS:

1. Start backend with `node backend/server.mjs`.
2. Use process manager (`pm2` or Railway native restarts).
3. Set `CORS_ORIGINS` to only allowed frontend origins.
4. Expose HTTPS + WSS.

PM2 example:

```bash
pm2 start backend/ecosystem.config.cjs
pm2 save
```

## Realtime Behavior

- Frontend receives initial snapshot via `GET /api/bootstrap`.
- Frontend subscribes to `WS /ws`.
- Client heartbeat ping every 20s.
- Backend heartbeat broadcast every 10s.
- Reconnect: exponential backoff with capped retries and reset cycle.
