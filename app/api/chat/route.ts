import { NextRequest, NextResponse } from "next/server";
import { streamChat, getProviderLabel } from "@/lib/ai-providers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are TraderBross AI, an expert crypto trading analyst. When given a news headline or market question:
1. State directional bias clearly: **BULLISH** / **BEARISH** / **NEUTRAL**.
2. Identify the key price levels to watch (support, resistance, targets).
3. Assess risk factors that could invalidate the thesis.
4. Suggest execution context: entry zone, position sizing note, timeframe.
Be concise — traders need fast answers, not essays. Keep responses under 120 words. Use **bold** for key numbers and direction.`;

/** GET /api/chat — returns active provider info */
export async function GET() {
  return NextResponse.json({ provider: getProviderLabel() });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`chat:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

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
