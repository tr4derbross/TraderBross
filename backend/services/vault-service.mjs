import crypto from "node:crypto";

const vault = new Map();

const TTL_MS = Number(process.env.VAULT_SESSION_TTL_MS || 6 * 60 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.VAULT_MAX_ENTRIES || 500);

function parseKey(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  // Accept 32-byte key as base64, hex, or raw string.
  if (/^[A-Fa-f0-9]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // ignore
  }

  if (value.length >= 32) {
    return crypto.createHash("sha256").update(value).digest();
  }

  return null;
}

const encryptionKey = parseKey(process.env.VAULT_ENCRYPTION_KEY) || crypto.randomBytes(32);

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}

function decryptPayload(record) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

function cleanupExpired(now = Date.now()) {
  for (const [key, value] of vault.entries()) {
    if (!value || value.expiresAt <= now) {
      vault.delete(key);
    }
  }
}

function enforceMaxEntries() {
  if (vault.size <= MAX_ENTRIES) return;
  const rows = Array.from(vault.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const toDelete = Math.max(0, rows.length - MAX_ENTRIES);
  for (let i = 0; i < toDelete; i += 1) {
    vault.delete(rows[i][0]);
  }
}

export function storeSecret(scope, payload) {
  cleanupExpired();
  const token = generateToken();
  const key = tokenHash(token);
  const createdAt = Date.now();

  vault.set(key, {
    scope,
    encrypted: encryptPayload(payload),
    createdAt,
    expiresAt: createdAt + TTL_MS,
  });

  enforceMaxEntries();
  return token;
}

export function getSecret(token) {
  const key = tokenHash(token);
  const row = vault.get(key);
  if (!row) return null;

  if (row.expiresAt <= Date.now()) {
    vault.delete(key);
    return null;
  }

  try {
    const payload = decryptPayload(row.encrypted);
    return {
      scope: row.scope,
      payload,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  } catch {
    vault.delete(key);
    return null;
  }
}

export function clearSecret(token) {
  const key = tokenHash(token);
  return vault.delete(key);
}