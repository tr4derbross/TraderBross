import type {
  MarketDataAdapter,
  MarketDataConnection,
  MarketDataConnectionState,
  NormalizedTicker,
  TickerHandler,
} from "@/lib/market-data/types";
import type { TradingVenueId } from "@/lib/active-venue";
import { getVenueAdapter } from "@/lib/venues";

export function createMarketDataConnection(
  venue: TradingVenueId,
  onStateChange?: (state: MarketDataConnectionState) => void
): MarketDataConnection {
  return {
    venue,
    state: "idle",
    socket: null,
    subscriptions: new Map(),
    onStateChange,
  };
}

export function updateConnectionState(
  connection: MarketDataConnection,
  state: MarketDataConnectionState
) {
  connection.state = state;
  connection.onStateChange?.(state);
}

export function addSubscription(
  connection: MarketDataConnection,
  symbol: string,
  handler: TickerHandler
) {
  const handlers = connection.subscriptions.get(symbol) ?? new Set<TickerHandler>();
  handlers.add(handler);
  connection.subscriptions.set(symbol, handlers);
}

export function removeSubscription(
  connection: MarketDataConnection,
  symbol: string,
  handler?: TickerHandler
) {
  const handlers = connection.subscriptions.get(symbol);
  if (!handlers) return;

  if (handler) {
    handlers.delete(handler);
  } else {
    handlers.clear();
  }

  if (handlers.size === 0) {
    connection.subscriptions.delete(symbol);
  }
}

export function emitTicker(connection: MarketDataConnection, ticker: NormalizedTicker) {
  connection.subscriptions.get(ticker.symbol)?.forEach((handler) => handler(ticker));
}

export function createNormalizedTicker(
  venue: TradingVenueId,
  symbol: string,
  values: {
    markPrice?: number | null;
    lastPrice?: number | null;
    bid?: number | null;
    ask?: number | null;
    timestamp?: number;
  },
  connectionState: MarketDataConnectionState
): NormalizedTicker {
  return {
    symbol,
    venue,
    markPrice: values.markPrice ?? null,
    lastPrice: values.lastPrice ?? null,
    bid: values.bid ?? null,
    ask: values.ask ?? null,
    timestamp: values.timestamp ?? Date.now(),
    connectionState,
  };
}

export function getTickerDisplayPrice(ticker: NormalizedTicker | null) {
  if (!ticker) return null;
  return ticker.markPrice ?? ticker.lastPrice ?? ticker.bid ?? ticker.ask ?? null;
}

export function createWebSocketAdapter(config: {
  venue: TradingVenueId;
  url: string;
  subscribeMessage: (symbol: string) => unknown;
  unsubscribeMessage?: (symbol: string) => unknown;
  normalizeTickerPayload: MarketDataAdapter["normalizeTickerPayload"];
}): MarketDataAdapter {
  return {
    venue: config.venue,
    async connect(onStateChange) {
      const connection = createMarketDataConnection(config.venue, onStateChange);
      updateConnectionState(connection, "connecting");

      if (typeof WebSocket === "undefined") {
        updateConnectionState(connection, "error");
        return connection;
      }

      const socket = new WebSocket(config.url);
      connection.socket = socket;

      socket.onopen = () => {
        updateConnectionState(connection, "connected");
        connection.subscriptions.forEach((_handlers, symbol) => {
          socket.send(JSON.stringify(config.subscribeMessage(symbol)));
        });
      };

      socket.onmessage = (event) => {
        connection.subscriptions.forEach((_handlers, symbol) => {
          const ticker = config.normalizeTickerPayload(event.data, symbol, connection.state);
          if (ticker) {
            emitTicker(connection, ticker);
          }
        });
      };

      socket.onerror = () => {
        updateConnectionState(connection, "error");
      };

      socket.onclose = () => {
        updateConnectionState(connection, "disconnected");
      };

      return connection;
    },
    async subscribeTicker(connection, symbol, onTicker) {
      addSubscription(connection, symbol, onTicker);
      if (connection.socket?.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(config.subscribeMessage(symbol)));
      }
    },
    async unsubscribeTicker(connection, symbol, onTicker) {
      removeSubscription(connection, symbol, onTicker);
      if (
        config.unsubscribeMessage &&
        connection.socket?.readyState === WebSocket.OPEN &&
        !connection.subscriptions.has(symbol)
      ) {
        connection.socket.send(JSON.stringify(config.unsubscribeMessage(symbol)));
      }
    },
    async disconnect(connection) {
      connection.subscriptions.clear();
      connection.socket?.close();
      connection.socket = null;
      updateConnectionState(connection, "disconnected");
    },
    normalizeTickerPayload: config.normalizeTickerPayload,
  };
}

export function createPollingMarketDataAdapter(
  venue: TradingVenueId,
  normalizeFromVenueTicker: (
    symbol: string,
    connectionState: MarketDataConnectionState,
    price: number,
    timestamp: number
  ) => NormalizedTicker
): MarketDataAdapter {
  const intervals = new WeakMap<MarketDataConnection, Map<string, number>>();

  return {
    venue,
    async connect(onStateChange) {
      const connection = createMarketDataConnection(venue, onStateChange);
      updateConnectionState(connection, "connected");
      intervals.set(connection, new Map());
      return connection;
    },
    async subscribeTicker(connection, symbol, onTicker) {
      addSubscription(connection, symbol, onTicker);
      const intervalMap = intervals.get(connection) ?? new Map<string, number>();
      intervals.set(connection, intervalMap);
      if (intervalMap.has(symbol)) return;

      const push = async () => {
        const venueTicker = await getVenueAdapter(venue).getTicker(symbol);
        if (!venueTicker) return;
        const ticker = normalizeFromVenueTicker(
          symbol,
          connection.state,
          venueTicker.price,
          venueTicker.timestamp
        );
        emitTicker(connection, ticker);
      };

      await push();
      const intervalId = window.setInterval(() => {
        void push();
      }, 15_000);
      intervalMap.set(symbol, intervalId);
    },
    async unsubscribeTicker(connection, symbol, onTicker) {
      removeSubscription(connection, symbol, onTicker);
      if (connection.subscriptions.has(symbol)) return;
      const intervalId = intervals.get(connection)?.get(symbol);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervals.get(connection)?.delete(symbol);
      }
    },
    async disconnect(connection) {
      intervals.get(connection)?.forEach((intervalId) => window.clearInterval(intervalId));
      intervals.delete(connection);
      connection.subscriptions.clear();
      updateConnectionState(connection, "disconnected");
    },
    normalizeTickerPayload: () => null,
  };
}
