"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Circle, ExternalLink, Key, Wallet, Loader2 } from "lucide-react";

type VenueStatus = "connected" | "key_required" | "wallet_required" | "checking";

type Venue = {
  id: string;
  name: string;
  type: "CEX" | "DEX";
  color: string;
  logo: string;
  status: VenueStatus;
  note?: string;
  url: string;
  apiDocsUrl?: string;
};

type Props = {
  hlWallet: string;
  onHlWalletChange: (addr: string) => void;
};

type PriceMap = Record<string, { price: number; changePct: number }>;

export default function VenuesPanel({ hlWallet }: Props) {
  const [okxKey, setOkxKey] = useState(false);
  const [bybitKey, setBybitKey] = useState(false);
  const [dydxAddress, setDydxAddress] = useState("");
  const [dydxInput, setDydxInput] = useState("");
  const [prices, setPrices] = useState<Record<string, PriceMap>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      const [okxRes, bybitRes] = await Promise.allSettled([
        fetch("/api/okx?type=status").then((r) => r.json()),
        fetch("/api/bybit?type=status").then((r) => r.json()),
      ]);

      setOkxKey(okxRes.status === "fulfilled" && Boolean(okxRes.value.configured));
      setBybitKey(bybitRes.status === "fulfilled" && Boolean(bybitRes.value.configured));
    };

    const fetchAll = async () => {
      setLoadingPrices(true);
      const [bnRes, okxRes, bybitRes] = await Promise.allSettled([
        fetch("/api/prices?type=quotes").then((r) => r.json()),
        fetch("/api/okx?type=quotes").then((r) => r.json()),
        fetch("/api/bybit?type=quotes").then((r) => r.json()),
      ]);

      const toMap = (quotes: Array<{ symbol: string; price: number; changePct: number }>): PriceMap =>
        Object.fromEntries((quotes || []).map((q) => [q.symbol, { price: q.price, changePct: q.changePct }]));

      setPrices({
        Binance: bnRes.status === "fulfilled" ? toMap(bnRes.value) : {},
        OKX: okxRes.status === "fulfilled" ? toMap(okxRes.value) : {},
        Bybit: bybitRes.status === "fulfilled" ? toMap(bybitRes.value) : {},
      });
      setLoadingPrices(false);
    };

    fetchStatus();
    fetchAll();
    const id = setInterval(fetchAll, 15_000);
    return () => clearInterval(id);
  }, []);

  const venues: Venue[] = [
    {
      id: "binance",
      name: "Binance",
      type: "CEX",
      color: "text-amber-200",
      logo: "B",
      status: "connected",
      url: "https://www.binance.com",
      note: "WebSocket active - REST + live quotes",
    },
    {
      id: "okx",
      name: "OKX",
      type: "CEX",
      color: "text-[#f3ead7]",
      logo: "O",
      status: okxKey ? "connected" : "key_required",
      url: "https://www.okx.com",
      apiDocsUrl: "https://www.okx.com/docs-v5/en/",
      note: okxKey ? "API connected" : ".env.local -> OKX_API_KEY / OKX_SECRET / OKX_PASSPHRASE",
    },
    {
      id: "bybit",
      name: "Bybit",
      type: "CEX",
      color: "text-amber-100",
      logo: "B",
      status: bybitKey ? "connected" : "key_required",
      url: "https://www.bybit.com",
      apiDocsUrl: "https://bybit-exchange.github.io/docs/v5/",
      note: bybitKey ? "API connected" : ".env.local -> BYBIT_API_KEY / BYBIT_SECRET",
    },
    {
      id: "hyperliquid",
      name: "Hyperliquid",
      type: "DEX",
      color: "text-[#f2deaa]",
      logo: "H",
      status: hlWallet ? "connected" : "wallet_required",
      url: "https://app.hyperliquid.xyz",
      note: hlWallet ? `${hlWallet.slice(0, 6)}...${hlWallet.slice(-4)}` : "Connect MetaMask from the DEX tab",
    },
    {
      id: "dydx",
      name: "dYdX v4",
      type: "DEX",
      color: "text-[#e9d5a1]",
      logo: "D",
      status: dydxAddress ? "connected" : "wallet_required",
      url: "https://dydx.trade",
      apiDocsUrl: "https://docs.dydx.exchange/",
      note: dydxAddress ? `${dydxAddress.slice(0, 12)}...` : "Enter your dYdX address",
    },
  ];

  const compareTickers = ["BTC", "ETH", "SOL"];
  const venuesWithData = ["Binance", "OKX", "Bybit"];

  const fmtPrice = (price: number) =>
    price >= 1000
      ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : price >= 1
        ? `$${price.toFixed(3)}`
        : `$${price.toFixed(5)}`;

  return (
    <div className="flex h-full flex-col overflow-y-auto text-xs">
      <div className="panel-header soft-divider shrink-0 border-b px-3 py-2">
        <span className="brand-section-title text-xs">Venue Connections</span>
      </div>

      <div className="divide-y divide-[rgba(212,161,31,0.06)]">
        <div className="bg-[rgba(212,161,31,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
          Centralized (CEX)
        </div>
        {venues
          .filter((venue) => venue.type === "CEX")
          .map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}

        <div className="mt-2 bg-[rgba(212,161,31,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
          Decentralized (DEX)
        </div>
        {venues
          .filter((venue) => venue.type === "DEX")
          .map((venue) => (
            <div key={venue.id}>
              <VenueCard venue={venue} />
              {venue.id === "dydx" && (
                <div className="flex gap-1.5 px-3 pb-2">
                  <input
                    type="text"
                    placeholder="dydx1abc... your address"
                    value={dydxInput}
                    onChange={(e) => setDydxInput(e.target.value)}
                    className="terminal-input flex-1 rounded-xl px-3 py-1.5 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => setDydxAddress(dydxInput.trim())}
                    className="brand-chip-active rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="mt-2 border-t border-[rgba(212,161,31,0.08)]">
        <div className="bg-[rgba(212,161,31,0.04)] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
          Price Comparison
        </div>
        {loadingPrices ? (
          <div className="flex items-center gap-2 px-3 py-3 text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(212,161,31,0.06)]">
                <td className="px-3 py-1 text-[9px] text-zinc-500">Ticker</td>
                {venuesWithData.map((venue) => (
                  <td key={venue} className="px-2 py-1 text-right text-[9px] text-zinc-500">
                    {venue}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareTickers.map((ticker) => {
                const rows = venuesWithData.map((venue) => prices[venue]?.[ticker]);
                const validPrices = rows.filter(Boolean).map((row) => row!.price);
                const minPrice = Math.min(...validPrices);
                const maxPrice = Math.max(...validPrices);

                return (
                  <tr key={ticker} className="border-b border-[rgba(212,161,31,0.05)]">
                    <td className="px-3 py-1 font-bold text-[#f3ead7]">{ticker}</td>
                    {rows.map((row, index) => {
                      if (!row) {
                        return (
                          <td key={index} className="px-2 py-1 text-right text-zinc-700">
                            -
                          </td>
                        );
                      }

                      const isBest = row.price === minPrice && minPrice !== maxPrice;

                      return (
                        <td
                          key={index}
                          className={`px-2 py-1 text-right tabular-nums ${
                            isBest ? "font-bold text-amber-200" : "text-zinc-300"
                          }`}
                        >
                          {fmtPrice(row.price)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="px-3 py-1 text-[9px] text-zinc-600">Gold highlight = most competitive quote</p>
      </div>
    </div>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 transition-colors hover:bg-[rgba(212,161,31,0.03)]">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,161,31,0.12)] bg-[#111317] text-[11px] font-bold ${venue.color}`}
      >
        {venue.logo}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#f3ead7]">{venue.name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${
              venue.type === "CEX" ? "brand-badge brand-badge-gold" : "brand-badge"
            }`}
          >
            {venue.type}
          </span>
          {venue.status === "connected" ? (
            <CheckCircle className="ml-auto h-3 w-3 shrink-0 text-amber-200" />
          ) : (
            <Circle className="ml-auto h-3 w-3 shrink-0 text-zinc-700" />
          )}
        </div>
        <p className="mt-0.5 truncate text-[9px] text-zinc-500">{venue.note}</p>
        <div className="mt-1 flex items-center gap-2">
          {venue.status === "key_required" && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-200">
              <Key className="h-2.5 w-2.5" /> API key required
            </span>
          )}
          {venue.status === "wallet_required" && (
            <span className="flex items-center gap-0.5 text-[9px] text-zinc-400">
              <Wallet className="h-2.5 w-2.5" /> Connect wallet
            </span>
          )}
          <a
            href={venue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-0.5 text-[9px] text-zinc-600 hover:text-zinc-400"
          >
            <ExternalLink className="h-2.5 w-2.5" /> {venue.name}
          </a>
        </div>
      </div>
    </div>
  );
}
