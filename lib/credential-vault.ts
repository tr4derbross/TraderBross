/**
 * Server-side credential vault — AES-256-CBC encrypted in-memory store.
 *
 * Keys are NEVER returned to the browser after the initial POST.
 * The browser holds only a short-lived UUID session token.
 *
 * Limitations of this implementation:
 *   - In-memory only → clears on server restart / serverless cold-start.
 *   - For multi-instance deployments, swap the Map for an encrypted Redis store.
 */

import crypto from "crypto";

export type StoredCredentials = {
  venueId: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
};

type VaultEntry = {
  ciphertext: Buffer;
  iv: Buffer;
  key: Buffer;          // per-entry random AES-256 key (never leaves server)
  expiresAt: number;
};

/** Session TTL: 8 hours — force re-entry on long-lived sessions */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Hard cap to prevent unbounded memory growth */
const VAULT_MAX_ENTRIES = 10_000;

const vault = new Map<string, VaultEntry>();

/** Sweep expired entries every 10 minutes */
setInterval(
  () => {
    const now = Date.now();
    for (const [token, entry] of vault.entries()) {
      if (entry.expiresAt < now) vault.delete(token);
    }
  },
  10 * 60 * 1000
).unref?.(); // don't block process exit in Node.js

/* ── Store ─────────────────────────────────────────────────────────────────── */

export function storeCredentials(creds: StoredCredentials): string {
  // Evict oldest entries if vault is at capacity
  if (vault.size >= VAULT_MAX_ENTRIES) {
    const oldest = [...vault.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) vault.delete(oldest[0]);
  }

  // 256-bit random token (more entropy than UUID's 122 bits)
  const token = crypto.randomBytes(32).toString("hex");
  const key   = crypto.randomBytes(32); // 256-bit key per session
  const iv    = crypto.randomBytes(16);

  const plaintext = JSON.stringify(creds);
  const cipher    = crypto.createCipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  vault.set(token, { ciphertext, iv, key, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

/* ── Retrieve ───────────────────────────────────────────────────────────────── */

export function retrieveCredentials(token: string): StoredCredentials | null {
  const entry = vault.get(token);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    vault.delete(token);
    return null;
  }

  try {
    const decipher  = crypto.createDecipheriv("aes-256-cbc", entry.key, entry.iv);
    const plaintext = Buffer.concat([
      decipher.update(entry.ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as StoredCredentials;
  } catch {
    vault.delete(token); // corrupted entry — remove it
    return null;
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

export function clearCredentials(token: string): void {
  vault.delete(token);
}

export function hasCredentials(token: string): boolean {
  const entry = vault.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    vault.delete(token);
    return false;
  }
  return true;
}

/** Replace credentials for an existing token (e.g. user updates keys). */
export function rotateCredentials(
  token: string,
  creds: StoredCredentials
): boolean {
  if (!hasCredentials(token)) return false;
  const existing = vault.get(token)!;

  const key  = crypto.randomBytes(32);
  const iv   = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(creds), "utf8"),
    cipher.final(),
  ]);

  vault.set(token, { ciphertext, iv, key, expiresAt: existing.expiresAt });
  return true;
}
