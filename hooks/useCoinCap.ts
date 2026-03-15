"use client";

import { useEffect, useRef, useState } from "react";

const ASSETS = [
  "bitcoin",
  "ethereum",
  "solana",
  "binance-coin",
  "xrp",
  "dogecoin",
  "avalanche",
  "chainlink",
  "arbitrum",
  "optimism",
  "near-protocol",
  "injective-protocol",
  "polkadot",
];

const TICKER_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  "binance-coin": "BNB",
  xrp: "XRP",
  dogecoin: "DOGE",
  avalanche: "AVAX",
  chainlink: "LINK",
  arbitrum: "ARB",
  optimism: "OP",
  "near-protocol": "NEAR",
  "injective-protocol": "INJ",
  polkadot: "DOT",
};

const WS_URL = `wss://ws.coincap.io/prices?assets=${ASSETS.join(",")}`;

export function useCoinCap() {
  const [prices, setPrices] = useState<Record<string, number>>({});
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
        const data = JSON.parse(event.data as string) as Record<string, string>;
        const updates: Record<string, number> = {};
        for (const [asset, priceStr] of Object.entries(data)) {
          const ticker = TICKER_MAP[asset];
          if (ticker) updates[ticker] = parseFloat(priceStr);
        }
        if (Object.keys(updates).length > 0) {
          setPrices((prev) => ({ ...prev, ...updates }));
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (alive.current) timer = setTimeout(connect, 5000);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      alive.current = false;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { prices, connected };
}
