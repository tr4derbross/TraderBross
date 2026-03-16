"use client";

import { useRealtimeSelector, refreshRealtimeSnapshot } from "@/lib/realtime-client";

export function useFearGreed() {
  const data = useRealtimeSelector((state) => state.fearGreed);
  const loading = useRealtimeSelector((state) => !state.fearGreed && state.connectionStatus !== "disconnected");
  const error = useRealtimeSelector((state) => (state.connectionStatus === "disconnected" && !state.fearGreed ? "Realtime feed unavailable" : null));

  return {
    data,
    loading,
    error,
    refetch: refreshRealtimeSnapshot,
  };
}

export function fgColor(value: number): string {
  if (value <= 20) return "#ef4444";
  if (value <= 40) return "#f97316";
  if (value <= 60) return "#a1a1aa";
  if (value <= 80) return "#22c55e";
  return "#4ade80";
}

export function fgEmoji(label: string): string {
  const map: Record<string, string> = {
    "Extreme Fear": "😱",
    Fear: "😨",
    Neutral: "😐",
    Greed: "😏",
    "Extreme Greed": "🤑",
  };
  return map[label] ?? "❔";
}
