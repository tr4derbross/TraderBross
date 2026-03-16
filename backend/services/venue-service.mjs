import { getBinanceQuotes, getBybitQuotes, getOkxQuotes } from "./market-service.mjs";

export async function getVenueQuotes() {
  const [binance, okx, bybit] = await Promise.all([getBinanceQuotes(), getOkxQuotes(), getBybitQuotes()]);
  return {
    Binance: binance,
    OKX: okx,
    Bybit: bybit,
  };
}
