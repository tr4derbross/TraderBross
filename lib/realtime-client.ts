"use client";

import { useSyncExternalStore } from "react";
import type { BackendSnapshot, RealtimeEnvelope } from "@/lib/backend-types";
import { apiFetch } from "@/lib/api-client";
import { runtimeEnv } from "@/lib/runtime-env";

type Listener = () => void;
type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

type RealtimeStore = BackendSnapshot & {
  connectionStatus: ConnectionState;
  lastUpdatedAt: number;
};

const fallbackSnapshot: RealtimeStore = {
  quotes: [],
  venueQuotes: { Binance: [], OKX: [], Bybit: [] },
  marketStats: null,
  mempoolStats: null,
  fearGreed: null,
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
      setState({ news: [envelope.payload, ...state.news.filter((item) => item.id !== envelope.payload.id)].slice(0, 60) });
      break;
    case "social":
      setState({ social: envelope.payload });
      break;
    case "whales":
      setState({ whales: envelope.payload });
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

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
}

function connect() {
  if (socket || typeof window === "undefined") {
    return;
  }

  setState({ connectionStatus: "connecting" });
  console.log("[Realtime] connecting to", runtimeEnv.wsUrl);
  socket = new WebSocket(runtimeEnv.wsUrl);

  socket.onopen = () => {
    console.log("[Realtime] connected");
    setState({ connectionStatus: "connected" });
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
    console.warn("[Realtime] disconnected", event.code, event.reason);
    socket = null;
    setState({ connectionStatus: "disconnected" });
    scheduleReconnect();
  };

  socket.onerror = (err) => {
    console.error("[Realtime] WebSocket error", err);
    socket?.close();
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
  console.log("[Realtime] manual reconnect triggered");
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
