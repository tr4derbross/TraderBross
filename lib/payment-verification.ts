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

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
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
    receiver: normalizeAddress(process.env.PAYMENT_RECEIVER_ADDRESS || ""),
    chainId,
    tokenAddress: normalizeAddress(process.env.PAYMENT_TOKEN_ADDRESS || ""),
    tokenSymbol: normalizeStableSymbol(process.env.PAYMENT_TOKEN_SYMBOL || ""),
    tokenDecimals: Math.max(0, Number(process.env.PAYMENT_TOKEN_DECIMALS || 6) || 6),
    confirmations: Math.max(1, Number(process.env.PAYMENT_CONFIRMATIONS || 1) || 1),
    txExplorerBaseUrl: String(process.env.PAYMENT_EXPLORER_TX_BASE_URL || "").trim() || null,
  };
}

function parseNetworkRow(raw: unknown): PaymentNetworkConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const chainId = Number(row.chainId || 0) || null;
  const id = normalizeNetworkId(String(row.id || ""));
  const rpcUrl = String(row.rpcUrl || "").trim();
  const receiver = normalizeAddress(String(row.receiver || ""));
  const tokenAddress = normalizeAddress(String(row.tokenAddress || ""));
  const tokenSymbol = normalizeStableSymbol(String(row.tokenSymbol || ""));
  const tokenDecimals = Math.max(0, Number(row.tokenDecimals || 6) || 6);
  const confirmations = Math.max(1, Number(row.confirmations || process.env.PAYMENT_CONFIRMATIONS || 1) || 1);
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
  return Boolean(config.rpcUrl && config.receiver && config.tokenAddress && symbolAllowed);
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
  if (config.tokenSymbol !== "USDC" && config.tokenSymbol !== "USDT") {
    throw new Error("PAYMENT_TOKEN_SYMBOL must be USDC or USDT.");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error("Transaction not found.");
  if (!tx.blockNumber) throw new Error("Transaction is not yet confirmed.");

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction receipt unavailable.");
  if (receipt.status !== 1) throw new Error("Transaction failed on-chain.");
  if (config.chainId && Number(tx.chainId) !== Number(config.chainId)) {
    throw new Error("Wrong chain.");
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
