import { fetchJson } from "../../services/http.mjs";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const asNum = Number(value);
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000;
    return new Date(ms).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeSide(value) {
  const side = String(value || "").toLowerCase();
  return side === "long" || side === "buy" ? "bullish" : "bearish";
}

function normalizeEvent(row, index = 0) {
  const symbolRaw = String(row?.symbol || row?.pair || row?.coin || "").toUpperCase();
  const token = symbolRaw.replace(/[-_/]?USDT$|[-_/]?USDC$|-USD$/i, "");
  const price = toNumber(row?.price || row?.liquidationPrice || row?.avgPrice);
  const qty = toNumber(row?.amount || row?.size || row?.qty || row?.contracts);
  const usdValue = toNumber(row?.amountUsd || row?.usd || row?.value || row?.notional) || qty * price;
  if (!token || !Number.isFinite(usdValue) || usdValue <= 0) return null;
  const ts = row?.ts || row?.timestamp || row?.time || row?.createdAt;
  const iso = toIso(ts);
  return {
    id: `coinglass-liq-${token}-${Date.parse(iso)}-${index}`,
    token,
    amount: qty,
    usdValue,
    fromLabel: "Coinglass Liquidation",
    fromOwnerType: "derivatives",
    toLabel: "Liquidated",
    toOwnerType: "derivatives",
    txHash: null,
    chain: "coinglass",
    eventType: "liquidation",
    sentiment: normalizeSide(row?.side || row?.positionSide),
    timestamp: iso,
    provider: "coinglass_liquidations",
    rawText: `${symbolRaw || token} liquidation @ ${price || "n/a"}`,
    price: price || null,
  };
}

export async function fetchCoinGlassLiquidationEvents({
  apiKey = "",
  minUsd = 25_000,
  limit = 50,
} = {}) {
  if (!apiKey) return [];

  const endpoint = `https://open-api-v4.coinglass.com/api/futures/liquidation/order?limit=${Math.max(
    10,
    Math.min(200, Number(limit) || 50),
  )}`;

  const payload = await fetchJson(endpoint, {
    timeoutMs: 8000,
    headers: { "CG-API-KEY": String(apiKey) },
  });

  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.list)
      ? payload.data.list
      : Array.isArray(payload?.list)
        ? payload.list
        : [];

  return rows
    .map((row, idx) => normalizeEvent(row, idx))
    .filter(Boolean)
    .filter((event) => event.usdValue >= Number(minUsd || 0))
    .slice(0, 80);
}

