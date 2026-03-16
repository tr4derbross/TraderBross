// Client-side Hyperliquid EIP-712 order signing (MetaMask)
// Ref: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing

export interface HLSig { r: string; s: string; v: number }

/**
 * TraderBross builder fee configuration.
 * Set NEXT_PUBLIC_HL_BUILDER_ADDRESS in your .env to your registered HL builder address.
 * Fee unit: tenths of a basis point. 1 = 0.1 bps = 0.001% per trade (max 100 = 10 bps).
 */
const BUILDER_ADDRESS = process.env.NEXT_PUBLIC_HL_BUILDER_ADDRESS ?? "";
const BUILDER_FEE     = Number(process.env.NEXT_PUBLIC_HL_BUILDER_FEE ?? "1"); // default 0.1 bps

/** Returns builder field only when address is configured. */
function builderField() {
  if (!BUILDER_ADDRESS) return undefined;
  return { b: BUILDER_ADDRESS, f: BUILDER_FEE };
}

export async function signHLAction(
  action: object,
  nonce: number,
  vaultAddress?: string
): Promise<HLSig> {
  const [{ ethers }, { encode }] = await Promise.all([
    import("ethers"),
    import("@msgpack/msgpack"),
  ]);

  if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask.");

  // Compute connectionId = keccak256(msgpack(action) + nonce_be8 [+ vaultAddr])
  const packed = encode(action);
  const nonceArr = new Uint8Array(8);
  new DataView(nonceArr.buffer).setBigUint64(0, BigInt(nonce), false); // big-endian

  const parts: Uint8Array[] = [packed, nonceArr];
  if (vaultAddress) parts.push(ethers.getBytes(vaultAddress));

  const combined = new Uint8Array(parts.reduce((acc, p) => acc + p.length, 0));
  let offset = 0;
  for (const p of parts) { combined.set(p, offset); offset += p.length; }

  const connectionId = ethers.keccak256(combined);

  // EIP-712 typed data sign
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const domain = {
    chainId: 1337,               // Hyperliquid mainnet chain ID
    name: "Exchange",
    version: "1",
    verifyingContract: "0x0000000000000000000000000000000000000000",
  };

  const types = {
    Agent: [
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ],
  };

  const raw = await signer.signTypedData(domain, types, {
    source: "a",   // "a" = mainnet, "b" = testnet
    connectionId,
  });

  const sig = ethers.Signature.from(raw);
  return { r: sig.r, s: sig.s, v: sig.v };
}

export function buildMarketOrder(
  assetIndex: number,
  isBuy: boolean,
  size: number
) {
  return {
    type: "order",
    orders: [{
      a: assetIndex,
      b: isBuy,
      p: "0",             // market price
      s: size.toString(),
      r: false,           // reduceOnly
      t: { limit: { tif: "Ioc" } }, // IOC ≈ market
    }],
    grouping: "na",
    ...(builderField() && { builder: builderField() }),
  };
}

export function buildLimitOrder(
  assetIndex: number,
  isBuy: boolean,
  size: number,
  price: number
) {
  return {
    type: "order",
    orders: [{
      a: assetIndex,
      b: isBuy,
      p: price.toString(),
      s: size.toString(),
      r: false,
      t: { limit: { tif: "Gtc" } }, // GTC for limit
    }],
    grouping: "na",
    ...(builderField() && { builder: builderField() }),
  };
}
