"use client";

import { useEffect, useState, useCallback } from "react";
import type { FearGreedData } from "@/app/api/feargreed/route";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 min — index updates once a day but we cache server-side

export function useFearGreed() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/feargreed");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FearGreedData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Fear & Greed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/** Returns a color token based on value */
export function fgColor(value: number): string {
  if (value <= 20) return "#ef4444"; // red-500
  if (value <= 40) return "#f97316"; // orange-500
  if (value <= 60) return "#a1a1aa"; // zinc-400
  if (value <= 80) return "#22c55e"; // green-500
  return "#4ade80";                  // green-400
}

/** Compact label */
export function fgEmoji(label: string): string {
  const map: Record<string, string> = {
    "Extreme Fear": "😱",
    Fear: "😨",
    Neutral: "😐",
    Greed: "😏",
    "Extreme Greed": "🤑",
  };
  return map[label] ?? "❓";
}
