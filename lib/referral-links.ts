/**
 * Exchange referral link builder.
 * Set env vars in .env.local to enable commission tracking:
 *   NEXT_PUBLIC_BINANCE_REF=your_ref_code
 *   NEXT_PUBLIC_BYBIT_REF=your_affiliate_id
 *   NEXT_PUBLIC_OKX_REF=your_channel_id
 *   NEXT_PUBLIC_HL_REF_CODE=your_hl_referral
 */

export type ExchangeId = "binance" | "bybit" | "okx" | "hyperliquid" | "kucoin";

interface RefLink {
  label: string;
  url: (symbol: string) => string;
  color: string;
}

function binanceRef(): string {
  return typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_BINANCE_REF ?? ""
    : (process.env.NEXT_PUBLIC_BINANCE_REF ?? "");
}
function bybitRef(): string  { return process.env.NEXT_PUBLIC_BYBIT_REF ?? ""; }
function okxRef(): string    { return process.env.NEXT_PUBLIC_OKX_REF ?? ""; }
function hlRef(): string     { return process.env.NEXT_PUBLIC_HL_REF_CODE ?? ""; }

export const EXCHANGE_LINKS: Record<ExchangeId, RefLink> = {
  binance: {
    label: "Binance",
    color: "text-yellow-400",
    url: (sym) => {
      const ref = binanceRef();
      return ref
        ? `https://www.binance.com/en/trade/${sym}_USDT?ref=${ref}`
        : `https://www.binance.com/en/trade/${sym}_USDT`;
    },
  },
  bybit: {
    label: "Bybit",
    color: "text-orange-400",
    url: (sym) => {
      const ref = bybitRef();
      return ref
        ? `https://www.bybit.com/trade/usdt/${sym}USDT?affiliate_id=${ref}`
        : `https://www.bybit.com/trade/usdt/${sym}USDT`;
    },
  },
  okx: {
    label: "OKX",
    color: "text-sky-400",
    url: (sym) => {
      const ref = okxRef();
      return ref
        ? `https://www.okx.com/trade-spot/${sym.toLowerCase()}-usdt?channelid=${ref}`
        : `https://www.okx.com/trade-spot/${sym.toLowerCase()}-usdt`;
    },
  },
  hyperliquid: {
    label: "Hyperliquid",
    color: "text-violet-400",
    url: (sym) => {
      const ref = hlRef();
      return ref
        ? `https://app.hyperliquid.xyz/trade/${sym}?ref=${ref}`
        : `https://app.hyperliquid.xyz/trade/${sym}`;
    },
  },
  kucoin: {
    label: "KuCoin",
    color: "text-emerald-400",
    url: (sym) => `https://www.kucoin.com/trade/${sym}-USDT`,
  },
};

export function getTradeUrl(exchange: ExchangeId, symbol: string): string {
  return EXCHANGE_LINKS[exchange].url(symbol);
}

/** Returns all exchange links for a given symbol */
export function getAllTradeLinks(symbol: string): Array<{ exchange: ExchangeId } & RefLink & { href: string }> {
  return (Object.entries(EXCHANGE_LINKS) as [ExchangeId, RefLink][]).map(([exchange, meta]) => ({
    exchange,
    ...meta,
    href: meta.url(symbol),
  }));
}
