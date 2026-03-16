"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HLAsset = {
  name: string;
  markPx: number;
  fundingRate: number; // hourly %
  openInterest: number;
  volume24h: number;
  change24h: number;
  maxLeverage: number;
};

export type HLPosition = {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number;
  pnl: number;
  roe: number;
  margin: number;
  liquidationPx: number | null;
};

export type HLAccount = {
  balance: number;
  positions: HLPosition[];
  withdrawable: number;
};

const HL_WS = "wss://api.hyperliquid.xyz/ws";
const MAX_RETRY_DELAY_MS = 30_000;

export function useHyperliquid(walletAddress?: string) {
  const [assets, setAssets] = useState<HLAsset[]>([]);
  const [assetIndex, setAssetIndex] = useState<Record<string, number>>({});
  const [account, setAccount] = useState<HLAccount | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const alive = useRef(true);
  const retryCount = useRef(0);

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch("/api/hyperliquid?type=market");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { assets: a, assetIndex: idx } = await res.json();
      if (Array.isArray(a) && a.length > 0) {
        setAssets(a);
        setAssetIndex(idx ?? {});
      }
    } catch {
      // keep previous data on transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    if (!walletAddress) {
      setAccount(null);
      setAccountError(null);
      return;
    }
    setAccountError(null);
    try {
      const res = await fetch(`/api/hyperliquid?type=account&address=${walletAddress}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data?.error) {
        setAccountError(data.error);
      } else {
        setAccount(data);
      }
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Failed to load account");
    }
  }, [walletAddress]);

  // Initial market fetch + 30s refresh
  useEffect(() => {
    alive.current = true;
    fetchMarket();
    const id = setInterval(fetchMarket, 30_000);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [fetchMarket]);

  // Account refresh when wallet connects / every 10s
  useEffect(() => {
    fetchAccount();
    if (!walletAddress) return;
    const id = setInterval(fetchAccount, 10_000);
    return () => clearInterval(id);
  }, [walletAddress, fetchAccount]);

  // WebSocket for real-time mark prices with exponential backoff
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (!alive.current) return;
      ws = new WebSocket(HL_WS);

      ws.onopen = () => {
        setWsConnected(true);
        retryCount.current = 0;
        ws!.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as {
            channel?: string;
            data?: { mids?: Record<string, string> };
          };
          if (msg.channel === "allMids" && msg.data?.mids) {
            const mids = msg.data.mids;
            setAssets((prev) =>
              prev.map((a) => {
                const mid = mids[a.name];
                return mid ? { ...a, markPx: parseFloat(mid) } : a;
              })
            );
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!alive.current) return;
        // Exponential backoff: 2s, 4s, 8s … capped at 30s
        const delay = Math.min(2_000 * Math.pow(2, retryCount.current), MAX_RETRY_DELAY_MS);
        retryCount.current += 1;
        timer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      alive.current = false;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { assets, assetIndex, account, wsConnected, loading, accountError, fetchAccount };
}
