import { ethers } from "ethers";

export type PlanId = "dex" | "full";
export type StableSymbol = "USDC" | "USDT";
export type PaymentNetworkConfig = {
  id: string;
  label: string;
  rpcUrl: string;
  receiver: string;
  chainId: number | null;
  tokenAddress: string;
  tokenSymbol: StableSymbol | "";
  tokenDecimals: number;
  confirmations: number;
  txExplorerBaseUrl: string | null;
};

const ERC20_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
const DEFAULT_STABLE_TOKEN_ALLOWLIST: Record<number, Record<StableSymbol, string[]>> = {
  1: {
    USDC: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
    USDT: ["0xdac17f958d2ee523a2206206994597c13d831ec7"],
  },
  56: {
    USDC: ["0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"],
    USDT: ["0x55d398326f99059ff775485246999027b3197955"],
  },
  137: {
    USDC: ["0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"],
    USDT: ["0xc2132d05d31c914a87c6611c10748aeb04b58e8f"],
  },
  42161: {
    USDC: ["0xaf88d065e77c8cc2239327c5edb3a432268e5831", "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"],
    USDT: ["0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9"],
  },
  8453: {
    USDC: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
    USDT: [],
  },
};

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

function normalizeEvmAddress(address: string) {
  const raw = String(address || "").trim();
  if (!raw || !ethers.isAddress(raw)) return "";
  return normalizeAddress(ethers.getAddress(raw));
}

function normalizeStableSymbol(value: string): StableSymbol | "" {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "USDC" || normalized === "USDT") return normalized;
  return "";
}

function normalizeNetworkId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function chainLabelFromId(chainId: number | null) {
  if (chainId === 56) return "BNB Smart Chain";
  if (chainId === 42161) return "Arbitrum";
  if (chainId === 8453) return "Base";
  if (chainId === 1) return "Ethereum";
  if (chainId === 137) return "Polygon";
  return chainId ? `Chain ${chainId}` : "Unknown Chain";
}

function defaultConfirmationsForChain(chainId: number | null) {
  if (chainId === 1) return 12;
  if (chainId === 56) return 5;
  if (chainId === 42161) return 2;
  if (chainId === 137) return 128;
  return 5;
}

function parseTokenAllowlistFromEnv() {
  const raw = String(process.env.PAYMENT_TOKEN_ALLOWLIST_JSON || "").trim();
  if (!raw) return DEFAULT_STABLE_TOKEN_ALLOWLIST;
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, string[]>>;
    const out: Record<number, Record<StableSymbol, string[]>> = {};
    for (const [chainKey, symbols] of Object.entries(parsed || {})) {
      const chainId = Number(chainKey || 0);
      if (!Number.isFinite(chainId) || chainId <= 0) continue;
      const usdc = Array.isArray(symbols?.USDC)
        ? symbols.USDC.map((row) => normalizeEvmAddress(row)).filter(Boolean)
        : [];
      const usdt = Array.isArray(symbols?.USDT)
        ? symbols.USDT.map((row) => normalizeEvmAddress(row)).filter(Boolean)
        : [];
      out[chainId] = { USDC: Array.from(new Set(usdc)), USDT: Array.from(new Set(usdt)) };
    }
    return Object.keys(out).length > 0 ? out : DEFAULT_STABLE_TOKEN_ALLOWLIST;
  } catch {
    return DEFAULT_STABLE_TOKEN_ALLOWLIST;
  }
}

export function isAllowedStableTokenContract(config: PaymentNetworkConfig) {
  if (!config.chainId || !config.tokenAddress || !config.tokenSymbol) return false;
  const chainAllowlist = parseTokenAllowlistFromEnv()[Number(config.chainId)];
  if (!chainAllowlist) return false;
  const symbolAllowlist = chainAllowlist[config.tokenSymbol];
  return Array.isArray(symbolAllowlist) && symbolAllowlist.includes(normalizeEvmAddress(config.tokenAddress));
}

function toPlanPriceUsd(plan: PlanId) {
  return plan === "full" ? Number(process.env.FULL_TIER_PRICE_USD || 50) : Number(process.env.DEX_TIER_PRICE_USD || 20);
}

function parseLegacyConfig(): PaymentNetworkConfig {
  const chainId = Number(process.env.PAYMENT_CHAIN_ID || 0) || null;
  const id = chainId === 56 ? "bsc" : chainId === 42161 ? "arbitrum" : "default";
  return {
    id,
    label: chainLabelFromId(chainId),
    rpcUrl: String(process.env.PAYMENT_RPC_URL || "").trim(),
    receiver: normalizeEvmAddress(process.env.PAYMENT_RECEIVER_ADDRESS || ""),
    chainId,
    tokenAddress: normalizeEvmAddress(process.env.PAYMENT_TOKEN_ADDRESS || ""),
    tokenSymbol: normalizeStableSymbol(process.env.PAYMENT_TOKEN_SYMBOL || ""),
    tokenDecimals: Math.max(0, Number(process.env.PAYMENT_TOKEN_DECIMALS || 6) || 6),
    confirmations: Math.max(1, Number(process.env.PAYMENT_CONFIRMATIONS || defaultConfirmationsForChain(chainId)) || defaultConfirmationsForChain(chainId)),
    txExplorerBaseUrl: String(process.env.PAYMENT_EXPLORER_TX_BASE_URL || "").trim() || null,
  };
}

function parseNetworkRow(raw: unknown): PaymentNetworkConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const chainId = Number(row.chainId || 0) || null;
  const id = normalizeNetworkId(String(row.id || ""));
  const rpcUrl = String(row.rpcUrl || "").trim();
  const receiver = normalizeEvmAddress(String(row.receiver || ""));
  const tokenAddress = normalizeEvmAddress(String(row.tokenAddress || ""));
  const tokenSymbol = normalizeStableSymbol(String(row.tokenSymbol || ""));
  const tokenDecimals = Math.max(0, Number(row.tokenDecimals || 6) || 6);
  const confirmations = Math.max(
    1,
    Number(row.confirmations || process.env.PAYMENT_CONFIRMATIONS || defaultConfirmationsForChain(chainId)) ||
      defaultConfirmationsForChain(chainId),
  );
  const txExplorerBaseUrl = String(row.txExplorerBaseUrl || "").trim() || null;
  if (!id) return null;

  return {
    id,
    label: String(row.label || "").trim() || chainLabelFromId(chainId),
    rpcUrl,
    receiver,
    chainId,
    tokenAddress,
    tokenSymbol,
    tokenDecimals,
    confirmations,
    txExplorerBaseUrl,
  };
}

function parseNetworksFromEnv() {
  const raw = String(process.env.PAYMENT_NETWORKS_JSON || "").trim();
  if (!raw) return [] as PaymentNetworkConfig[];
  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    return rows.map(parseNetworkRow).filter((item): item is PaymentNetworkConfig => Boolean(item));
  } catch {
    return [];
  }
}

function isConfigReady(config: PaymentNetworkConfig) {
  const symbolAllowed = config.tokenSymbol === "USDC" || config.tokenSymbol === "USDT";
  return Boolean(config.rpcUrl && config.receiver && config.tokenAddress && symbolAllowed && isAllowedStableTokenContract(config));
}

export function getPaymentNetworks(): PaymentNetworkConfig[] {
  const parsed = parseNetworksFromEnv();
  if (parsed.length > 0) return parsed;
  return [parseLegacyConfig()];
}

function getDefaultNetworkId(networks: PaymentNetworkConfig[]) {
  const requested = normalizeNetworkId(String(process.env.PAYMENT_DEFAULT_NETWORK_ID || ""));
  if (requested && networks.some((network) => network.id === requested)) return requested;
  const bsc = networks.find((network) => network.chainId === 56);
  if (bsc) return bsc.id;
  return networks[0]?.id || "default";
}

export function getPaymentNetwork(networkId?: string): PaymentNetworkConfig {
  const networks = getPaymentNetworks();
  const normalized = normalizeNetworkId(String(networkId || ""));
  if (normalized) {
    const matched = networks.find((network) => network.id === normalized);
    if (matched) return matched;
  }
  const fallbackId = getDefaultNetworkId(networks);
  return networks.find((network) => network.id === fallbackId) || networks[0];
}

export function hasAnyPaymentVerificationEnv() {
  return getPaymentNetworks().some(isConfigReady);
}

export function hasPaymentVerificationEnv(networkId?: string) {
  const config = getPaymentNetwork(networkId);
  return isConfigReady(config);
}

export async function verifyPlanPayment({
  txHash,
  payer,
  plan,
  networkId,
}: {
  txHash: string;
  payer: string;
  plan: PlanId;
  networkId?: string;
}) {
  const config = getPaymentNetwork(networkId);
  if (!config.rpcUrl) throw new Error("Missing PAYMENT_RPC_URL.");
  if (!config.receiver) throw new Error("Missing PAYMENT_RECEIVER_ADDRESS.");
  if (!config.tokenAddress) throw new Error("Missing PAYMENT_TOKEN_ADDRESS.");
  if (!ethers.isAddress(config.receiver)) throw new Error("Invalid PAYMENT_RECEIVER_ADDRESS.");
  if (!ethers.isAddress(config.tokenAddress)) throw new Error("Invalid PAYMENT_TOKEN_ADDRESS.");
  if (config.tokenSymbol !== "USDC" && config.tokenSymbol !== "USDT") {
    throw new Error("PAYMENT_TOKEN_SYMBOL must be USDC or USDT.");
  }
  if (!isAllowedStableTokenContract(config)) {
    throw new Error("Payment token contract is not in allowlist.");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();
  const providerChainId = Number(network.chainId || 0);
  if (config.chainId && providerChainId !== Number(config.chainId)) {
    throw new Error("RPC chain mismatch.");
  }
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error("Transaction not found.");
  if (!tx.blockNumber) throw new Error("Transaction is not yet confirmed.");

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction receipt unavailable.");
  if (receipt.status !== 1) throw new Error("Transaction failed on-chain.");
  if (config.chainId && Number(tx.chainId) !== Number(config.chainId)) {
    throw new Error("Wrong chain.");
  }
  if (providerChainId && Number(tx.chainId) !== providerChainId) {
    throw new Error("Transaction chain does not match provider chain.");
  }
  const currentBlock = await provider.getBlockNumber();
  const confirms = Math.max(0, currentBlock - Number(tx.blockNumber) + 1);
  if (confirms < config.confirmations) {
    throw new Error(`Insufficient confirmations (${confirms}/${config.confirmations}).`);
  }

  const expectedPayer = normalizeAddress(payer);
  const txFrom = normalizeAddress(tx.from || "");
  if (!expectedPayer || txFrom !== expectedPayer) {
    throw new Error("Payer address mismatch.");
  }

  const expectedAmountUnits = ethers.parseUnits(String(toPlanPriceUsd(plan)), config.tokenDecimals);
  let paidUnits = BigInt(0);
  const tokenAddress = config.tokenAddress;

  const iface = new ethers.Interface(ERC20_ABI);
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  for (const log of receipt.logs) {
    if (normalizeAddress(log.address) !== config.tokenAddress) continue;
    if (!Array.isArray(log.topics) || log.topics[0] !== transferTopic) continue;
    try {
      const parsed = iface.parseLog(log);
      const from = normalizeAddress(String(parsed?.args?.from || ""));
      const to = normalizeAddress(String(parsed?.args?.to || ""));
      const value = BigInt(parsed?.args?.value?.toString?.() || "0");
      if (from === expectedPayer && to === config.receiver) {
        paidUnits += value;
      }
    } catch {
      // ignore unparsable logs
    }
  }

  if (paidUnits < expectedAmountUnits) {
    throw new Error("Insufficient payment amount.");
  }

  return {
    chainId: Number(tx.chainId || config.chainId || 0),
    payer: expectedPayer,
    receiver: config.receiver,
    paidAmountUnits: paidUnits.toString(),
    expectedAmountUnits: expectedAmountUnits.toString(),
    tokenAddress,
    tokenSymbol: config.tokenSymbol,
    networkId: config.id,
    networkLabel: config.label,
    blockNumber: Number(tx.blockNumber || 0),
    txHash,
  };
}
