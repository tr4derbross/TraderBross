/**
 * dYdX v4 order building utilities for TraderBross.
 *
 * Revenue model:
 *   - Affiliate program: users who register via NEXT_PUBLIC_DYDX_AFFILIATE_ADDRESS
 *     earn us 15% of their taker fees (account-based, not per-order).
 *   - clientMetadata: encoded in every order so dYdX can attribute volume to
 *     TraderBross (used for potential future fee-sharing tiers).
 *
 * Real order execution requires Keplr STARK key signing — see dYdX v4 docs:
 * https://docs.dydx.exchange/developers/clients/javascript_client
 */

/** TraderBross client identifier embedded in every dYdX order (uint32). */
export const TRADERBROSS_CLIENT_METADATA = 8432; // arbitrary unique ID for TraderBross

/**
 * Affiliate address registered with dYdX.
 * Set NEXT_PUBLIC_DYDX_AFFILIATE_ADDRESS in .env to your dydx1... address.
 * New users who sign up via your referral link will credit 15% of their
 * taker fees to this address automatically.
 */
export const DYDX_AFFILIATE_ADDRESS =
  process.env.NEXT_PUBLIC_DYDX_AFFILIATE_ADDRESS ?? "";

/** Returns the referral URL for acquiring new users via the affiliate program. */
export function getDydxReferralUrl(): string | null {
  if (!DYDX_AFFILIATE_ADDRESS) return null;
  return `https://dydx.trade/r/${DYDX_AFFILIATE_ADDRESS}`;
}

export type DydxOrderSide = "BUY" | "SELL";
export type DydxOrderType = "MARKET" | "LIMIT";
export type DydxTimeInForce = "IOC" | "GTT" | "POST_ONLY";

export interface DydxOrderParams {
  market: string;          // e.g. "BTC-USD"
  side: DydxOrderSide;
  type: DydxOrderType;
  size: number;            // in base asset units
  price?: number;          // required for LIMIT orders
  leverage?: number;
  reduceOnly?: boolean;
}

/**
 * Builds a dYdX v4 order payload with TraderBross metadata embedded.
 * Pass this to the dYdX client SDK for STARK signing via Keplr.
 *
 * NOTE: Real execution requires importing @dydxprotocol/v4-client-js and
 * Keplr wallet signing — this is the prepared payload only.
 */
export function buildDydxOrder(params: DydxOrderParams) {
  const { market, side, type, size, price, reduceOnly = false } = params;

  const timeInForce: DydxTimeInForce =
    type === "MARKET" ? "IOC" : "GTT";

  return {
    market,
    side,
    type,
    size: size.toString(),
    price: price?.toString() ?? "0",
    timeInForce,
    reduceOnly,
    clientMetadata: TRADERBROSS_CLIENT_METADATA,
    // Affiliate address included for future fee-sharing attribution
    ...(DYDX_AFFILIATE_ADDRESS && { affiliateAddress: DYDX_AFFILIATE_ADDRESS }),
  };
}
