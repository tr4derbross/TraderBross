import { NextResponse } from "next/server";
import { type PlanId, hasPaymentVerificationEnv } from "@/lib/payment-verification";

function normalizeAddress(value: string) {
  return String(value || "").trim().toLowerCase();
}

function planPriceUsd(plan: PlanId) {
  return plan === "full" ? Number(process.env.FULL_TIER_PRICE_USD || 50) : Number(process.env.DEX_TIER_PRICE_USD || 20);
}

export async function GET() {
  const receiver = normalizeAddress(process.env.PAYMENT_RECEIVER_ADDRESS || "");
  const tokenAddress = normalizeAddress(process.env.PAYMENT_TOKEN_ADDRESS || "");
  const chainId = Number(process.env.PAYMENT_CHAIN_ID || 0) || null;
  const tokenDecimals = Math.max(0, Number(process.env.PAYMENT_TOKEN_DECIMALS || 6) || 6);
  const symbol = String(process.env.PAYMENT_TOKEN_SYMBOL || (tokenAddress ? "USDC" : "ETH")).trim().toUpperCase() || "USDC";

  return NextResponse.json({
    ok: true,
    enabled: hasPaymentVerificationEnv(),
    receiver: receiver || null,
    chainId,
    tokenAddress: tokenAddress || null,
    tokenDecimals,
    tokenSymbol: symbol,
    dexPriceUsd: planPriceUsd("dex"),
    fullPriceUsd: planPriceUsd("full"),
    txExplorerBaseUrl: String(process.env.PAYMENT_EXPLORER_TX_BASE_URL || "").trim() || null,
  });
}
