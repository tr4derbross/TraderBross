import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const { headline, summary } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json(mockSentiment(headline));

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system:
        'You are a financial news sentiment analyzer. Respond ONLY with a JSON object: {"score":"bullish"|"bearish"|"neutral","confidence":0-100,"reason":"one sentence"}',
      messages: [
        { role: "user", content: `Headline: ${headline}\nSummary: ${summary}` },
      ],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    const result = JSON.parse(jsonMatch?.[0] ?? "{}");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockSentiment(headline));
  }
}

function mockSentiment(headline: string) {
  const lower = headline.toLowerCase();
  const bullishWords = [
    "beats",
    "surges",
    "record",
    "approval",
    "wins",
    "upgrades",
    "buyback",
    "growth",
    "rally",
  ];
  const bearishWords = [
    "miss",
    "drops",
    "fall",
    "warns",
    "cuts",
    "decline",
    "below",
    "layoffs",
    "concern",
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
  } else {
    return {
      score: "neutral",
      confidence: 50 + Math.floor(Math.random() * 20),
      reason: "Mixed or unclear market impact",
    };
  }
}
