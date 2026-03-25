import crypto from "node:crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

const FALLBACK_TTL_MS = 10 * 60 * 1000;
const fallbackUsedNonceStore = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

function nonceHash(address: string, nonce: string) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeAddress(address)}:${String(nonce || "").trim()}`)
    .digest("hex");
}

function cleanupFallbackStore() {
  const now = nowMs();
  for (const [key, expiresAt] of fallbackUsedNonceStore.entries()) {
    if (!expiresAt || expiresAt <= now) {
      fallbackUsedNonceStore.delete(key);
    }
  }
}

function consumeFallback(address: string, nonce: string, ttlMs: number) {
  cleanupFallbackStore();
  const key = nonceHash(address, nonce);
  const existing = fallbackUsedNonceStore.get(key);
  if (existing && existing > nowMs()) {
    return false;
  }
  fallbackUsedNonceStore.set(key, nowMs() + Math.max(1_000, ttlMs));
  return true;
}

export async function consumeWalletNonceOnce({
  address,
  nonce,
  issuedAt,
}: {
  address: string;
  nonce: string;
  issuedAt?: string;
}) {
  const normalizedAddress = normalizeAddress(address);
  const normalizedNonce = String(nonce || "").trim();
  if (!normalizedAddress || !normalizedNonce) return false;

  const issuedAtMs = issuedAt ? new Date(issuedAt).getTime() : nowMs();
  const ttlMs = Number.isFinite(issuedAtMs)
    ? Math.max(1_000, FALLBACK_TTL_MS - Math.max(0, nowMs() - issuedAtMs))
    : FALLBACK_TTL_MS;

  if (!hasSupabaseAdminEnv()) {
    return consumeFallback(normalizedAddress, normalizedNonce, ttlMs);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const expiresAtIso = new Date(nowMs() + ttlMs).toISOString();
    const { error } = await supabase.from("wallet_used_nonces").insert({
      nonce_hash: nonceHash(normalizedAddress, normalizedNonce),
      wallet_address: normalizedAddress,
      used_at: new Date().toISOString(),
      expires_at: expiresAtIso,
    });

    if (!error) return true;
    const message = String(error.message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return false;
    }
    return consumeFallback(normalizedAddress, normalizedNonce, ttlMs);
  } catch {
    return consumeFallback(normalizedAddress, normalizedNonce, ttlMs);
  }
}
