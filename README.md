# TraderBross Terminal

TraderBross now runs as a split architecture:

- Frontend: Next.js on Vercel
- Backend: standalone Node service for Railway or VPS
- Realtime: backend WebSocket server at `/ws`

## Why this refactor

The original app deployed heavy data fetching inside Next.js route handlers and combined that with many client-side 10s, 12s, 15s, 30s, 60s, and 120s polling loops. On Vercel that translated into repeated serverless invocations for prices, venues, news, market stats, mempool stats, fear and greed, and streaming routes.

The current setup keeps the UI intact while moving aggregation, polling, and live fanout into `backend/`.

## New structure

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
    dydx-service.mjs
    http.mjs
    hyperliquid-service.mjs
    market-service.mjs
    mock-data.mjs
    news-service.mjs
    stats-service.mjs
    vault-service.mjs
    venue-service.mjs

app/
components/
hooks/
lib/
  api-client.ts
  backend-types.ts
  realtime-client.ts
  runtime-env.ts
```

## Local development

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
npm run dev:backend
```

Run the frontend:

```bash
npm run dev:frontend
```

Frontend:

```text
http://localhost:3000
```

Backend health:

```text
http://localhost:4001/health
```

Backend websocket:

```text
ws://localhost:4001/ws
```

## Environment

Frontend must use:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4001
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:4001/ws
```

Backend should also define:

```env
API_HOST=0.0.0.0
API_PORT=4001
CORS_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
LOG_LEVEL=info
```

## Deployment

### Vercel

Deploy only the Next.js frontend. Set:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
NEXT_PUBLIC_WS_URL=wss://your-backend.example.com/ws
```

### Railway

Use start command:

```bash
node backend/server.mjs
```

`backend/Procfile` is included for simple process bootstrapping.

### VPS

You can run the backend with PM2:

```bash
pm2 start backend/ecosystem.config.cjs
```

## Notes

- The frontend no longer depends on short-interval polling for market/news/stats panels.
- Realtime market/news/stats fanout is centralized in the backend websocket server.
- Some low-frequency or non-critical flows remain REST-based by design.
