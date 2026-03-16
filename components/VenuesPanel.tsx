"use client";

import { useMemo } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRealtimeSelector } from "@/lib/realtime-client";

type VenueId = "binance" | "okx" | "bybit" | "hyperliquid" | "dydx";
type VenueType = "CEX" | "DEX";
type PriceMap = Record<string, { price: number; changePct: number }>;

type Venue = {
  id: VenueId;
  name: string;
  type: VenueType;
  color: string;
  logo: string;
  url: string;
  note: string;
};

type Props = {
  hlWallet: string;
  onHlWalletChange: (addr: string) => void;
};

const VENUES: Venue[] = [
  {
    id: "binance",
    name: "Binance",
    type: "CEX",
    color: "text-amber-200",
    logo: "B",
    url: "https://www.binance.com",
    note: "Spot and perpetual market data",
  },
  {
    id: "okx",
    name: "OKX",
    type: "CEX",
    color: "text-[#f3ead7]",
    logo: "O",
    url: "https://www.okx.com",
    note: "Public quotes and funding context",
  },
  {
    id: "bybit",
    name: "Bybit",
    type: "CEX",
    color: "text-amber-100",
    logo: "B",
    url: "https://www.bybit.com",
    note: "Public market and derivatives data",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    type: "DEX",
    color: "text-[#f2deaa]",
    logo: "H",
    url: "https://app.hyperliquid.xyz",
    note: "Wallet and platform access now lives in the header",
  },
  {
    id: "dydx",
    name: "dYdX v4",
    type: "DEX",
    color: "text-[#e9d5a1]",
    logo: "D",
    url: "https://dydx.trade",
    note: "Wallet and platform access now lives in the header",
  },
];

export default function VenuesPanel({ hlWallet: _hlWallet, onHlWalletChange: _onHlWalletChange }: Props) {
  const venueQuotes = useRealtimeSelector((state) => state.venueQuotes);
  const loadingPrices = useRealtimeSelector((state) => state.connectionStatus === "connecting");
  const prices = useMemo<Record<string, PriceMap>>(
    () => ({
      Binance: Object.fromEntries(venueQuotes.Binance.map((quote) => [quote.symbol, { price: quote.price, changePct: quote.changePct }])),
      OKX: Object.fromEntries(venueQuotes.OKX.map((quote) => [quote.symbol, { price: quote.price, changePct: quote.changePct }])),
      Bybit: Object.fromEntries(venueQuotes.Bybit.map((quote) => [quote.symbol, { price: quote.price, changePct: quote.changePct }])),
    }),
    [venueQuotes],
  );

  const compareTickers = ["BTC", "ETH", "SOL"];
  const venuesWithData = ["Binance", "OKX", "Bybit"];
  const cexVenues = useMemo(() => VENUES.filter((venue) => venue.type === "CEX"), []);
  const dexVenues = useMemo(() => VENUES.filter((venue) => venue.type === "DEX"), []);

  const fmtPrice = (price: number) =>
    price >= 1000
      ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : price >= 1
        ? `$${price.toFixed(3)}`
        : `$${price.toFixed(5)}`;

  return (
    <div className="flex h-full flex-col overflow-y-auto text-xs">
      <div className="panel-header soft-divider shrink-0 border-b px-3 py-2">
        <span className="brand-section-title text-xs">Venue Snapshot</span>
      </div>

      <div className="divide-y divide-[rgba(212,161,31,0.06)]">
        <SectionHeader label="Centralized (CEX)" />
        {cexVenues.map((venue) => (
          <VenueInfoCard key={venue.id} venue={venue} />
        ))}

        <SectionHeader label="Decentralized (DEX)" />
        {dexVenues.map((venue) => (
          <VenueInfoCard key={venue.id} venue={venue} />
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-[rgba(212,161,31,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
      {label}
    </div>
  );
}

function VenueInfoCard({ venue }: { venue: Venue }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
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
        </div>
        <p className="mt-0.5 truncate text-[9px] text-zinc-500">{venue.note}</p>
        <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-400">
          <span>Connection management moved to the header</span>
          <a
            href={venue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-0.5 text-zinc-600 hover:text-zinc-400"
          >
            <ExternalLink className="h-2.5 w-2.5" /> Open
          </a>
        </div>
      </div>
    </div>
  );
}
