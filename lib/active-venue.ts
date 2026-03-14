export type TradingVenueId = "hyperliquid" | "dydx" | "okx" | "bybit" | "binance";
export type TradingVenueType = "wallet" | "cex";
export type TradingVenueConnectionStatus =
  | "not_configured"
  | "saved_locally"
  | "testing"
  | "connected"
  | "failed"
  | "disconnected";

export type ActiveVenueState = {
  venueId: TradingVenueId;
  venueType: TradingVenueType;
  activeSymbol: string;
  connectionStatus: TradingVenueConnectionStatus;
};
