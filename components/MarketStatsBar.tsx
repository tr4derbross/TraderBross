"use client";

import { useRealtimeSelector } from "@/lib/realtime-client";
import { AlertTriangle } from "lucide-react";

function fmtMarketCap(usd: number | null): string {
  if (usd == null) return "—";
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  return `$${(usd / 1e6).toFixed(0)}M`;
}

export default function MarketStatsBar() {
  const connectionStatus = useRealtimeSelector((state) => state.connectionStatus);
  const market = useRealtimeSelector((state) => state.marketStats) ?? {
    marketCapUsd: null,
    btcDominance: null,
    ethDominance: null,
    marketCapChange24h: null,
    total24hVolume: null,
    defiMarketCap: null,
    activeCryptos: null,
  };
  const mempool = useRealtimeSelector((state) => state.mempoolStats) ?? {
    fees: null,
    blockHeight: null,
    mempool: null,
    halving: null,
  };
  const ethGas = useRealtimeSelector((state) => state.ethGas);
  const defiTvl = useRealtimeSelector((state) => state.defiTvl);
  const forex = useRealtimeSelector((state) => state.forex);

  const failed = connectionStatus === "disconnected";
  const capChange = market.marketCapChange24h;
  const capChangePositive = capChange != null && capChange >= 0;

  function nullVal(val: string | null): string {
    if (val !== null) return val;
    return failed ? "N/A" : "—";
  }

  const stats: { label: string; value: string; highlight?: "up" | "down"; warn?: boolean }[] = [
    {
      label: "MCAP",
      value: market.marketCapUsd != null ? fmtMarketCap(market.marketCapUsd) : nullVal(null),
      highlight: capChange != null ? (capChangePositive ? "up" : "down") : undefined,
      warn: failed && market.marketCapUsd == null,
    },
    {
      label: "24H",
      value: capChange != null ? `${capChangePositive ? "+" : ""}${capChange.toFixed(2)}%` : nullVal(null),
      highlight: capChange != null ? (capChangePositive ? "up" : "down") : undefined,
      warn: failed && capChange == null,
    },
    {
      label: "VOL 24H",
      value: market.total24hVolume != null ? fmtMarketCap(market.total24hVolume) : nullVal(null),
      warn: failed && market.total24hVolume == null,
    },
    {
      label: "BTC DOM",
      value: market.btcDominance != null ? `${market.btcDominance.toFixed(1)}%` : nullVal(null),
      warn: failed && market.btcDominance == null,
    },
    {
      label: "ETH DOM",
      value: market.ethDominance != null ? `${market.ethDominance.toFixed(1)}%` : nullVal(null),
      warn: failed && market.ethDominance == null,
    },
    {
      label: "EUR/USD",
      value: forex?.eurUsd != null ? forex.eurUsd.toFixed(4) : nullVal(null),
      warn: failed && forex == null,
    },
    {
      label: "USD/JPY",
      value: forex?.usdJpy != null ? forex.usdJpy.toFixed(2) : nullVal(null),
      warn: failed && forex == null,
    },
    {
      label: "BLOCK",
      value: mempool.blockHeight != null ? `#${mempool.blockHeight.toLocaleString()}` : nullVal(null),
      warn: failed && mempool.blockHeight == null,
    },
    {
      label: "FEES (SAT/VB)",
      value:
        mempool.fees != null
          ? `${mempool.fees.fastestFee} · ${mempool.fees.halfHourFee} · ${mempool.fees.hourFee}`
          : nullVal(null),
      warn: failed && mempool.fees == null,
    },
    {
      label: "MEMPOOL",
      value: mempool.mempool != null ? `${mempool.mempool.count.toLocaleString()} tx` : nullVal(null),
      warn: failed && mempool.mempool == null,
    },
    {
      label: "HALVING",
      value:
        mempool.halving != null
          ? `${mempool.halving.remainingBlocks.toLocaleString()} blk`
          : nullVal(null),
      warn: failed && mempool.halving == null,
    },
    {
      label: "ETH GAS",
      value: ethGas != null ? `${ethGas.safe} · ${ethGas.average} · ${ethGas.fast}` : nullVal(null),
      warn: failed && ethGas == null,
    },
    {
      label: "DEFI TVL",
      value: defiTvl?.tvl != null ? fmtMarketCap(defiTvl.tvl) : nullVal(null),
      warn: failed && defiTvl == null,
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
            className={`flex items-center gap-0.5 text-[10px] tabular-nums ${
              stat.highlight === "up"
                ? "text-emerald-400"
                : stat.highlight === "down"
                  ? "text-red-400"
                  : stat.warn
                    ? "text-amber-600"
                    : "text-zinc-400"
            }`}
          >
            {stat.warn && <AlertTriangle className="h-2.5 w-2.5" />}
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
