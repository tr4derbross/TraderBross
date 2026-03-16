import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";

const cache = new MemoryCache();
const INDEXER = "https://indexer.dydx.trade/v4";

export async function getDydxMarkets() {
  return cache.remember("dydx:markets", 30000, async () => {
    try {
      const payload = await fetchJson(`${INDEXER}/perpetualMarkets`, { timeoutMs: 5000 });
      const markets = Object.values(payload?.markets || {}).slice(0, 30);
      return {
        assets: markets.map((market) => ({
          name: market.ticker?.replace("-USD", "") || market.market,
          ticker: market.ticker || market.market,
          markPx: Number(market.oraclePrice || market.price || 0),
          fundingRate: Number(market.nextFundingRate || 0),
          openInterest: Number(market.openInterest || 0),
          volume24h: Number(market.volume24H || 0),
          change24h: Number(market.priceChange24H || 0),
          maxLeverage: Number(market.initialMarginFraction ? Math.round(1 / Number(market.initialMarginFraction)) : 20),
        })),
      };
    } catch {
      return {
        assets: [
          { name: "BTC", ticker: "BTC-USD", markPx: 92000, fundingRate: 0.00008, openInterest: 200000000, volume24h: 850000000, change24h: 1.8, maxLeverage: 20 },
          { name: "ETH", ticker: "ETH-USD", markPx: 3200, fundingRate: 0.00006, openInterest: 120000000, volume24h: 430000000, change24h: 1.2, maxLeverage: 20 },
        ],
      };
    }
  });
}

export async function getDydxAccount(address) {
  if (!address) {
    return { error: "Address is required." };
  }

  return cache.remember(`dydx:account:${address}`, 12000, async () => {
    try {
      const payload = await fetchJson(`${INDEXER}/addresses/${address}/subaccounts`, { timeoutMs: 5000 });
      const account = payload?.subaccounts?.[0];
      if (!account) {
        return { error: "No dYdX subaccount found for this address." };
      }

      const positions = (account.openPerpetualPositions || []).map((position) => ({
        coin: position.market?.replace("-USD", "") || "UNKNOWN",
        side: Number(position.size || 0) >= 0 ? "long" : "short",
        size: Math.abs(Number(position.size || 0)),
        entryPx: Number(position.entryPrice || 0),
        pnl: Number(position.unrealizedPnl || 0),
        roe: Number(position.returnOnEquity || 0) * 100,
        margin: Number(position.sumOpen || 0),
      }));

      return {
        balance: Number(account.equity || 0),
        freeCollateral: Number(account.freeCollateral || 0),
        positions,
      };
    } catch {
      return { error: "Failed to load dYdX account." };
    }
  });
}
