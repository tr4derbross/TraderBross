import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getWalletSessionCookieName, verifyWalletSessionToken } from "@/lib/wallet-auth";
import { type PlanId, hasPaymentVerificationEnv, verifyPlanPayment } from "@/lib/payment-verification";
import { grantWalletTier } from "@/lib/wallet-subscriptions";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isRequestSameOrigin } from "@/lib/request-security";

function json(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function planToTier(plan: PlanId) {
  return plan === "full" ? "full" : "dex";
}

export async function POST(request: NextRequest) {
  if (!isRequestSameOrigin(request)) {
    return json({ ok: false, error: "Origin mismatch." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 20_000) {
    return json({ ok: false, error: "Payload too large." }, 413);
  }

  const ip = getClientIp(request);
  const requestLimit = rateLimit(`wallet-payment-verify:${ip}`, 15, 60_000);
  if (!requestLimit.allowed) {
    return json({ ok: false, error: "Too many payment verification requests. Try again later." }, 429);
  }

  const token = request.cookies.get(getWalletSessionCookieName())?.value || "";
  const session = verifyWalletSessionToken(token);
  if (!session) {
    return json({ ok: false, error: "Unauthorized wallet session." }, 401);
  }
  if (!hasSupabaseAdminEnv()) {
    return json({ ok: false, error: "Supabase admin is not configured." }, 503);
  }
  if (!hasPaymentVerificationEnv()) {
    return json({ ok: false, error: "Payment verification env is missing." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const txHash = String(body?.txHash || "").trim();
  const plan = String(body?.plan || "").trim().toLowerCase() as PlanId;
  if (!txHash || !ethers.isHexString(txHash, 32)) {
    return json({ ok: false, error: "Invalid tx hash." }, 400);
  }
  if (plan !== "dex" && plan !== "full") {
    return json({ ok: false, error: "Invalid plan." }, 400);
  }

  const supabase = createSupabaseAdminClient();
  const existingPayment = await supabase
    .from("wallet_payments")
    .select("id, wallet_address, plan")
    .eq("tx_hash", txHash.toLowerCase())
    .maybeSingle<{ id: string; wallet_address: string; plan: PlanId }>();
  if (existingPayment.data) {
    if (existingPayment.data.wallet_address !== session.address) {
      return json({ ok: false, error: "Transaction already claimed by another wallet." }, 409);
    }
    return json({ ok: true, alreadyProcessed: true, plan: existingPayment.data.plan });
  }

  let payment;
  try {
    payment = await verifyPlanPayment({
      txHash,
      payer: session.address,
      plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed.";
    return json({ ok: false, error: message }, 400);
  }

  const priceUsd = plan === "full" ? Number(process.env.FULL_TIER_PRICE_USD || 50) : Number(process.env.DEX_TIER_PRICE_USD || 20);
  const { error: insertError } = await supabase.from("wallet_payments").insert({
    wallet_address: session.address,
    tx_hash: txHash.toLowerCase(),
    chain_id: payment.chainId,
    token_address: payment.tokenAddress,
    paid_amount_units: payment.paidAmountUnits,
    expected_amount_units: payment.expectedAmountUnits,
    amount_usd: priceUsd,
    plan,
    status: "confirmed",
    metadata: {
      receiver: payment.receiver,
      blockNumber: payment.blockNumber,
    },
  });

  if (insertError) {
    if (String(insertError.message || "").toLowerCase().includes("duplicate key")) {
      const duplicate = await supabase
        .from("wallet_payments")
        .select("wallet_address, plan")
        .eq("tx_hash", txHash.toLowerCase())
        .maybeSingle<{ wallet_address: string; plan: PlanId }>();
      if (duplicate.data?.wallet_address === session.address) {
        return json({ ok: true, alreadyProcessed: true, plan: duplicate.data.plan });
      }
      return json({ ok: false, error: "Transaction already claimed by another wallet." }, 409);
    }
    return json({ ok: false, error: insertError.message || "Could not record payment." }, 500);
  }

  const tier = planToTier(plan);
  const entitlement = await grantWalletTier({
    address: session.address,
    tier,
    durationDays: 30,
  });

  return json({
    ok: true,
    plan,
    tier,
    walletAddress: session.address,
    tierStartedAt: entitlement.startedAt,
    tierExpiresAt: entitlement.expiresAt,
  });
}
