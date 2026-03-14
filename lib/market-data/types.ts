import type { TradingVenueId } from "@/lib/active-venue";

export type MarketDataConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type NormalizedTicker = {
  symbol: string;
  venue: TradingVenueId;
  markPrice: number | null;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  timestamp: number;
  connectionState: MarketDataConnectionState;
};

export type TickerHandler = (ticker: NormalizedTicker) => void;

export type MarketDataConnection = {
  venue: TradingVenueId;
  state: MarketDataConnectionState;
  socket: WebSocket | null;
  subscriptions: Map<string, Set<TickerHandler>>;
  onStateChange?: (state: MarketDataConnectionState) => void;
};

export type MarketDataAdapter = {
  venue: TradingVenueId;
  connect: (onStateChange?: (state: MarketDataConnectionState) => void) => Promise<MarketDataConnection>;
  subscribeTicker: (
    connection: MarketDataConnection,
    symbol: string,
    onTicker: TickerHandler
  ) => Promise<void> | void;
  unsubscribeTicker: (
    connection: MarketDataConnection,
    symbol: string,
    onTicker?: TickerHandler
  ) => Promise<void> | void;
  disconnect: (connection: MarketDataConnection) => Promise<void> | void;
  normalizeTickerPayload: (
    payload: unknown,
    symbol: string,
    connectionState: MarketDataConnectionState
  ) => NormalizedTicker | null;
};
