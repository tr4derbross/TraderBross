const ACCESS_COOKIE_NAME = "tb_site_access";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const UNLOCK_ALL_TIERS_IN_PRIVATE_MODE = process.env.SITE_ACCESS_UNLOCK_ALL_TIERS === "true";

function getAccessPassword() {
  return String(process.env.SITE_ACCESS_PASSWORD || "").trim();
}

function getAccessSecret() {
  return String(process.env.SITE_ACCESS_SECRET || process.env.SITE_ACCESS_PASSWORD || "").trim();
}

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function constantTimeEqual(a: string, b: string) {
  const left = String(a || "");
  const right = String(b || "");
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let i = 0; i < maxLength; i += 1) {
    const l = i < leftBytes.length ? leftBytes[i] : 0;
    const r = i < rightBytes.length ? rightBytes[i] : 0;
    diff |= l ^ r;
  }
  return diff === 0;
}

async function signPayload(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAccessSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export function isSiteAccessEnabled() {
  return Boolean(getAccessPassword() && getAccessSecret());
}

export function shouldUnlockAllTiersInPrivateMode() {
  return UNLOCK_ALL_TIERS_IN_PRIVATE_MODE;
}

export function getSiteAccessCookieName() {
  return ACCESS_COOKIE_NAME;
}

export function getSiteAccessPassword() {
  return getAccessPassword();
}

export function isSiteAccessPasswordMatch(candidate: string) {
  return constantTimeEqual(String(candidate || ""), getAccessPassword());
}

export async function issueSiteAccessToken(ttlSeconds = DEFAULT_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds);
  const payload = `tb_access:${exp}`;
  const signature = await signPayload(payload);
  return `${exp}.${signature}`;
}

export async function verifySiteAccessToken(token: string) {
  if (!token || typeof token !== "string") return false;
  const [expRaw, signatureRaw] = token.split(".");
  const exp = Number(expRaw || 0);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  try {
    // Normalize base64url input shape before compare.
    const normalizedSig = toBase64Url(fromBase64Url(String(signatureRaw || "")));
    const expectedSig = await signPayload(`tb_access:${exp}`);
    return constantTimeEqual(normalizedSig, expectedSig);
  } catch {
    return false;
  }
}
