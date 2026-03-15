/**
 * ai-providers.ts
 * Multi-provider AI abstraction.
 * Priority: Anthropic → Groq → Gemini → mock
 *
 * All providers expose:
 *  - streamChat(messages, system) → ReadableStream (SSE: data: {"text":"..."})
 *  - classify(prompt, system) → Promise<string>
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AIProvider = "anthropic" | "groq" | "gemini" | "mock";

export function detectProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "mock";
}

// ─── Anthropic Streaming ──────────────────────────────────────────────────────
async function streamAnthropic(
  messages: ChatMessage[],
  system: string
): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system,
          messages,
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            );
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Anthropic error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

// ─── Groq Streaming (OpenAI-compatible) ───────────────────────────────────────
const GROQ_MODEL = "llama-3.1-8b-instant";

async function streamGroq(
  messages: ChatMessage[],
  system: string
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            max_tokens: 1024,
            stream: true,
            messages: [
              { role: "system", content: system },
              ...messages,
            ],
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok || !res.body) throw new Error(`Groq ${res.status}`);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;
            try {
              const parsed = JSON.parse(raw) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            } catch {
              // skip malformed SSE line
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Groq error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

// ─── Gemini Streaming ─────────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-1.5-flash";

async function streamGemini(
  messages: ChatMessage[],
  system: string
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const geminiMessages = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: system }] },
              contents: geminiMessages,
              generationConfig: { maxOutputTokens: 1024 },
            }),
            signal: AbortSignal.timeout(30_000),
          }
        );

        if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}`);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            try {
              const parsed = JSON.parse(raw) as {
                candidates?: Array<{
                  content?: { parts?: Array<{ text?: string }> };
                }>;
              };
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gemini error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

// ─── Mock Stream ──────────────────────────────────────────────────────────────
function streamMock(messages: ChatMessage[]): ReadableStream {
  const encoder = new TextEncoder();
  const lastMsg = messages[messages.length - 1]?.content ?? "";

  const reply =
    "⚠️ **No AI key configured.** Add `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` to `.env.local` to enable live responses.\n\n" +
    `Your question: *"${lastMsg.slice(0, 80)}${lastMsg.length > 80 ? "…" : ""}"*`;

  const words = reply.split(" ");
  let i = 0;

  return new ReadableStream({
    pull(controller) {
      if (i >= words.length) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      const text = (i === 0 ? "" : " ") + words[i++];
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns a streaming response (SSE) for the chat endpoint */
export async function streamChat(
  messages: ChatMessage[],
  system: string
): Promise<ReadableStream> {
  const provider = detectProvider();

  switch (provider) {
    case "anthropic":
      return streamAnthropic(messages, system);
    case "groq":
      return streamGroq(messages, system);
    case "gemini":
      return streamGemini(messages, system);
    default:
      return streamMock(messages);
  }
}

/** One-shot classification call (for sentiment analysis) */
export async function classifyText(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const provider = detectProvider();

  if (provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text : "{}";
  }

  if (provider === "groq" || provider === "gemini") {
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body =
      provider === "groq"
        ? JSON.stringify({
            model: GROQ_MODEL,
            max_tokens: 150,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          })
        : JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 150 },
          });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "groq") headers.Authorization = `Bearer ${process.env.GROQ_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`${provider} classify ${res.status}`);

    const json = await res.json() as Record<string, unknown>;

    if (provider === "groq") {
      const choices = json.choices as Array<{ message?: { content?: string } }>;
      return choices?.[0]?.message?.content ?? "{}";
    } else {
      const candidates = json.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      return candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    }
  }

  return "{}";
}

/** Which provider is active — for UI display */
export function getProviderLabel(): string {
  const map: Record<AIProvider, string> = {
    anthropic: "Claude Haiku",
    groq: "Groq Llama 3.1",
    gemini: "Gemini Flash",
    mock: "No AI key",
  };
  return map[detectProvider()];
}
