import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import type { WalletTier } from "@/lib/wallet-auth";

type WalletSubscriptionRow = {
  wallet_address: string;
  tier: WalletTier;
  started_at: string | null;
  expires_at: string | null;
  status: "active" | "expired" | "canceled";
};

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function getWalletSubscription(address: string) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }
  const walletAddress = normalizeAddress(address);
  if (!walletAddress) return null;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("wallet_subscriptions")
    .select("wallet_address,tier,started_at,expires_at,status")
    .eq("wallet_address", walletAddress)
    .maybeSingle<WalletSubscriptionRow>();
  return data || null;
}

export async function getWalletTier(address: string): Promise<{ tier: WalletTier; expiresAt: string | null; active: boolean }> {
  const row = await getWalletSubscription(address);
  if (!row) return { tier: "free", expiresAt: null, active: false };
  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
  const expired = typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
  if (row.status !== "active" || expired) {
    return { tier: "free", expiresAt: row.expires_at || null, active: false };
  }
  return { tier: row.tier, expiresAt: row.expires_at || null, active: true };
}

export async function grantWalletTier({
  address,
  tier,
  durationDays = 30,
}: {
  address: string;
  tier: WalletTier;
  durationDays?: number;
}) {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin env is missing.");
  }
  const walletAddress = normalizeAddress(address);
  if (!walletAddress) throw new Error("Invalid wallet address.");

  const supabase = createSupabaseAdminClient();
  const existing = await getWalletSubscription(walletAddress);
  const now = new Date();
  const existingExpiry =
    existing?.expires_at && Number.isFinite(new Date(existing.expires_at).getTime())
      ? new Date(existing.expires_at)
      : null;
  const base = existingExpiry && existingExpiry.getTime() > now.getTime() ? existingExpiry : now;
  const startedAt = existing?.started_at || now.toISOString();
  const expiresAt = addDays(base, Math.max(1, durationDays)).toISOString();

  const payload = {
    wallet_address: walletAddress,
    tier,
    status: "active" as const,
    started_at: startedAt,
    expires_at: expiresAt,
    updated_at: now.toISOString(),
  };

  const { error } = await supabase.from("wallet_subscriptions").upsert(payload, {
    onConflict: "wallet_address",
  });

  if (error) {
    throw new Error(error.message || "Could not update wallet subscription.");
  }

  return {
    walletAddress,
    tier,
    startedAt,
    expiresAt,
  };
}

