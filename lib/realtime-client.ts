"use client";

import { useSyncExternalStore } from "react";
import type { BackendSnapshot, ForexData, LiquidationEvent, RealtimeEnvelope } from "@/lib/backend-types";
import { apiFetch } from "@/lib/api-client";
import { runtimeEnv } from "@/lib/runtime-env";

type Listener = () => void;
type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

type RealtimeStore = BackendSnapshot & {
  connectionStatus: ConnectionState;
  lastUpdatedAt: number;
  forex: ForexData;
};

const fallbackSnapshot: RealtimeStore = {
  quotes: [],
  venueQuotes: { Binance: [], OKX: [], Bybit: [] },
  marketStats: null,
  mempoolStats: null,
  fearGreed: null,
  ethGas: null,
  defiTvl: null,
  forex: null,
  liquidations: [] as LiquidationEvent[],
  news: [],
  whales: [],
  social: [],
  connectionState: "connecting",
  connectionStatus: "idle",
  lastUpdatedAt: 0,
};

let state = fallbackSnapshot;
const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let started = false;
let reconnectTimer: number | null = null;
let heartbeatTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY = 1000;
const HEARTBEAT_INTERVAL = 20_000; // ping every 20s to keep connection alive
const isDev = process.env.NODE_ENV === 'development';

function log(...args: unknown[]) {
  if (isDev) console.log(...args);
}

function warn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

function error(...args: unknown[]) {
  if (isDev) console.error(...args);
}

function getReconnectDelay(): number {
  return Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 30000);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<RealtimeStore>) {
  state = {
    ...state,
    ...next,
    lastUpdatedAt: Date.now(),
  };
  emit();
}

function applyEnvelope(envelope: RealtimeEnvelope) {
  switch (envelope.type) {
    case "snapshot":
      setState({ ...envelope.payload, connectionStatus: "connected" });
      break;
    case "quotes":
      setState({ quotes: envelope.payload, connectionStatus: "connected" });
      break;
    case "venueQuotes":
      setState({ venueQuotes: envelope.payload, connectionStatus: "connected" });
      break;
    case "marketStats":
      setState({ marketStats: envelope.payload });
      break;
    case "mempoolStats":
      setState({ mempoolStats: envelope.payload });
      break;
    case "fearGreed":
      setState({ fearGreed: envelope.payload });
      break;
    case "news":
      setState({ news: [envelope.payload, ...(state.news ?? []).filter((item) => item.id !== envelope.payload.id)].slice(0, 60) });
      break;
    case "social":
      setState({ social: envelope.payload });
      break;
    case "whales":
      setState({ whales: envelope.payload });
      break;
    case "ethGas":
      setState({ ethGas: envelope.payload });
      break;
    case "defiTvl":
      setState({ defiTvl: envelope.payload });
      break;
    case "forex":
      setState({ forex: envelope.payload });
      break;
    case "liquidation":
      setState({
        liquidations: [envelope.payload, ...(state.liquidations ?? []).filter((l) => l.id !== envelope.payload.id)].slice(0, 100),
      });
      break;
    case "heartbeat":
      setState({ connectionStatus: "connected" });
      break;
    default:
      break;
  }
}

async function loadBootstrap() {
  try {
    const snapshot = await apiFetch<BackendSnapshot>("/api/bootstrap");
    setState({
      ...snapshot,
      connectionStatus: "connecting",
    });
  } catch {
    setState({ connectionStatus: "disconnected" });
  }
}

function scheduleReconnect() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    // After 5 failures, wait 30s then reset counter
    const delay = 30000;
    warn("[Realtime] Max reconnect attempts reached. Waiting 30s before retry...");
    reconnectTimer = window.setTimeout(() => {
      reconnectAttempts = 0;
      reconnectTimer = null;
      connect();
    }, delay);
    return;
  }

  const delay = getReconnectDelay();
  reconnectAttempts++;
  warn(`[Realtime] Scheduling reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (socket || typeof window === "undefined") {
    return;
  }

  setState({ connectionStatus: "connecting" });
  log("[Realtime] connecting to", runtimeEnv.wsUrl);
  socket = new WebSocket(runtimeEnv.wsUrl);

  socket.onopen = () => {
    log("[Realtime] connected");
    reconnectAttempts = 0;
    setState({ connectionStatus: "connected" });
    // Start heartbeat ping every 20s
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        } catch {
          // ignore send errors — close will trigger reconnect
        }
      }
    }, HEARTBEAT_INTERVAL);
  };

  socket.onmessage = (event) => {
    try {
      const envelope = JSON.parse(event.data) as RealtimeEnvelope;
      applyEnvelope(envelope);
    } catch {
      // ignore malformed packets
    }
  };

  socket.onclose = (event) => {
    warn("[Realtime] disconnected", event.code, event.reason);
    socket = null;
    // Stop heartbeat on disconnect
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    setState({ connectionStatus: "disconnected" });
    scheduleReconnect();
  };

  socket.onerror = () => {
    // WebSocket error events intentionally carry no detail (browser security).
    // onclose fires automatically after onerror — reconnect is handled there.
    warn("[Realtime] WebSocket connection error — will reconnect");
  };
}

function ensureStarted() {
  if (started || typeof window === "undefined") {
    return;
  }

  started = true;
  void loadBootstrap();
  connect();
}

export function refreshRealtimeSnapshot() {
  return loadBootstrap();
}

export function reconnectRealtime() {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  reconnectAttempts = 0;
  log("[Realtime] manual reconnect triggered");
  connect();
}

export function subscribeRealtime(listener: Listener) {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRealtimeState() {
  return state;
}

export function useRealtimeSelector<T>(selector: (snapshot: RealtimeStore) => T): T {
  ensureStarted();
  return useSyncExternalStore(subscribeRealtime, () => selector(getRealtimeState()), () => selector(fallbackSnapshot));
}
