import { NextResponse } from "next/server";
import { withCache } from "@/lib/server-cache";
import { logger } from "@/lib/logger";

export interface FearGreedData {
  value: number;          // 0-100
  label: string;          // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: string;
  history: Array<{ value: number; label: string; timestamp: string }>;
}

function classifyFG(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

function mockFearGreed(): FearGreedData {
  const v = 52;
  return {
    value: v,
    label: classifyFG(v),
    timestamp: new Date().toISOString(),
    history: Array.from({ length: 7 }, (_, i) => {
      const val = 45 + Math.round(Math.sin(i * 0.8) * 15);
      return {
        value: val,
        label: classifyFG(val),
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
      };
    }),
  };
}

export async function GET() {
  const data = await withCache("feargreed:latest", 300_000, async () => {
    try {
      const res = await fetch("https://api.alternative.me/fng/?limit=7&format=json", {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`alternative.me ${res.status}`);

      const json = await res.json() as {
        data: Array<{ value: string; value_classification: string; timestamp: string }>;
      };

      if (!json?.data?.length) throw new Error("Empty response");

      const [latest, ...rest] = json.data;
      return {
        value: parseInt(latest.value, 10),
        label: latest.value_classification,
        timestamp: new Date(parseInt(latest.timestamp, 10) * 1000).toISOString(),
        history: rest.map((d) => ({
          value: parseInt(d.value, 10),
          label: d.value_classification,
          timestamp: new Date(parseInt(d.timestamp, 10) * 1000).toISOString(),
        })),
      } satisfies FearGreedData;
    } catch (err) {
      logger.error("Fear & Greed API error:", err);
      return mockFearGreed();
    }
  });

  return NextResponse.json(data);
}
