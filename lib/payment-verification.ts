import { ethers } from "ethers";

export type PlanId = "dex" | "full";

const ERC20_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

function toPlanPriceUsd(plan: PlanId) {
  return plan === "full" ? Number(process.env.FULL_TIER_PRICE_USD || 50) : Number(process.env.DEX_TIER_PRICE_USD || 20);
}

function getConfig() {
  return {
    rpcUrl: String(process.env.PAYMENT_RPC_URL || "").trim(),
    receiver: normalizeAddress(process.env.PAYMENT_RECEIVER_ADDRESS || ""),
    chainId: Number(process.env.PAYMENT_CHAIN_ID || 0) || null,
    tokenAddress: normalizeAddress(process.env.PAYMENT_TOKEN_ADDRESS || ""),
    tokenDecimals: Math.max(0, Number(process.env.PAYMENT_TOKEN_DECIMALS || 6) || 6),
    confirmations: Math.max(1, Number(process.env.PAYMENT_CONFIRMATIONS || 1) || 1),
  };
}

export function hasPaymentVerificationEnv() {
  const config = getConfig();
  return Boolean(config.rpcUrl && config.receiver);
}

export async function verifyPlanPayment({
  txHash,
  payer,
  plan,
}: {
  txHash: string;
  payer: string;
  plan: PlanId;
}) {
  const config = getConfig();
  if (!config.rpcUrl) throw new Error("Missing PAYMENT_RPC_URL.");
  if (!config.receiver) throw new Error("Missing PAYMENT_RECEIVER_ADDRESS.");

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
  let tokenAddress = "";

  if (config.tokenAddress) {
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
    tokenAddress = config.tokenAddress;
  } else {
    if (normalizeAddress(String(tx.to || "")) !== config.receiver) {
      throw new Error("Receiver mismatch.");
    }
    paidUnits = BigInt(tx.value?.toString?.() || "0");
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
    tokenAddress: tokenAddress || null,
    blockNumber: Number(tx.blockNumber || 0),
    txHash,
  };
}
