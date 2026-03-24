const HYPER_BUILDER_ADDRESS = String(process.env.HYPERLIQUID_BUILDER_ADDRESS || "").trim().toLowerCase();
const HYPER_BUILDER_FEE_TENTHS_BPS = Math.max(
  0,
  Math.min(1000, Number(process.env.HYPERLIQUID_BUILDER_FEE_TENTHS_BPS || 10) || 0),
);

const ASTER_BUILDER_ADDRESS = String(process.env.ASTER_BUILDER_ADDRESS || "").trim();
const ASTER_BUILDER_FEE_RATE = String(process.env.ASTER_BUILDER_FEE_RATE || "").trim();
const ASTER_REFERRAL_URL = String(process.env.NEXT_PUBLIC_ASTER_REFERRAL_URL || "").trim();

function isHexAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function parseNumericValue(payload) {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.maxBuilderFee,
    payload.maxFee,
    payload.fee,
    payload.maxBuilderFeeRate,
    payload.response,
    payload.data,
  ];
  for (const candidate of candidates) {
    const parsed = parseNumericValue(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

export async function getHyperliquidApprovedMaxBuilderFee({ userAddress, timeoutMs = 5_000 }) {
  if (!isHexAddress(userAddress) || !isHexAddress(HYPER_BUILDER_ADDRESS)) return null;
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "maxBuilderFee",
      user: userAddress,
      builder: HYPER_BUILDER_ADDRESS,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return null;
  const value = parseNumericValue(payload);
  return value != null ? value : null;
}

export async function attachHyperliquidBuilderCode(action, { userAddress }) {
  if (!action || action.type !== "order") return action;
  if (!isHexAddress(userAddress)) return action;
  if (!isHexAddress(HYPER_BUILDER_ADDRESS) || HYPER_BUILDER_FEE_TENTHS_BPS <= 0) return action;
  try {
    const maxApproved = await getHyperliquidApprovedMaxBuilderFee({ userAddress });
    if (maxApproved == null || maxApproved < HYPER_BUILDER_FEE_TENTHS_BPS) return action;
    return {
      ...action,
      builder: {
        b: HYPER_BUILDER_ADDRESS,
        f: HYPER_BUILDER_FEE_TENTHS_BPS,
      },
    };
  } catch {
    return action;
  }
}

export function getTier2RevenuePublicConfig() {
  return {
    hyperliquid: {
      builderEnabled: isHexAddress(HYPER_BUILDER_ADDRESS) && HYPER_BUILDER_FEE_TENTHS_BPS > 0,
      builderAddress: isHexAddress(HYPER_BUILDER_ADDRESS) ? HYPER_BUILDER_ADDRESS : "",
      feeTenthsBps: HYPER_BUILDER_FEE_TENTHS_BPS,
    },
    aster: {
      referralEnabled: ASTER_REFERRAL_URL.length > 0,
      referralUrl: ASTER_REFERRAL_URL,
      asterCodeReady: ASTER_BUILDER_ADDRESS.length > 0 && ASTER_BUILDER_FEE_RATE.length > 0,
      builderAddress: ASTER_BUILDER_ADDRESS,
      builderFeeRate: ASTER_BUILDER_FEE_RATE,
    },
  };
}
