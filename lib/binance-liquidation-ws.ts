// TraderBross News System v2.0 — Zero-Key Multi-Agent Build
// Binance Futures forceOrder stream — completely free, no auth
// wss://fstream.binance.com/ws/!forceOrder@arr

export interface LiquidationEvent {
  id: string;
  symbol: string;         // "BTCUSDT" raw symbol
  displaySymbol: string;  // "BTC" — stripped of USDT/BUSD/USDC/PERP
  side: "LONG" | "SHORT";
  sizeUSD: number;
  quantity: number;
  price: number;
  exchange: "Binance";
  timestamp: Date;
}

// ── Binance forceOrder raw event shape ────────────────────────────────────────

interface BinanceForceOrderPayload {
  e: "forceOrder";
  o: {
    s: string;  // symbol e.g. "BTCUSDT"
    S: "BUY" | "SELL"; // BUY = SHORT liquidated, SELL = LONG liquidated
    q: string;  // quantity (base asset)
    p: string;  // price
    T: number;  // trade time ms
  };
}

// ── In-memory buffer (module-level, survives across requests in same process) ─

let liquidationBuffer: LiquidationEvent[] = [];
let wsConnection: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isStarting = false;

const WS_URL = "wss://fstream.binance.com/ws/!forceOrder@arr";
const MAX_BUFFER = 100;
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 20_000;

// ── Symbol parsing ─────────────────────────────────────────────────────────────

function parseSymbol(raw: string): string {
  return raw
    .replace(/USDT$|BUSD$|USDC$|USD$/, "")
    .replace(/PERP$/, "");
}

// ── Cleanup helpers ────────────────────────────────────────────────────────────

function clearTimers(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect(): void {
  clearTimers();
  reconnectTimer = setTimeout(() => {
    isStarting = false;
    connect();
  }, RECONNECT_DELAY);
}

// ── WebSocket connection ───────────────────────────────────────────────────────

function connect(): void {
  // Guard: only connect if native WebSocket is available (Node.js 18+ / browser)
  if (typeof globalThis.WebSocket === "undefined") {
    console.error(
      "[binance-liquidation-ws] Native WebSocket not available. " +
      "Requires Node.js 18+ or browser environment. Using mock data fallback."
    );
    isStarting = false;
    return;
  }

  isStarting = true;

  try {
    const ws = new globalThis.WebSocket(WS_URL);
    wsConnection = ws;

    ws.onopen = () => {
      isStarting = false;
      console.info("[binance-liquidation-ws] Connected to Binance forceOrder stream");

      // Heartbeat: send ping frame every 20s to keep connection alive
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === 1 /* OPEN */) {
          try {
            ws.send(JSON.stringify({ method: "LIST_SUBSCRIPTIONS", id: 1 }));
          } catch {
            // ignore — connection may be closing
          }
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        const parsed: unknown = JSON.parse(raw);

        // Binance sends either a single forceOrder event or an array
        const items: BinanceForceOrderPayload[] = Array.isArray(parsed) ? parsed : [parsed as BinanceForceOrderPayload];

        for (const item of items) {
          if (item?.e !== "forceOrder" || !item.o) continue;

          const { s, S, q, p, T } = item.o;

          // S: "SELL" = position was force-sold → LONG liquidated
          // S: "BUY"  = position was force-bought → SHORT liquidated
          const side: "LONG" | "SHORT" = S === "SELL" ? "LONG" : "SHORT";

          const price = parseFloat(p);
          const quantity = parseFloat(q);
          const sizeUSD = price * quantity;

          const ev: LiquidationEvent = {
            id: `bnb-${T}-${s}-${S}`,
            symbol: s,
            displaySymbol: parseSymbol(s),
            side,
            sizeUSD,
            quantity,
            price,
            exchange: "Binance",
            timestamp: new Date(T),
          };

          // Prepend newest first, cap at MAX_BUFFER
          liquidationBuffer = [ev, ...liquidationBuffer].slice(0, MAX_BUFFER);
        }
      } catch (err) {
        console.warn("[binance-liquidation-ws] Failed to parse message:", err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      console.warn(
        `[binance-liquidation-ws] Connection closed (code=${event.code}). Reconnecting in ${RECONNECT_DELAY}ms…`
      );
      wsConnection = null;
      clearTimers();
      scheduleReconnect();
    };

    ws.onerror = (event: Event) => {
      console.error("[binance-liquidation-ws] WebSocket error:", event);
      // onclose will also fire after onerror — reconnect handled there
    };
  } catch (err) {
    console.error("[binance-liquidation-ws] Failed to create WebSocket:", err);
    wsConnection = null;
    isStarting = false;
    scheduleReconnect();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Start the Binance forceOrder WebSocket stream if not already running.
 * Safe to call multiple times — idempotent.
 */
export function startLiquidationStream(): void {
  // Already connected or in the process of connecting
  if (isStarting || wsConnection?.readyState === 1 /* OPEN */) return;
  connect();
}

/**
 * Return the most recent liquidations, newest first.
 * @param limit Max number of events to return (capped at MAX_BUFFER).
 */
export function getRecentLiquidations(limit = 20): LiquidationEvent[] {
  // Buffer is already stored newest-first (prepend strategy in onmessage)
  return liquidationBuffer.slice(0, Math.min(limit, MAX_BUFFER));
}

/**
 * Aggregated stats for the last 60 seconds of liquidations in the buffer.
 */
export function getLiquidationStats(): {
  totalUSD: number;
  longUSD: number;
  shortUSD: number;
  count: number;
} {
  const cutoff = Date.now() - 60_000;
  const recent = liquidationBuffer.filter((e) => e.timestamp.getTime() > cutoff);

  return {
    count: recent.length,
    totalUSD: recent.reduce((s, e) => s + e.sizeUSD, 0),
    longUSD: recent
      .filter((e) => e.side === "LONG")
      .reduce((s, e) => s + e.sizeUSD, 0),
    shortUSD: recent
      .filter((e) => e.side === "SHORT")
      .reduce((s, e) => s + e.sizeUSD, 0),
  };
}
