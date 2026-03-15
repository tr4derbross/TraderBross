import { NextRequest, NextResponse } from "next/server";
import { streamChat, getProviderLabel } from "@/lib/ai-providers";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are TraderBross AI — a sharp, concise trading assistant embedded inside a professional crypto trading terminal.

You help traders by:
- Analyzing news headlines and market events for trading implications
- Explaining price action, market structure, and sentiment
- Discussing trading strategies, risk management, position sizing
- Interpreting on-chain data, funding rates, liquidations
- Offering objective perspectives on market conditions

Style:
- Be direct and concise — traders need fast answers
- Use proper trading terminology
- When analyzing news, always mention: direction bias, key levels to watch, risk factors
- Format numbers cleanly (e.g., $45,200 not $45200.00)
- Use bullet points for multi-part answers
- Never give financial advice; frame everything as analysis

You have access to the current market context provided by the user.`;

/** GET /api/chat — returns active provider info */
export async function GET() {
  return NextResponse.json({ provider: getProviderLabel() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      context,
    }: {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      context?: {
        ticker?: string;
        price?: string;
        change?: string;
        fearGreed?: { value: number; label: string };
        recentNews?: Array<{ headline: string; sentiment?: string }>;
      };
    } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build context block
    let contextBlock = "";
    if (context) {
      const parts: string[] = [];
      if (context.ticker) {
        parts.push(
          `Current asset: ${context.ticker}${context.price ? ` | Price: ${context.price}` : ""}${context.change ? ` | 24h change: ${context.change}` : ""}`
        );
      }
      if (context.fearGreed) {
        parts.push(
          `Market sentiment: Fear & Greed Index = ${context.fearGreed.value}/100 (${context.fearGreed.label})`
        );
      }
      if (context.recentNews && context.recentNews.length > 0) {
        const newsLines = context.recentNews
          .slice(0, 5)
          .map((n) => `- ${n.headline}${n.sentiment ? ` [${n.sentiment}]` : ""}`)
          .join("\n");
        parts.push(`Recent news:\n${newsLines}`);
      }
      if (parts.length > 0) {
        contextBlock = `\n\n[Terminal Context]\n${parts.join("\n")}`;
      }
    }

    const systemWithContext = SYSTEM_PROMPT + contextBlock;
    const stream = await streamChat(messages, systemWithContext);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
