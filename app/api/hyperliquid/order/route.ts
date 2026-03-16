import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import crypto from "crypto";
import { retrieveCredentials } from "@/lib/credential-vault";
import { encode } from "@msgpack/msgpack";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const IS_PROD = process.env.NODE_ENV === "production";

// ─── Input validation constants ───────────────────────────────────────────────
const VALID_TYPES     = new Set(["order", "cancel", "leverage", "marginMode"]);
const VALID_SIDES     = new Set(["long", "short"]);
const VALID_ORDER_TYPES = new Set(["market", "limit", "stop"]);
/** Hyperliquid asset symbol: 1-10 uppercase letters/numbers */
const SYMBOL_RE = /^[A-Z0-9]{1,10}$/;

const HL_EXCHANGE = "https://api.hyperliquid.xyz/exchange";
const HL_INFO     = "https://api.hyperliquid.xyz/info";

// ─── EIP-712 domain & types ───────────────────────────────────────────────────
const HL_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

const AGENT_TYPES = {
  Agent: [
    { name: "source",       type: "string"  },
    { name: "connectionId", type: "bytes32" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** msgpack(action) || nonce_big_endian_8_bytes || vault_flag_1_byte */
function hashAction(action: Record<string, unknown>, nonce: number, vaultAddress?: string): string {
  const packed = encode(action);
  const data   = new Uint8Array(packed.length + 9);
  data.set(packed, 0);
  new DataView(data.buffer).setBigUint64(packed.length, BigInt(nonce), false); // big-endian
  data[packed.length + 8] = vaultAddress ? 1 : 0;
  return ethers.keccak256(data);
}

async function signAction(
  wallet: ethers.Wallet,
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): Promise<{ r: string; s: string; v: number }> {
  const connectionId = hashAction(action, nonce, vaultAddress);
  const raw = await wallet.signTypedData(HL_DOMAIN, AGENT_TYPES, {
    source: "a",
    connectionId,
  });
  const sig = ethers.Signature.from(raw);
  return { r: sig.r, s: sig.s, v: sig.v };
}

/** Format number for Hyperliquid wire format (up to 6 significant figures, no trailing zeros) */
function floatToWire(x: number): string {
  if (x === 0) return "0";
  const s = parseFloat(x.toPrecision(6)).toString();
  return s.includes("e") ? x.toFixed(8).replace(/\.?0+$/, "") : s;
}

// ─── Meta cache (30 s) ────────────────────────────────────────────────────────
let metaCache: { data: HLMeta; ts: number } | null = null;

interface HLMeta {
  universe: Array<{ name: string; szDecimals: number; maxLeverage: number }>;
}

async function getMeta(): Promise<HLMeta> {
  if (metaCache && Date.now() - metaCache.ts < 30_000) return metaCache.data;
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HL meta ${res.status}`);
  const data: HLMeta = await res.json();
  metaCache = { data, ts: Date.now() };
  return data;
}

async function getAssetInfo(symbol: string) {
  const meta = await getMeta();
  const idx  = meta.universe.findIndex((a) => a.name === symbol);
  if (idx === -1) throw new Error(`${symbol} not found on Hyperliquid`);
  return { index: idx, szDecimals: meta.universe[idx].szDecimals, maxLeverage: meta.universe[idx].maxLeverage };
}

async function getMarkPrice(symbol: string): Promise<number> {
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HL ctxs ${res.status}`);
  const [meta, ctxs]: [HLMeta, Array<{ markPx: string }>] = await res.json();
  const idx = meta.universe.findIndex((a) => a.name === symbol);
  if (idx === -1 || !ctxs[idx]) throw new Error(`No mark price for ${symbol}`);
  return parseFloat(ctxs[idx].markPx);
}

async function submitToHL(
  action: Record<string, unknown>,
  wallet: ethers.Wallet,
  nonce: number,
) {
  const sig = await signAction(wallet, action, nonce);
  const res = await fetch(HL_EXCHANGE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, nonce, signature: sig }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json() as { status: string; response?: unknown };
  if (data.status === "err") {
    const msg = typeof data.response === "string" ? data.response : JSON.stringify(data.response);
    throw new Error(msg || "Rejected by Hyperliquid");
  }
  return data;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Rate limit: 10 orders per minute per IP ─────────────────────────────────
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`hl-order:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before submitting another order." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Validate action type early ───────────────────────────────────────────────
  const { type } = body as { type: unknown };
  if (typeof type !== "string" || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
  }

  // Resolve the private key: env var takes precedence, then vault session token
  let resolvedPrivateKey: string | undefined = process.env.HL_PRIVATE_KEY;

  if (!resolvedPrivateKey) {
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : undefined;
    if (sessionToken) {
      const creds = retrieveCredentials(sessionToken);
      if (creds?.apiKey) {
        resolvedPrivateKey = creds.apiKey;
      }
    }
  }

  if (!resolvedPrivateKey) {
    return NextResponse.json(
      { error: "No Hyperliquid signing key available. Set HL_PRIVATE_KEY or provide a vault session token." },
      { status: 503 },
    );
  }

  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(
      resolvedPrivateKey.startsWith("0x") ? resolvedPrivateKey : `0x${resolvedPrivateKey}`
    );
  } catch {
    return NextResponse.json({ error: "Invalid Hyperliquid private key." }, { status: 500 });
  }

  try {
    // Nonce: milliseconds + small random offset to avoid collisions
    const nonce = Date.now() + crypto.randomInt(0, 999);

    // ── Place order ──────────────────────────────────────────────────────────
    if (type === "order") {
      const { symbol, side, orderType, marginAmount, leverage, limitPrice } = body as {
        symbol: string;
        side: "long" | "short";
        orderType: "market" | "limit" | "stop";
        marginAmount: number;
        leverage: number;
        limitPrice?: number;
      };

      // Validate inputs
      if (!symbol || !SYMBOL_RE.test(symbol)) throw new Error("Invalid symbol.");
      if (!VALID_SIDES.has(side)) throw new Error("Invalid side.");
      if (!VALID_ORDER_TYPES.has(orderType)) throw new Error("Invalid order type.");
      if (!Number.isFinite(marginAmount) || marginAmount <= 0 || marginAmount > 10_000_000)
        throw new Error("marginAmount must be between 0 and 10,000,000.");
      if (!Number.isFinite(leverage) || leverage < 1 || leverage > 100)
        throw new Error("Leverage must be between 1 and 100.");
      if ((orderType === "limit" || orderType === "stop") && (!limitPrice || !Number.isFinite(limitPrice) || limitPrice <= 0))
        throw new Error("Limit price required and must be positive.");

      const asset     = await getAssetInfo(symbol);
      const markPrice = await getMarkPrice(symbol);

      let execPrice: number;
      let tif: string;

      if (orderType === "market") {
        // 3 % slippage → guaranteed fill under normal conditions
        execPrice = side === "long" ? markPrice * 1.03 : markPrice * 0.97;
        tif = "Ioc";
      } else {
        if (!limitPrice || limitPrice <= 0) throw new Error("Limit price required");
        execPrice = limitPrice;
        tif = "Gtc";
      }

      const rawSize   = (marginAmount * leverage) / markPrice;
      const szFactor  = Math.pow(10, asset.szDecimals);
      const roundedSz = Math.floor(rawSize * szFactor) / szFactor;
      if (roundedSz <= 0) throw new Error("Size too small");

      const action: Record<string, unknown> = {
        type: "order",
        orders: [{
          a: asset.index,
          b: side === "long",
          p: floatToWire(execPrice),
          s: roundedSz.toFixed(asset.szDecimals),
          r: false,
          t: { limit: { tif } },
        }],
        grouping: "na",
      };

      const result = await submitToHL(action, wallet, nonce);
      return NextResponse.json({ ok: true, data: result });
    }

    // ── Cancel order ─────────────────────────────────────────────────────────
    if (type === "cancel") {
      const { symbol, orderId } = body as { symbol: string; orderId: number };
      if (!symbol || !SYMBOL_RE.test(symbol)) throw new Error("Invalid symbol.");
      if (!Number.isInteger(orderId) || orderId <= 0) throw new Error("Invalid orderId.");
      const asset  = await getAssetInfo(symbol);
      const action = { type: "cancel", cancels: [{ a: asset.index, o: orderId }] };
      const result = await submitToHL(action, wallet, nonce);
      return NextResponse.json({ ok: true, data: result });
    }

    // ── Update leverage ───────────────────────────────────────────────────────
    if (type === "leverage") {
      const { symbol, leverage, isCross } = body as { symbol: string; leverage: number; isCross?: boolean };
      if (!symbol || !SYMBOL_RE.test(symbol)) throw new Error("Invalid symbol.");
      if (!Number.isFinite(leverage) || leverage < 1 || leverage > 100) throw new Error("Leverage must be between 1 and 100.");
      const asset  = await getAssetInfo(symbol);
      const lev    = Math.max(1, Math.min(Math.round(leverage), asset.maxLeverage));
      const action = { type: "updateLeverage", asset: asset.index, isCross: !!isCross, leverage: lev };
      const result = await submitToHL(action, wallet, nonce);
      return NextResponse.json({ ok: true, data: result });
    }

    // ── Update margin mode ────────────────────────────────────────────────────
    if (type === "marginMode") {
      const { symbol, isCross, leverage } = body as { symbol: string; isCross: boolean; leverage?: number };
      if (!symbol || !SYMBOL_RE.test(symbol)) throw new Error("Invalid symbol.");
      if (typeof isCross !== "boolean") throw new Error("isCross must be a boolean.");
      const asset  = await getAssetInfo(symbol);
      const action = {
        type:     "updateLeverage",
        asset:    asset.index,
        isCross:  !!isCross,
        leverage: Math.max(1, Math.min(Math.round(leverage ?? 1), asset.maxLeverage)),
      };
      const result = await submitToHL(action, wallet, nonce);
      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Order failed";
    console.error("HL order:", errMsg);
    return NextResponse.json(
      { error: IS_PROD ? "Order processing failed. Please try again." : errMsg },
      { status: 500 },
    );
  }
}
