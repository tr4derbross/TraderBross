# TraderBross Terminal

TraderBross is a premium multi-panel crypto trading terminal built with Next.js.
It combines live market data, news flow, chart-based position management, funding visibility, venue monitoring, and a branded dark trading UI in a single workspace.

## Overview

The interface is designed around a three-panel terminal layout:

- Left panel: news feed, filters, alerts context
- Center panel: chart workspace and trading overlays
- Right panel: execution, DEX integrations, venues, watchlists
- Bottom panel: positions, open orders, history, P&L

## Features

- Live market feed and ticker tape
- Native chart workspace with position overlays
- TP / SL management from chart and positions table
- Market, limit, and stop order simulation flow
- Funding rate support
- News-driven workflow and trade context
- Hyperliquid and dYdX monitoring panels
- Venue connection status for Binance, OKX, Bybit, Hyperliquid, and dYdX
- TraderBross brand-integrated dark premium UI

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lightweight Charts
- Lucide React

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Production Build

Build the project:

```bash
npm run build
```

Start production mode:

```bash
npm run start
```

## Environment Notes

Some venue and news integrations can use optional API credentials through local environment variables.

Examples may include:

- `OKX_API_KEY`
- `OKX_SECRET`
- `OKX_PASSPHRASE`
- `BYBIT_API_KEY`
- `BYBIT_SECRET`
- `GNEWS_API_KEY`
- `CRYPTOPANIC_KEY`
- `CRYPTOCOMPARE_KEY`

Keep local secrets in:

```bash
.env.local
```

Do not commit `.env.local` to GitHub.

## Project Structure

```text
app/           Next.js app router pages and API routes
components/    UI panels, chart, feed, terminal widgets
hooks/         Trading, websocket, alerts, and data hooks
lib/           Mock data, services, parsers, utilities
public/        Static brand assets and public files
```

## Git Workflow

After new changes:

```bash
git add .
git commit -m "Describe the update"
git push
```

## Deployment

The easiest deployment path is Vercel.

Recommended flow:

1. Import the GitHub repository into Vercel
2. Add required environment variables
3. Deploy
4. Test chart, news, and API-dependent panels in production

## Status

Current repository includes:

- branded TraderBross UI
- chart-based trading workflow
- positions and order management
- GitHub-connected source control setup

---

Built for a professional crypto terminal experience under the TraderBross brand.
