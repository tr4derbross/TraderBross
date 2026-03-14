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
  pnl?: number;
  liquidationPrice?: number | null;
};

export type VenueConnectionInput = {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
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
  limitPrice?: number;
  tpPrice?: number;
  slPrice?: number;
};

export type VenueAdapter = {
  id: TradingVenueId;
  venueType: TradingVenueType;
  marketDataLabel: string;
  getTicker: (symbol: string) => Promise<VenueTicker | null>;
  subscribeTicker: (
    symbol: string,
    onTick: (ticker: VenueTicker) => void
  ) => Promise<() => void> | (() => void);
  getBalance: (connection?: VenueConnectionInput) => Promise<VenueBalance | null>;
  getPositions: (connection?: VenueConnectionInput) => Promise<VenuePosition[]>;
  placeOrder: (input: VenueOrderInput, connection?: VenueConnectionInput) => Promise<{ ok: boolean; message: string }>;
  cancelOrder: (orderId: string, connection?: VenueConnectionInput) => Promise<{ ok: boolean; message: string }>;
  testConnection: (connection?: VenueConnectionInput) => Promise<VenueConnectionTestResult>;
};
