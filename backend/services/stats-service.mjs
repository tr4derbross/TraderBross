import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";

const cache = new MemoryCache();

export async function getMarketStats() {
  return cache.remember("stats:market", 60000, async () => {
    try {
      const payload = await fetchJson("https://api.coinpaprika.com/v1/global", { timeoutMs: 4000 });
      return {
        marketCapUsd: payload.market_cap_usd ?? null,
        btcDominance: payload.bitcoin_dominance_percentage ?? null,
        ethDominance: payload.cryptocurrencies_number ? Math.max(0, 100 - (payload.bitcoin_dominance_percentage || 0) - 34) : null,
        marketCapChange24h: payload.market_cap_change_24h ?? null,
      };
    } catch {
      return {
        marketCapUsd: null,
        btcDominance: null,
        ethDominance: null,
        marketCapChange24h: null,
      };
    }
  });
}

export async function getMempoolStats() {
  return cache.remember("stats:mempool", 30000, async () => {
    try {
      const [fees, blockHeightRaw, mempool] = await Promise.all([
        fetchJson("https://mempool.space/api/v1/fees/recommended", { timeoutMs: 5000 }),
        fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(5000) }).then((r) => r.text()),
        fetchJson("https://mempool.space/api/mempool", { timeoutMs: 5000 }),
      ]);

      const blockHeight = Number(blockHeightRaw) || null;

      // Halving every 210,000 blocks; compute next halving block
      let halving = null;
      if (blockHeight) {
        const HALVING_INTERVAL = 210000;
        const nextHalvingBlock = Math.ceil(blockHeight / HALVING_INTERVAL) * HALVING_INTERVAL;
        const remainingBlocks = nextHalvingBlock - blockHeight;
        const estimatedDays = Math.round(remainingBlocks * 10 / 1440); // ~10 min/block
        halving = { remainingBlocks, nextHalvingBlock, estimatedDays };
      }

      return {
        fees: fees ?? null,
        blockHeight,
        mempool: mempool ?? null,
        halving,
      };
    } catch {
      return {
        fees: null,
        blockHeight: null,
        mempool: null,
        halving: null,
      };
    }
  });
}

export async function getFearGreed() {
  return cache.remember("stats:fear-greed", 5 * 60 * 1000, async () => {
    try {
      const payload = await fetchJson("https://api.alternative.me/fng/?limit=7&format=json", { timeoutMs: 4000 });
      const items = payload?.data || [];
      const latest = items[0];
      return {
        value: Number(latest?.value || 50),
        label: latest?.value_classification || "Neutral",
        history: items.map((item) => ({
          value: Number(item.value || 50),
          label: item.value_classification || "Neutral",
          timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString(),
        })),
      };
    } catch {
      return {
        value: 50,
        label: "Neutral",
        history: [],
      };
    }
  });
}
