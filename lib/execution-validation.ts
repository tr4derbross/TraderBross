import type { ActiveVenueState } from "@/lib/active-venue";
import type { MarginMode, OrderType, Side } from "@/hooks/useTradingState";
import type { VenueAdapter } from "@/lib/venues/types";

export type ExecutionValidationInput = {
  ticker: string;
  side: Side;
  type: OrderType;
  marginAmount: number;
  leverage: number;
  marginMode: MarginMode;
  limitPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  balance: number;
};

export type ExecutionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateExecutionRequest(
  activeVenueState: ActiveVenueState,
  adapter: VenueAdapter,
  input: ExecutionValidationInput
): ExecutionValidationResult {
  if (!input.ticker?.trim()) {
    return { ok: false, message: "Select a symbol before submitting." };
  }

  if (activeVenueState.connectionStatus !== "connected") {
    return {
      ok: false,
      message: `${activeVenueState.venueId.toUpperCase()} must be connected before trading.`,
    };
  }

  if (!adapter.supportsOrderPlacement) {
    return {
      ok: false,
      message: `${adapter.id.toUpperCase()} order placement is not enabled yet.`,
    };
  }

  if (!Number.isFinite(input.marginAmount) || input.marginAmount <= 0) {
    return { ok: false, message: "Enter a valid margin amount." };
  }

  if (input.marginAmount > input.balance) {
    return { ok: false, message: "Margin exceeds available balance." };
  }

  if (!Number.isFinite(input.leverage) || input.leverage < 1 || input.leverage > 100) {
    return { ok: false, message: "Leverage must stay between 1x and 100x." };
  }

  if ((input.type === "limit" || input.type === "stop") && (!input.limitPrice || input.limitPrice <= 0)) {
    return { ok: false, message: "Set a valid trigger price." };
  }

  if (!["isolated", "cross"].includes(input.marginMode)) {
    return { ok: false, message: "Select a valid margin mode." };
  }

  if (
    input.tpPrice !== undefined &&
    ((input.side === "long" && input.tpPrice <= (input.limitPrice || 0) && input.type !== "market") ||
      (input.side === "short" && input.tpPrice >= (input.limitPrice || 0) && input.type !== "market"))
  ) {
    return { ok: false, message: "Take-profit level is invalid for the selected side." };
  }

  return { ok: true };
}
