import type { TradingVenueId, TradingVenueType } from "@/lib/active-venue";

export type VenueTicker = {
  symbol: string;
  price: number;
  sourceLabel: string;
  timestamp: number;
};

export type VenueBalance = {
  total: number;
  available?: number;
  currency?: string;
};

export type VenuePosition = {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  breakEvenPrice?: number;
  markPrice?: number;
  pnl?: number;
  liquidationPrice?: number | null;
  leverage?: number;
  margin?: number;
  marginRatio?: number;
  estimatedFundingFee?: number;
  marginMode?: "isolated" | "cross";
  tpPrice?: number;
  slPrice?: number;
};

export type VenueConnectionInput = {
  /**
   * Preferred for CEX venues: server-side vault session token.
   * When present, the server looks up credentials itself — raw keys
   * never travel the wire after the initial /api/vault/store call.
   */
  sessionToken?: string;
  /** CEX raw credentials (fallback / initial setup only) */
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  /** DEX wallet */
  walletAddress?: string;
  walletProvider?: string;
};

export type VenueConnectionTestResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

export type VenueOrderInput = {
  symbol: string;
  side: "long" | "short";
  type: "market" | "limit" | "stop";
  size?: number;
  marginAmount?: number;
  leverage?: number;
  marginMode?: "isolated" | "cross";
  limitPrice?: number;
  tpPrice?: number;
  slPrice?: number;
};

export type VenueLeverageInput = {
  symbol: string;
  leverage: number;
};

export type VenueMarginModeInput = {
  symbol: string;
  marginMode: "isolated" | "cross";
};

export type VenueActionResult = {
  ok: boolean;
  message: string;
};

export type VenueAdapter = {
  id: TradingVenueId;
  venueType: TradingVenueType;
  marketDataLabel: string;
  supportsOrderPlacement: boolean;
  getTicker: (symbol: string) => Promise<VenueTicker | null>;
  subscribeTicker: (
    symbol: string,
    onTick: (ticker: VenueTicker) => void
  ) => Promise<() => void> | (() => void);
  getBalance: (connection?: VenueConnectionInput) => Promise<VenueBalance | null>;
  getPositions: (connection?: VenueConnectionInput) => Promise<VenuePosition[]>;
  placeOrder: (input: VenueOrderInput, connection?: VenueConnectionInput) => Promise<VenueActionResult>;
  cancelOrder: (orderId: string, connection?: VenueConnectionInput) => Promise<VenueActionResult>;
  setLeverage: (input: VenueLeverageInput, connection?: VenueConnectionInput) => Promise<VenueActionResult>;
  setMarginMode: (
    input: VenueMarginModeInput,
    connection?: VenueConnectionInput
  ) => Promise<VenueActionResult>;
  testConnection: (connection?: VenueConnectionInput) => Promise<VenueConnectionTestResult>;
};
