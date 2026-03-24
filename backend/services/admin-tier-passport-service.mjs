import crypto from "node:crypto";

const PASSPORT_TTL_HOURS = Math.max(1, Math.min(72, Number(process.env.ADMIN_TIER_PASSPORT_TTL_HOURS || 12) || 12));

function normalizeTier(value) {
  const tier = String(value || "").toLowerCase();
  return tier === "dex" || tier === "full" ? tier : "free";
}

function getPassportCode() {
  return String(process.env.ADMIN_TIER_PASSPORT_CODE || "").trim();
}

function getSigningKey() {
  return String(process.env.ADMIN_TIER_PASSPORT_SIGNING_KEY || process.env.PROXY_SHARED_SECRET || "").trim();
}

function isConfigured() {
  return Boolean(getPassportCode() && getSigningKey());
}

function safeEquals(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signPayload(encodedPayload) {
  return crypto.createHmac("sha256", getSigningKey()).update(encodedPayload).digest("base64url");
}

export function verifyAdminTierPassportCode(code) {
  const expected = getPassportCode();
  if (!expected) return false;
  return safeEquals(code, expected);
}

export function issueTierPassportToken(tier) {
  const normalizedTier = normalizeTier(tier);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + PASSPORT_TTL_HOURS * 60 * 60;
  const payload = {
    v: 1,
    tier: normalizedTier,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    tier: normalizedTier,
    expiresAt,
  };
}

export function validateTierPassportToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expectedSig = signPayload(encodedPayload);
  if (!safeEquals(signature, expectedSig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const exp = Number(payload?.exp || 0);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
    const tier = normalizeTier(payload?.tier);
    return {
      tier,
      expiresAt: exp,
      issuedAt: Number(payload?.iat || 0),
    };
  } catch {
    return null;
  }
}

export function isTierPassportConfigured() {
  return isConfigured();
}
