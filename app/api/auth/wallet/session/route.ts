import { NextRequest, NextResponse } from "next/server";
import { getWalletSessionCookieName, verifyWalletSessionToken } from "@/lib/wallet-auth";
import { getWalletTier } from "@/lib/wallet-subscriptions";

function json(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getWalletSessionCookieName())?.value || "";
  const session = verifyWalletSessionToken(token);
  if (!session) {
    return json({ ok: true, authenticated: false, tier: "free" });
  }

  const tier = await getWalletTier(session.address);
  return json({
    ok: true,
    authenticated: true,
    walletAddress: session.address,
    tier: tier.tier,
    tierExpiresAt: tier.expiresAt,
  });
}

