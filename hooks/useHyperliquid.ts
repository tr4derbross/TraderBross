"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HLAsset = {
  name: string;
  markPx: number;
  fundingRate: number;  // hourly %
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

export function useHyperliquid(walletAddress?: string) {
  const [assets, setAssets] = useState<HLAsset[]>([]);
  const [assetIndex, setAssetIndex] = useState<Record<string, number>>({});
  const [account, setAccount] = useState<HLAccount | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch("/api/hyperliquid?type=market");
      if (!res.ok) return;
      const { assets: a, assetIndex: idx } = await res.json();
      setAssets(a);
      setAssetIndex(idx);
    } catch {}
    setLoading(false);
  }, []);

  const fetchAccount = useCallback(async () => {
    if (!walletAddress) { setAccount(null); return; }
    try {
      const res = await fetch(`/api/hyperliquid?type=account&address=${walletAddress}`);
      if (!res.ok) return;
      setAccount(await res.json());
    } catch {}
  }, [walletAddress]);

  // Initial market fetch + 30s refresh
  useEffect(() => {
    alive.current = true;
    fetchMarket();
    const id = setInterval(fetchMarket, 30_000);
    return () => { alive.current = false; clearInterval(id); };
  }, [fetchMarket]);

  // Account refresh when wallet connects / every 10s
  useEffect(() => {
    fetchAccount();
    if (!walletAddress) return;
    const id = setInterval(fetchAccount, 10_000);
    return () => clearInterval(id);
  }, [walletAddress, fetchAccount]);

  // WebSocket for real-time mark prices
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (!alive.current) return;
      const ws = new WebSocket(HL_WS);

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
      };

      ws.onmessage = (e) => {
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
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (alive.current) timer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => { clearTimeout(timer); };
  }, []);

  return { assets, assetIndex, account, wsConnected, loading, fetchAccount };
}
