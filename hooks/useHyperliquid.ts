"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRealtimeSelector } from "@/lib/realtime-client";

export type HLAsset = {
  name: string;
  markPx: number;
  fundingRate: number;
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

export function useHyperliquid(walletAddress?: string) {
  const [assets, setAssets] = useState<HLAsset[]>([]);
  const [account, setAccount] = useState<HLAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const quotes = useRealtimeSelector((state) => state.quotes);
  const wsConnected = useRealtimeSelector((state) => state.connectionStatus === "connected");

  const quoteMap = useMemo(
    () => Object.fromEntries(quotes.map((quote) => [quote.symbol, quote.price])),
    [quotes],
  );

  const fetchMarket = useCallback(async () => {
    try {
      const data = await apiFetch<HLAsset[]>("/api/hyperliquid?type=market");
      setAssets(data);
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
    const data = await apiFetch<HLAccount | { error: string }>(`/api/hyperliquid?type=account&address=${walletAddress}`);
    if ("error" in data) {
      setAccountError(data.error);
      return;
    }
    setAccount(data);
  }, [walletAddress]);

  useEffect(() => {
    void fetchMarket();
  }, [fetchMarket]);

  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    if (Object.keys(quoteMap).length === 0) {
      return;
    }

    setAssets((current) =>
      current.map((asset) => ({
        ...asset,
        markPx: quoteMap[asset.name] ?? asset.markPx,
      })),
    );
  }, [quoteMap]);

  return { assets, assetIndex: quoteMap, account, wsConnected, loading, accountError, fetchAccount };
}
