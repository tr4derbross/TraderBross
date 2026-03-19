const DEFAULT_LABELS = [
  { chain: "evm", key: "binance", label: "Binance", type: "exchange" },
  { chain: "evm", key: "coinbase", label: "Coinbase", type: "exchange" },
  { chain: "evm", key: "kraken", label: "Kraken", type: "exchange" },
  { chain: "evm", key: "okx", label: "OKX", type: "exchange" },
  { chain: "evm", key: "bybit", label: "Bybit", type: "exchange" },
  { chain: "evm", key: "tether treasury", label: "Tether Treasury", type: "treasury" },
  { chain: "evm", key: "circle treasury", label: "Circle Treasury", type: "treasury" },
  { chain: "solana", key: "binance", label: "Binance", type: "exchange" },
  { chain: "solana", key: "coinbase", label: "Coinbase", type: "exchange" },
  { chain: "solana", key: "jupiter", label: "Jupiter Treasury", type: "treasury" },
  { chain: "solana", key: "jump", label: "Jump Trading", type: "smart_money" },
];

function normalizeInput(value) {
  return String(value || "").trim().toLowerCase();
}

export function createWalletLabeler(extraLabels = []) {
  const labels = [...DEFAULT_LABELS, ...extraLabels].map((item) => ({
    ...item,
    key: normalizeInput(item.key),
  }));

  function resolve({ chain = "evm", rawLabel = "", ownerType = "", address = "" } = {}) {
    const haystack = [rawLabel, ownerType, address].map(normalizeInput).filter(Boolean).join(" ");
    const exact = labels.find((item) => (item.chain === chain || item.chain === "any") && haystack.includes(item.key));
    if (exact) {
      return {
        label: exact.label,
        labelType: exact.type,
      };
    }
    if (ownerType && normalizeInput(ownerType).includes("exchange")) {
      return { label: "Exchange", labelType: "exchange" };
    }
    if (ownerType && normalizeInput(ownerType).includes("treasury")) {
      return { label: "Treasury", labelType: "treasury" };
    }
    return {
      label: rawLabel || ownerType || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown"),
      labelType: "unknown",
    };
  }

  return { resolve };
}
