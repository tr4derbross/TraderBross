import { MemoryCache } from "./cache.mjs";
import { fetchJson } from "./http.mjs";

const cache = new MemoryCache();

export async function getEthGas(etherscanApiKey = "") {
  return cache.remember("stats:eth-gas", 30000, async () => {
    try {
      // Prefer Etherscan if key available (more reliable), otherwise beaconcha.in (free, no key)
      if (etherscanApiKey) {
        const data = await fetchJson(
          `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${etherscanApiKey}`,
          { timeoutMs: 5000 }
        );
        if (data?.status === "1" && data.result) {
          return {
            safe: Number(data.result.SafeGasPrice),
            average: Number(data.result.ProposeGasPrice),
            fast: Number(data.result.FastGasPrice),
          };
        }
      }
      // Free fallback: beaconcha.in gas tracker (gwei)
      const beacon = await fetchJson("https://beaconcha.in/api/v1/execution/gasnow", { timeoutMs: 5000 });
      if (beacon?.data) {
        return {
          safe: Math.round(Number(beacon.data.slow) / 1e9),
          average: Math.round(Number(beacon.data.standard) / 1e9),
          fast: Math.round(Number(beacon.data.fast) / 1e9),
        };
      }
      return null;
    } catch {
      return null;
    }
  });
}

export async function getDefiLlamaTvl() {
  return cache.remember("stats:defillama-tvl", 5 * 60 * 1000, async () => {
    try {
      // Sum TVL across all chains from DefiLlama (free, no key required)
      const chains = await fetchJson("https://api.llama.fi/v2/chains", { timeoutMs: 8000 });
      if (!Array.isArray(chains)) return null;
      const total = chains.reduce((sum, chain) => sum + (Number(chain.tvl) || 0), 0);
      return { tvl: total > 0 ? total : null };
    } catch {
      return null;
    }
  });
}

export async function getMarketStats() {
  return cache.remember("stats:market", 60000, async () => {
    // Primary: CoinGecko /global — real BTC/ETH dominance, 24h volume, DeFi mcap
    try {
      const payload = await fetchJson("https://api.coingecko.com/api/v3/global", { timeoutMs: 5000 });
      const d = payload?.data;
      if (d) {
        return {
          marketCapUsd: d.total_market_cap?.usd ?? null,
          btcDominance: d.market_cap_percentage?.btc != null ? Math.round(d.market_cap_percentage.btc * 10) / 10 : null,
          ethDominance: d.market_cap_percentage?.eth != null ? Math.round(d.market_cap_percentage.eth * 10) / 10 : null,
          marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? null,
          total24hVolume: d.total_volume?.usd ?? null,
          defiMarketCap: d.defi_market_cap ?? null,
          activeCryptos: d.active_cryptocurrencies ?? null,
        };
      }
    } catch {
      // fall through to CoinPaprika fallback
    }

    // Fallback: CoinPaprika
    try {
      const payload = await fetchJson("https://api.coinpaprika.com/v1/global", { timeoutMs: 4000 });
      return {
        marketCapUsd: payload.market_cap_usd ?? null,
        btcDominance: payload.bitcoin_dominance_percentage ?? null,
        ethDominance: payload.cryptocurrencies_number
          ? Math.max(0, 100 - (payload.bitcoin_dominance_percentage || 0) - 34)
          : null,
        marketCapChange24h: payload.market_cap_change_24h ?? null,
        total24hVolume: null,
        defiMarketCap: null,
        activeCryptos: payload.cryptocurrencies_number ?? null,
      };
    } catch {
      return {
        marketCapUsd: null,
        btcDominance: null,
        ethDominance: null,
        marketCapChange24h: null,
        total24hVolume: null,
        defiMarketCap: null,
        activeCryptos: null,
      };
    }
  });
}

// ─── Frankfurter Forex (ECB rates, free, no API key required) ─────────────────
export async function getForexRates() {
  return cache.remember("stats:forex", 5 * 60 * 1000, async () => {
    try {
      const payload = await fetchJson(
        "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY",
        { timeoutMs: 5000 }
      );
      const r = payload?.rates;
      if (!r) return null;
      return {
        // Standard forex notation: EUR/USD = how many USD per 1 EUR
        eurUsd: r.EUR ? Math.round((1 / r.EUR) * 10000) / 10000 : null,
        gbpUsd: r.GBP ? Math.round((1 / r.GBP) * 10000) / 10000 : null,
        // USD/JPY = how many JPY per 1 USD
        usdJpy: r.JPY ? Math.round(r.JPY * 100) / 100 : null,
      };
    } catch {
      return null;
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
