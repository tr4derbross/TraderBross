"use client";

import { useEffect, useRef, useState } from "react";
import { type TickerQuote } from "@/lib/mock-data";

const BINANCE_WS_BASE = "wss://data-stream.binance.vision";

const SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  ARB: "ARBUSDT",
  OP: "OPUSDT",
  NEAR: "NEARUSDT",
  INJ: "INJUSDT",
  DOT: "DOTUSDT",
};

const REVERSE = Object.fromEntries(
  Object.entries(SYMBOLS).map(([ticker, symbol]) => [symbol, ticker])
);

const WS_URL = `${BINANCE_WS_BASE}/stream?streams=!miniTicker@arr`;

const FALLBACK_PRICES: Record<string, number> = {
  BTC: 92000,
  ETH: 3200,
  SOL: 185,
  BNB: 580,
  XRP: 0.62,
  DOGE: 0.18,
  AVAX: 38,
  LINK: 18,
  ARB: 1.2,
  OP: 2.8,
  NEAR: 6.5,
  INJ: 28,
  DOT: 8.5,
  COIN: 185,
  MSTR: 320,
};

function getDecimals(price: number) {
  if (price < 1) return 5;
  if (price < 10) return 4;
  if (price < 1000) return 3;
  return 2;
}

export function useBinanceWs() {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK_PRICES);
  const [connected, setConnected] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (!alive.current) return;

      socket = new WebSocket(WS_URL);

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          data?: Array<{
            s: string;
            c: string;
            o: string;
          }>;
        };

        const entries = payload.data;
        if (!Array.isArray(entries)) return;

        setQuotes((prev) => {
          const nextMap = new Map(prev.map((quote) => [quote.symbol, quote]));
          const priceUpdates: Record<string, number> = {};

          for (const item of entries) {
            const ticker = REVERSE[item.s];
            if (!ticker) continue;

            const price = parseFloat(item.c);
            const open = parseFloat(item.o);
            const change = price - open;
            const changePct = open > 0 ? (change / open) * 100 : 0;
            const dp = getDecimals(price);

            priceUpdates[ticker] = price;
            nextMap.set(ticker, {
              symbol: ticker,
              price: parseFloat(price.toFixed(dp)),
              change: parseFloat(change.toFixed(dp)),
              changePct: parseFloat(changePct.toFixed(2)),
            });
          }

          if (Object.keys(priceUpdates).length > 0) {
            setPrices((current) => ({ ...current, ...priceUpdates }));
          }

          return Array.from(nextMap.values());
        });
      };

      socket.onclose = () => {
        setConnected(false);
        if (alive.current) {
          timer = setTimeout(connect, 2500);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      alive.current = false;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { prices, quotes, connected };
}
