import crypto from "node:crypto";

const TTL_MS = Number(process.env.VAULT_SESSION_TTL_MS || 6 * 60 * 60 * 1000);
const revokedTokens = new Map();

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

function b64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function b64urlDecode(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function generateJti() {
  return crypto.randomBytes(12).toString("hex");
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
  return `v1.${b64urlEncode(iv)}.${b64urlEncode(tag)}.${b64urlEncode(ciphertext)}`;
}

function decryptPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, b64urlDecode(parts[1]));
  decipher.setAuthTag(b64urlDecode(parts[2]));
  const plaintext = Buffer.concat([decipher.update(b64urlDecode(parts[3])), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

function cleanupRevoked(now = Date.now()) {
  for (const [key, expiresAt] of revokedTokens.entries()) {
    if (!expiresAt || expiresAt <= now) {
      revokedTokens.delete(key);
    }
  }
}

export function storeSecret(scope, payload) {
  const createdAt = Date.now();
  const expiresAt = createdAt + TTL_MS;
  const encryptedToken = encryptPayload({
    v: 1,
    scope,
    payload,
    createdAt,
    expiresAt,
    jti: generateJti(),
  });
  return encryptedToken;
}

export function getSecret(token) {
  cleanupRevoked();
  const key = tokenHash(token);
  if (revokedTokens.has(key)) {
    return null;
  }

  try {
    const row = decryptPayload(token);
    if (!row || row.v !== 1 || !row.scope || !row.payload) return null;
    if (Number(row.expiresAt || 0) <= Date.now()) return null;
    return {
      scope: row.scope,
      payload: row.payload,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  } catch {
    return null;
  }
}

export function clearSecret(token) {
  const key = tokenHash(token);
  const row = getSecret(token);
  const expiresAt = Number(row?.expiresAt || Date.now() + TTL_MS);
  revokedTokens.set(key, expiresAt);
  return true;
}
