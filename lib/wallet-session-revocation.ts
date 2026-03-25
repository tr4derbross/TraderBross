import crypto from "node:crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { verifyWalletSessionToken } from "@/lib/wallet-auth";

const FALLBACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const revokedFallbackStore = new Map<string, number>();

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function cleanupFallback() {
  const now = Date.now();
  for (const [key, expiresAt] of revokedFallbackStore.entries()) {
    if (!expiresAt || expiresAt <= now) {
      revokedFallbackStore.delete(key);
    }
  }
}

function fallbackExpiryFromSession(token: string) {
  const payload = verifyWalletSessionToken(token);
  const expiryMs = payload?.exp ? Number(payload.exp) * 1000 : Date.now() + FALLBACK_TTL_MS;
  return Number.isFinite(expiryMs) ? Math.max(Date.now() + 1_000, expiryMs) : Date.now() + FALLBACK_TTL_MS;
}

function fallbackRevoke(token: string) {
  cleanupFallback();
  revokedFallbackStore.set(tokenHash(token), fallbackExpiryFromSession(token));
}

export async function revokeWalletSessionToken(token: string) {
  const value = String(token || "").trim();
  if (!value) return;

  if (!hasSupabaseAdminEnv()) {
    fallbackRevoke(value);
    return;
  }

  try {
    const session = verifyWalletSessionToken(value);
    const expiresAtIso = session?.exp
      ? new Date(Number(session.exp) * 1000).toISOString()
      : new Date(Date.now() + FALLBACK_TTL_MS).toISOString();
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("wallet_revoked_sessions").upsert(
      {
        token_hash: tokenHash(value),
        revoked_at: new Date().toISOString(),
        expires_at: expiresAtIso,
      },
      { onConflict: "token_hash" },
    );
    if (error) {
      fallbackRevoke(value);
    }
  } catch {
    fallbackRevoke(value);
  }
}

export async function isWalletSessionRevoked(token: string) {
  const value = String(token || "").trim();
  if (!value) return true;
  cleanupFallback();
  const hash = tokenHash(value);
  const fallbackExpiry = revokedFallbackStore.get(hash);
  if (fallbackExpiry && fallbackExpiry > Date.now()) {
    return true;
  }

  if (!hasSupabaseAdminEnv()) return false;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("wallet_revoked_sessions")
      .select("token_hash,expires_at")
      .eq("token_hash", hash)
      .maybeSingle<{ token_hash: string; expires_at: string | null }>();
    if (error || !data) return false;
    const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + FALLBACK_TTL_MS;
    return Number.isFinite(expiresAtMs) ? expiresAtMs > Date.now() : true;
  } catch {
    return false;
  }
}
