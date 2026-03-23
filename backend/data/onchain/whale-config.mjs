const DEFAULT_THRESHOLDS = {
  evm: {
    defaultUsd: 750_000,
    byToken: {
      BTC: 2_500_000,
      ETH: 1_500_000,
      USDT: 5_000_000,
      USDC: 5_000_000,
    },
    byEventType: {
      liquidation: 50_000,
      exchange_inflow: 1_000_000,
      exchange_outflow: 1_000_000,
      stablecoin_mint: 3_000_000,
      stablecoin_burn: 3_000_000,
      treasury_movement: 2_000_000,
      smart_money_watch: 250_000,
      large_transfer: 750_000,
    },
  },
  solana: {
    defaultUsd: 350_000,
    byToken: {
      SOL: 500_000,
      USDC: 2_000_000,
      USDT: 2_000_000,
    },
    byEventType: {
      liquidation: 30_000,
      exchange_inflow: 600_000,
      exchange_outflow: 600_000,
      stablecoin_mint: 1_000_000,
      stablecoin_burn: 1_000_000,
      treasury_movement: 700_000,
      smart_money_watch: 150_000,
      large_transfer: 350_000,
    },
  },
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildWhaleConfig(env = process.env) {
  return {
    thresholds: {
      evm: {
        ...DEFAULT_THRESHOLDS.evm,
        defaultUsd: toNumber(env.WHALE_THRESHOLD_EVM_DEFAULT_USD, DEFAULT_THRESHOLDS.evm.defaultUsd),
      },
      solana: {
        ...DEFAULT_THRESHOLDS.solana,
        defaultUsd: toNumber(env.WHALE_THRESHOLD_SOLANA_DEFAULT_USD, DEFAULT_THRESHOLDS.solana.defaultUsd),
      },
    },
    stablecoins: new Set(["USDT", "USDC", "DAI", "USDE", "FDUSD"]),
    exchanges: new Set([
      "Binance",
      "Coinbase",
      "Kraken",
      "OKX",
      "Bybit",
      "KuCoin",
      "Gate.io",
      "Bitfinex",
    ]),
    smartMoneyLabelHints: ["fund", "market maker", "smart money", "alpha"],
  };
}

export function getWhaleThreshold(config, { chainGroup, token, eventType }) {
  const group = chainGroup === "solana" ? config.thresholds.solana : config.thresholds.evm;
  if (!group) return 0;
  if (group.byEventType?.[eventType] != null) return group.byEventType[eventType];
  if (group.byToken?.[token] != null) return group.byToken[token];
  return group.defaultUsd || 0;
}
