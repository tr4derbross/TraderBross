"use client";

import { useSyncExternalStore } from "react";
import type { BackendSnapshot, ForexData, LiquidationEvent, RealtimeEnvelope } from "@/lib/backend-types";
import { apiFetch } from "@/lib/api-client";
import { runtimeEnv } from "@/lib/runtime-env";

type Listener = () => void;
export type ConnectionStatus = "connecting" | "connected" | "live" | "degraded" | "reconnecting" | "stale" | "disconnected";

type RealtimeStore = BackendSnapshot & {
  connectionStatus: ConnectionStatus;
  lastUpdatedAt: number;
  lastMessageAt: number;
  lastHeartbeatAt: number;
  forex: ForexData;
};

const STALE_AFTER_MS = 35_000;
const STALE_CHECK_MS = 5_000;
const HEARTBEAT_INTERVAL = 20_000;
const BASE_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;
const CONNECT_TIMEOUT_MS = 8_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const FALLBACK_BOOTSTRAP_INTERVAL_MS = 30_000;

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
  whaleEvents: [],
  social: [],
  calendar: [],
  coinMetadata: {},
  discovery: [],
  providerState: {},
  providerHealth: {},
  connectionState: "connecting",
  connectionStatus: "connecting",
  lastUpdatedAt: 0,
  lastMessageAt: 0,
  lastHeartbeatAt: 0,
};

let state = fallbackSnapshot;
const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let started = false;
let reconnectTimer: number | null = null;
let heartbeatTimer: number | null = null;
let staleTimer: number | null = null;
let connectTimer: number | null = null;
let fallbackBootstrapTimer: number | null = null;
let reconnectAttempts = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function deriveConnectionStatus(next: Partial<RealtimeStore>): ConnectionStatus {
  const explicit = next.connectionStatus;
  if (explicit) return explicit;
  const backend = next.connectionState ?? state.connectionState;
  if (backend === "degraded") return "degraded";
  if (backend === "connected") return "live";
  if (backend === "disconnected") return "disconnected";
  return state.connectionStatus === "reconnecting" ? "reconnecting" : "connecting";
}

function setState(next: Partial<RealtimeStore>) {
  state = {
    ...state,
    ...next,
    connectionStatus: deriveConnectionStatus(next),
    lastUpdatedAt: Date.now(),
  };
  emit();
}

function markMessage() {
  const now = Date.now();
  setState({
    lastMessageAt: now,
    lastHeartbeatAt: now,
  });
}

function applyEnvelope(envelope: RealtimeEnvelope) {
  markMessage();
  switch (envelope.type) {
    case "snapshot":
      setState({
        ...envelope.payload,
        connectionStatus: envelope.payload.connectionState === "degraded" ? "degraded" : "live",
      });
      return;
    case "quotes":
      setState({ quotes: envelope.payload });
      return;
    case "venueQuotes":
      setState({ venueQuotes: envelope.payload });
      return;
    case "marketStats":
      setState({ marketStats: envelope.payload });
      return;
    case "mempoolStats":
      setState({ mempoolStats: envelope.payload });
      return;
    case "fearGreed":
      setState({ fearGreed: envelope.payload });
      return;
    case "news":
      setState({
        news: [envelope.payload, ...(state.news ?? []).filter((item) => item.id !== envelope.payload.id)].slice(0, 80),
      });
      return;
    case "social":
      setState({ social: envelope.payload });
      return;
    case "calendar":
      setState({ calendar: envelope.payload });
      return;
    case "whales":
      setState({ whales: envelope.payload });
      return;
    case "whaleEvents":
      setState({ whaleEvents: envelope.payload });
      return;
    case "ethGas":
      setState({ ethGas: envelope.payload });
      return;
    case "defiTvl":
      setState({ defiTvl: envelope.payload });
      return;
    case "forex":
      setState({ forex: envelope.payload });
      return;
    case "liquidation":
      setState({
        liquidations: [envelope.payload, ...(state.liquidations ?? []).filter((l) => l.id !== envelope.payload.id)].slice(0, 100),
      });
      return;
    case "heartbeat":
      setState({ lastHeartbeatAt: Date.now() });
      return;
    default:
      return;
  }
}

async function loadBootstrap() {
  try {
    const snapshot = await apiFetch<BackendSnapshot>("/api/bootstrap?mode=lite");
    const hasData = (snapshot.news?.length || 0) > 0 || (snapshot.quotes?.length || 0) > 0;
    const bootstrapStatus: ConnectionStatus =
      snapshot.connectionState === "degraded"
        ? "degraded"
        : snapshot.connectionState === "connected"
          ? "live"
          : hasData
            ? "stale"
            : "connecting";
    setState({
      ...snapshot,
      connectionStatus: bootstrapStatus,
      lastMessageAt: Date.now(),
    });
  } catch {
    setState({
      connectionStatus: state.news.length > 0 || state.quotes.length > 0 ? "stale" : "disconnected",
    });
  }
}

function reconnectDelay() {
  const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts += 1;
  return delay;
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setState({
      connectionStatus: state.news.length > 0 || state.quotes.length > 0 ? "stale" : "disconnected",
    });
    return;
  }
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  const delay = reconnectDelay();
  setState({
    connectionStatus: state.news.length > 0 || state.quotes.length > 0 ? "reconnecting" : "connecting",
  });
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (socket || typeof window === "undefined") return;
  if (state.connectionStatus !== "reconnecting") setState({ connectionStatus: "connecting" });
  if (connectTimer) {
    window.clearTimeout(connectTimer);
    connectTimer = null;
  }
  socket = new WebSocket(runtimeEnv.wsUrl);
  connectTimer = window.setTimeout(() => {
    if (!socket || socket.readyState === WebSocket.OPEN) return;
    if (state.news.length > 0 || state.quotes.length > 0) {
      setState({ connectionStatus: "stale" });
    } else {
      setState({ connectionStatus: "disconnected" });
    }
    try {
      socket.close();
    } catch {
      // no-op
    }
  }, CONNECT_TIMEOUT_MS);

  socket.onopen = () => {
    reconnectAttempts = 0;
    if (connectTimer) {
      window.clearTimeout(connectTimer);
      connectTimer = null;
    }
    setState({ connectionStatus: state.connectionState === "degraded" ? "degraded" : "live" });
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      } catch {
        // no-op
      }
    }, HEARTBEAT_INTERVAL);
  };

  socket.onmessage = (event) => {
    try {
      applyEnvelope(JSON.parse(event.data) as RealtimeEnvelope);
    } catch {
      // ignore malformed packet
    }
  };

  socket.onclose = () => {
    if (connectTimer) {
      window.clearTimeout(connectTimer);
      connectTimer = null;
    }
    socket = null;
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (state.news.length > 0 || state.quotes.length > 0) {
      setState({ connectionStatus: "stale" });
    } else {
      setState({ connectionStatus: "disconnected" });
    }
    scheduleReconnect();
  };

  socket.onerror = () => {
    // handled by onclose
  };
}

function startStaleCheck() {
  if (staleTimer || typeof window === "undefined") return;
  staleTimer = window.setInterval(() => {
    const now = Date.now();
    const age = now - (state.lastMessageAt || 0);
    if (age > STALE_AFTER_MS && (state.connectionStatus === "live" || state.connectionStatus === "degraded")) {
      setState({ connectionStatus: "stale" });
    }
  }, STALE_CHECK_MS);
}

function startFallbackBootstrapRefresh() {
  if (fallbackBootstrapTimer || typeof window === "undefined") return;
  fallbackBootstrapTimer = window.setInterval(() => {
    // Keep baseline data fresh even if websocket channel is unavailable.
    void loadBootstrap();
  }, FALLBACK_BOOTSTRAP_INTERVAL_MS);
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  void loadBootstrap();
  connect();
  startStaleCheck();
  startFallbackBootstrapRefresh();
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
  reconnectAttempts = 0;
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
