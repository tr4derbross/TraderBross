import { NextRequest, NextResponse } from "next/server";
import { classifyText } from "@/lib/ai-providers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const SYSTEM_PROMPT =
  'You are a financial news sentiment analyzer. Respond ONLY with a JSON object: {"score":"bullish"|"bearish"|"neutral","confidence":0-100,"reason":"one sentence"}';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`sentiment:${ip}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const { headline, summary } = await request.json();

  try {
    const text = await classifyText(
      `Headline: ${headline}\nSummary: ${summary ?? ""}`,
      SYSTEM_PROMPT
    );

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]) as {
      score: string;
      confidence: number;
      reason: string;
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockSentiment(headline));
  }
}

function mockSentiment(headline: string) {
  const lower = headline.toLowerCase();
  const bullishWords = [
    "beats", "surges", "record", "approval", "wins", "upgrades",
    "buyback", "growth", "rally", "pump", "ath", "partnership",
  ];
  const bearishWords = [
    "miss", "drops", "fall", "warns", "cuts", "decline",
    "below", "layoffs", "concern", "crash", "dump", "ban", "hack",
  ];

  const bullScore = bullishWords.filter((w) => lower.includes(w)).length;
  const bearScore = bearishWords.filter((w) => lower.includes(w)).length;

  if (bullScore > bearScore) {
    return {
      score: "bullish",
      confidence: 65 + Math.floor(Math.random() * 25),
      reason: "Positive catalyst detected in headline",
    };
  } else if (bearScore > bullScore) {
    return {
      score: "bearish",
      confidence: 60 + Math.floor(Math.random() * 25),
      reason: "Negative catalyst detected in headline",
    };
  }
  return {
    score: "neutral",
    confidence: 50 + Math.floor(Math.random() * 20),
    reason: "Mixed or unclear market impact",
  };
}
