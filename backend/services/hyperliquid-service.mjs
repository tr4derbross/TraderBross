import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";
import { generateMockCandles } from "./mock-data.mjs";

const cache = new MemoryCache();
const INFO_URL = "https://api.hyperliquid.xyz/info";

export async function getHyperliquidMarket() {
  return cache.remember("hyperliquid:market", 30000, async () => {
    try {
      const [meta, mids] = await Promise.all([
        fetchJson(INFO_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" }),
          timeoutMs: 5000,
        }),
        fetchJson(INFO_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "allMids" }),
          timeoutMs: 5000,
        }),
      ]);

      const universe = meta?.[0]?.universe || [];
      const contexts = meta?.[1] || [];
      return universe.slice(0, 40).map((asset, index) => ({
        name: asset.name,
        markPx: Number(mids?.[asset.name] || contexts[index]?.markPx || 0),
        fundingRate: Number(contexts[index]?.funding || 0),
        openInterest: Number(contexts[index]?.openInterest || 0),
        volume24h: Number(contexts[index]?.dayNtlVlm || 0),
        change24h: Number(contexts[index]?.prevDayPx ? ((Number(mids?.[asset.name] || contexts[index]?.markPx || 0) - Number(contexts[index].prevDayPx)) / Number(contexts[index].prevDayPx)) * 100 : 0),
        maxLeverage: Number(asset.maxLeverage || 20),
      }));
    } catch {
      return [
        { name: "BTC", markPx: 92000, fundingRate: 0.0001, openInterest: 1200000000, volume24h: 4200000000, change24h: 2.4, maxLeverage: 40 },
        { name: "ETH", markPx: 3200, fundingRate: 0.00008, openInterest: 640000000, volume24h: 1800000000, change24h: 1.6, maxLeverage: 30 },
        { name: "SOL", markPx: 185, fundingRate: 0.00015, openInterest: 420000000, volume24h: 1300000000, change24h: 3.1, maxLeverage: 20 },
      ];
    }
  });
}

export async function getHyperliquidAccount(address) {
  if (!address) {
    return { error: "Address is required." };
  }

  return cache.remember(`hyperliquid:account:${address}`, 10000, async () => {
    try {
      const payload = await fetchJson(INFO_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: address }),
        timeoutMs: 5000,
      });

      const positions = (payload?.assetPositions || []).map((entry) => {
        const position = entry.position || {};
        const side = Number(position.szi || 0) >= 0 ? "long" : "short";
        return {
          coin: position.coin,
          side,
          size: Math.abs(Number(position.szi || 0)),
          entryPx: Number(position.entryPx || 0),
          pnl: Number(position.unrealizedPnl || 0),
          roe: Number(position.returnOnEquity || 0) * 100,
          margin: Number(position.marginUsed || 0),
          liquidationPx: position.liquidationPx ? Number(position.liquidationPx) : null,
        };
      });

      return {
        balance: Number(payload?.marginSummary?.accountValue || 0),
        withdrawable: Number(payload?.withdrawable || 0),
        positions,
      };
    } catch {
      return { error: "Failed to load Hyperliquid account." };
    }
  });
}

export async function getHyperliquidCandles(symbol, interval, limit) {
  return cache.remember(`hyperliquid:candles:${symbol}:${interval}:${limit}`, 12000, async () => {
    try {
      const payload = await fetchJson(INFO_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "candleSnapshot",
          req: {
            coin: symbol,
            interval,
            startTime: Date.now() - limit * 60 * 1000,
            endTime: Date.now(),
          },
        }),
        timeoutMs: 5000,
      });

      return (payload || []).slice(-limit).map((entry) => ({
        time: Math.floor(Number(entry.t) / 1000),
        open: Number(entry.o),
        high: Number(entry.h),
        low: Number(entry.l),
        close: Number(entry.c),
        volume: Number(entry.v),
      }));
    } catch {
      return generateMockCandles(symbol, interval, limit);
    }
  });
}
