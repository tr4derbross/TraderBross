"use client";

import { useEffect, useState } from "react";

type MarketStats = {
  marketCapUsd: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  marketCapChange24h: number | null;
};

type MempoolStats = {
  fees: { fastestFee: number; halfHourFee: number; hourFee: number } | null;
  blockHeight: number | null;
  mempool: { count: number } | null;
  halving: { remainingBlocks: number } | null;
};

function fmtMarketCap(usd: number | null): string {
  if (usd == null) return "—";
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  return `$${(usd / 1e6).toFixed(0)}M`;
}

export default function MarketStatsBar() {
  const [market, setMarket] = useState<MarketStats>({
    marketCapUsd: null,
    btcDominance: null,
    ethDominance: null,
    marketCapChange24h: null,
  });
  const [mempool, setMempool] = useState<MempoolStats>({
    fees: null,
    blockHeight: null,
    mempool: null,
    halving: null,
  });

  useEffect(() => {
    const fetchMarket = () =>
      fetch("/api/market")
        .then((r) => r.json())
        .then(setMarket)
        .catch(() => {});

    const fetchMempool = () =>
      fetch("/api/mempool")
        .then((r) => r.json())
        .then(setMempool)
        .catch(() => {});

    fetchMarket();
    fetchMempool();

    const marketTimer = setInterval(fetchMarket, 60_000);
    const mempoolTimer = setInterval(fetchMempool, 30_000);

    return () => {
      clearInterval(marketTimer);
      clearInterval(mempoolTimer);
    };
  }, []);

  const capChange = market.marketCapChange24h;
  const capChangePositive = capChange != null && capChange >= 0;

  const stats: { label: string; value: string; highlight?: "up" | "down" }[] = [
    {
      label: "MCAP",
      value: fmtMarketCap(market.marketCapUsd),
      highlight: capChange != null ? (capChangePositive ? "up" : "down") : undefined,
    },
    {
      label: "24H",
      value: capChange != null ? `${capChangePositive ? "+" : ""}${capChange.toFixed(2)}%` : "—",
      highlight: capChange != null ? (capChangePositive ? "up" : "down") : undefined,
    },
    {
      label: "BTC DOM",
      value: market.btcDominance != null ? `${market.btcDominance.toFixed(1)}%` : "—",
    },
    {
      label: "ETH DOM",
      value: market.ethDominance != null ? `${market.ethDominance.toFixed(1)}%` : "—",
    },
    {
      label: "BLOCK",
      value: mempool.blockHeight != null ? `#${mempool.blockHeight.toLocaleString()}` : "—",
    },
    {
      label: "FEES (SAT/VB)",
      value:
        mempool.fees != null
          ? `${mempool.fees.fastestFee} · ${mempool.fees.halfHourFee} · ${mempool.fees.hourFee}`
          : "—",
    },
    {
      label: "MEMPOOL",
      value: mempool.mempool != null ? `${mempool.mempool.count.toLocaleString()} tx` : "—",
    },
    {
      label: "HALVING",
      value:
        mempool.halving != null
          ? `${mempool.halving.remainingBlocks.toLocaleString()} blk`
          : "—",
    },
  ];

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b border-white/[0.04] bg-[rgba(8,10,16,0.85)] px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex shrink-0 items-center gap-1.5 border-r border-white/[0.05] px-3 py-1 last:border-r-0"
        >
          <span className="text-[9px] font-bold tracking-[0.18em] text-zinc-600 uppercase">
            {stat.label}
          </span>
          <span
            className={`text-[10px] tabular-nums ${
              stat.highlight === "up"
                ? "text-emerald-400"
                : stat.highlight === "down"
                  ? "text-red-400"
                  : "text-zinc-400"
            }`}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
