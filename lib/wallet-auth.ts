import crypto from "node:crypto";

export type WalletTier = "free" | "dex" | "full";

const NONCE_COOKIE = "tb_wallet_nonce";
const SESSION_COOKIE = "tb_wallet_session";
const NONCE_TTL_SECONDS = 60 * 10; // 10 min
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getSecret() {
  return String(process.env.WALLET_AUTH_SECRET || "").trim();
}

function assertSecret() {
  const secret = getSecret();
  if (!secret) throw new Error("Missing WALLET_AUTH_SECRET.");
  return secret;
}

function b64UrlEncode(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function b64UrlDecode(input: string) {
  return Buffer.from(String(input || ""), "base64url").toString("utf8");
}

function sign(payloadB64: string) {
  const secret = assertSecret();
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function createToken(payload: Record<string, unknown>) {
  const encoded = b64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  if (!token || typeof token !== "string") return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const expected = sign(payloadB64);
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(signature);
  if (expectedBuf.length !== gotBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, gotBuf)) return null;
  try {
    return JSON.parse(b64UrlDecode(payloadB64)) as T;
  } catch {
    return null;
  }
}

export function getWalletNonceCookieName() {
  return NONCE_COOKIE;
}

export function getWalletSessionCookieName() {
  return SESSION_COOKIE;
}

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

export function generateWalletNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export function buildWalletSignMessage(
  address: string,
  nonce: string,
  origin: string,
  issuedAt?: string,
) {
  const now = issuedAt || new Date().toISOString();
  return [
    "TraderBross Wallet Login",
    "",
    "Sign this message to authenticate with TraderBross.",
    `Address: ${normalizeAddress(address)}`,
    `Nonce: ${nonce}`,
    `URI: ${origin}`,
    `Issued At: ${now}`,
  ].join("\n");
}

export function issueWalletNonceToken(address: string, nonce: string, issuedAt?: string) {
  const issuedAtValue = issuedAt || new Date().toISOString();
  return createToken({
    typ: "wallet_nonce",
    adr: normalizeAddress(address),
    nonce,
    iat: issuedAtValue,
    exp: nowSeconds() + NONCE_TTL_SECONDS,
  });
}

export function verifyWalletNonceToken(token: string) {
  const payload = verifyToken<{ typ?: string; adr?: string; nonce?: string; iat?: string; exp?: number }>(token);
  if (!payload || payload.typ !== "wallet_nonce") return null;
  const exp = Number(payload.exp || 0);
  if (!Number.isFinite(exp) || exp <= nowSeconds()) return null;
  const address = normalizeAddress(String(payload.adr || ""));
  const nonce = String(payload.nonce || "");
  const issuedAt = String(payload.iat || "");
  if (!address || !nonce || !issuedAt) return null;
  return { address, nonce, issuedAt };
}

export function issueWalletSessionToken(address: string) {
  return createToken({
    typ: "wallet_session",
    adr: normalizeAddress(address),
    exp: nowSeconds() + SESSION_TTL_SECONDS,
    iat: nowSeconds(),
  });
}

export function verifyWalletSessionToken(token: string) {
  const payload = verifyToken<{ typ?: string; adr?: string; exp?: number }>(token);
  if (!payload || payload.typ !== "wallet_session") return null;
  const exp = Number(payload.exp || 0);
  if (!Number.isFinite(exp) || exp <= nowSeconds()) return null;
  const address = normalizeAddress(String(payload.adr || ""));
  if (!address) return null;
  return { address };
}

export function getWalletSessionMaxAgeSeconds() {
  return SESSION_TTL_SECONDS;
}

export function getWalletNonceMaxAgeSeconds() {
  return NONCE_TTL_SECONDS;
}
