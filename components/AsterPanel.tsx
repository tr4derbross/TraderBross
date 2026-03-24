"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Layers, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useTier2Revenue } from "@/hooks/useTier2Revenue";

type AsterAsset = {
  name: string;
  ticker: string;
  markPx: number;
  fundingRate: number;
  openInterest: number;
  volume24h: number;
  change24h: number;
  maxLeverage: number;
};

function fmt(n: number, decimals = 2) {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 0.0001) return n.toFixed(6);
  if (Math.abs(n) < 0.01) return n.toFixed(5);
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 1000) return n.toFixed(decimals);
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export default function AsterPanel() {
  const revenue = useTier2Revenue();
  const [assets, setAssets] = useState<AsterAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState("BTC");

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ assets?: AsterAsset[] }>("/api/aster?type=markets");
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMarkets();
  }, [fetchMarkets]);

  const current = useMemo(
    () => assets.find((asset) => asset.name === selectedAsset) ?? assets[0] ?? null,
    [assets, selectedAsset],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs">Aster DEX</span>
          <span className="brand-badge rounded-full px-1.5 py-0.5 text-[9px]">Perp Futures</span>
          {revenue.aster.referralEnabled && (
            <a
              href={revenue.aster.referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-300"
            >
              Referral Active
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <button onClick={fetchMarkets} className="text-zinc-600 transition-colors hover:text-amber-100">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="panel-shell-alt shrink-0 border-b px-3 py-2">
        <div className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Selected Market</div>
        {current ? (
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{current.name}-USDT</div>
              <div className="text-[10px] text-zinc-500">Max {current.maxLeverage}x leverage</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[var(--text-primary)]">${fmt(current.markPx)}</div>
              <div className={`text-[10px] ${current.change24h >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {current.change24h >= 0 ? "+" : ""}
                {current.change24h.toFixed(2)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-zinc-500">No market data available.</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && assets.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">Loading Aster markets…</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="sticky top-0 border-b border-[rgba(212,161,31,0.08)] bg-[#0c0d10] text-zinc-500">
                <th className="px-2 py-1.5 text-left font-normal">Market</th>
                <th className="px-2 py-1.5 text-right font-normal">Price</th>
                <th className="px-2 py-1.5 text-right font-normal">24h%</th>
                <th className="px-2 py-1.5 text-right font-normal">Funding</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.ticker}
                  onClick={() => setSelectedAsset(asset.name)}
                  className={`cursor-pointer border-b border-[rgba(212,161,31,0.05)] transition-colors ${
                    selectedAsset === asset.name ? "bg-[rgba(212,161,31,0.06)]" : "hover:bg-[rgba(212,161,31,0.03)]"
                  }`}
                >
                  <td className="px-2 py-1.5 font-bold text-[#f3ead7]">{asset.name}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--text-primary)]">${fmt(asset.markPx)}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${asset.change24h >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    <span className="inline-flex items-center gap-0.5">
                      {asset.change24h >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {asset.change24h >= 0 ? "+" : ""}
                      {asset.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right ${asset.fundingRate >= 0 ? "text-amber-200" : "text-red-300"}`}>
                    {asset.fundingRate >= 0 ? "+" : ""}
                    {(asset.fundingRate * 100).toFixed(4)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
