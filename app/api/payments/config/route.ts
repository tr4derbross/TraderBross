import { NextResponse } from "next/server";
import { getPaymentNetwork, getPaymentNetworks, type PlanId, hasPaymentVerificationEnv } from "@/lib/payment-verification";

function normalizeAddress(value: string) {
  return String(value || "").trim().toLowerCase();
}

function planPriceUsd(plan: PlanId) {
  return plan === "full" ? Number(process.env.FULL_TIER_PRICE_USD || 50) : Number(process.env.DEX_TIER_PRICE_USD || 20);
}

export async function GET() {
  const networks = getPaymentNetworks().map((network) => ({
    id: network.id,
    label: network.label,
    chainId: network.chainId,
    receiver: network.receiver || null,
    tokenAddress: network.tokenAddress || null,
    tokenDecimals: network.tokenDecimals,
    tokenSymbol: network.tokenSymbol || null,
    txExplorerBaseUrl: network.txExplorerBaseUrl || null,
    enabled: hasPaymentVerificationEnv(network.id),
  }));
  const active = getPaymentNetwork();
  const enabled = hasPaymentVerificationEnv(active.id);

  return NextResponse.json({
    ok: true,
    enabled,
    defaultNetworkId: active.id,
    networks,
    receiver: normalizeAddress(active.receiver || "") || null,
    chainId: active.chainId,
    tokenAddress: normalizeAddress(active.tokenAddress || "") || null,
    tokenDecimals: active.tokenDecimals,
    tokenSymbol: active.tokenSymbol || null,
    dexPriceUsd: planPriceUsd("dex"),
    fullPriceUsd: planPriceUsd("full"),
    txExplorerBaseUrl: active.txExplorerBaseUrl || null,
  });
}
