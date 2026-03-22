const minuteUsage = new Map();
const dailyUsage = new Map();
const quotaCooldownUntil = {
  groq: 0,
  gemini: 0,
  openrouter: 0,
};

function nowMinuteBucket(now = Date.now()) {
  return Math.floor(now / 60_000);
}

function nowDayBucket(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function cleanupUsageMaps(now = Date.now()) {
  const minBucket = nowMinuteBucket(now);
  const dayBucket = nowDayBucket(now);
  for (const key of minuteUsage.keys()) {
    const [bucket] = String(key).split(":");
    if (Number(bucket) < minBucket - 1) {
      minuteUsage.delete(key);
    }
  }
  for (const key of dailyUsage.keys()) {
    const [bucket] = String(key).split(":");
    if (bucket !== dayBucket) {
      dailyUsage.delete(key);
    }
  }
}

function takeBudget(config, consumerKey) {
  cleanupUsageMaps();
  const perMinute = Math.max(1, Number(config?.ai?.maxRequestsPerMinute || 12));
  const perDay = Math.max(1, Number(config?.ai?.maxRequestsPerDay || 200));
  const minuteKey = `${nowMinuteBucket()}:${consumerKey}`;
  const dayKey = `${nowDayBucket()}:${consumerKey}`;
  const minuteCount = Number(minuteUsage.get(minuteKey) || 0);
  const dailyCount = Number(dailyUsage.get(dayKey) || 0);

  if (minuteCount >= perMinute) {
    return { ok: false, reason: "minute_limit" };
  }
  if (dailyCount >= perDay) {
    return { ok: false, reason: "daily_limit" };
  }

  minuteUsage.set(minuteKey, minuteCount + 1);
  dailyUsage.set(dayKey, dailyCount + 1);
  return { ok: true, reason: "ok" };
}

function providerLabel(config) {
  if (!config?.ai?.allowExternal) return "Mock Analyst (Free-safe mode)";
  if (config.groqApiKey) return "Groq";
  if (config.geminiApiKey) return "Gemini";
  if (config.openrouterApiKey) return "OpenRouter";
  return "Mock Analyst";
}

function trimText(value = "", maxChars = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function normalizePayload(config, payload) {
  const maxChars = Math.max(200, Number(config?.ai?.maxInputChars || 2400));
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const normalizedMessages = messages
    .slice(-10)
    .map((row) => ({
      role: row?.role === "assistant" ? "assistant" : "user",
      content: trimText(row?.content || "", Math.min(700, maxChars)),
    }))
    .filter((row) => row.content.length > 0);
  const context = payload?.context || {};
  return {
    messages: normalizedMessages.length > 0 ? normalizedMessages : [{ role: "user", content: "Review the market." }],
    context: {
      ticker: trimText(context?.ticker || "BTC", 12).toUpperCase(),
      price: trimText(context?.price || "market", 40),
      venue: trimText(context?.venue || "", 20),
    },
  };
}

function buildMockResponse({ messages, context }) {
  const last = messages[messages.length - 1]?.content || "Review the market.";
  const ticker = context?.ticker || "BTC";
  const price = context?.price || "market";
  const venue = context?.venue ? ` on ${context.venue}` : "";
  return [
    `**Bias:** neutral-to-constructive on ${ticker}${venue} while price holds the current structure around ${price}.`,
    "",
    "- Watch the last impulse high and the nearest pullback base before chasing.",
    "- If news flow stays positive, continuation is more likely than full mean reversion.",
    "- Main risk factor: crowded positioning and sudden sentiment reversal after fast moves.",
    "",
    `Prompt summary: ${last}`,
  ].join("\n");
}

function toChunked(text) {
  return String(text || "").match(/.{1,48}/g) || [String(text || "")];
}

function buildSystemPrompt() {
  return [
    "You are a concise crypto market analyst for active traders.",
    "Be explicit about risk and invalidation levels.",
    "No financial guarantees. Keep answer short and actionable.",
  ].join(" ");
}

function isQuotaError(errorMessage = "") {
  const lower = String(errorMessage || "").toLowerCase();
  return lower.includes("quota") || lower.includes("429") || lower.includes("rate limit") || lower.includes("resource exhausted");
}

async function callGroq(config, payload) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.groqModel,
      temperature: 0.2,
      max_tokens: Math.max(64, Number(config?.ai?.maxOutputTokens || 220)),
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...payload.messages.map((row) => ({ role: row.role, content: row.content })),
      ],
    }),
    signal: AbortSignal.timeout(Math.max(1200, Number(config?.ai?.timeoutMs || 5000))),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`groq_http_${response.status}:${text.slice(0, 180)}`);
  }

  const data = await response.json();
  return trimText(data?.choices?.[0]?.message?.content || "", 2400);
}

async function callGemini(config, payload) {
  const model = encodeURIComponent(config.ai.geminiModel);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: Math.max(64, Number(config?.ai?.maxOutputTokens || 220)),
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${buildSystemPrompt()}\n\nContext:\n${JSON.stringify(payload.context)}\n\nConversation:\n${payload.messages
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n")}`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(Math.max(1200, Number(config?.ai?.timeoutMs || 5000))),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`gemini_http_${response.status}:${text.slice(0, 180)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join(" ").trim();
  return trimText(text || "", 2400);
}

async function callOpenRouterModel(config, payload, model) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openrouterApiKey}`,
      "http-referer": String(config?.ai?.openrouterReferer || "https://trader-bross.vercel.app"),
      "x-title": String(config?.ai?.openrouterTitle || "TraderBross Terminal"),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: Math.max(64, Number(config?.ai?.maxOutputTokens || 220)),
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...payload.messages.map((row) => ({ role: row.role, content: row.content })),
      ],
    }),
    signal: AbortSignal.timeout(Math.max(1200, Number(config?.ai?.timeoutMs || 5000))),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`openrouter_http_${response.status}:${text.slice(0, 220)}`);
  }

  const data = await response.json();
  return trimText(data?.choices?.[0]?.message?.content || "", 2400);
}

async function callOpenRouter(config, payload) {
  const models = Array.isArray(config?.ai?.openrouterModels) ? config.ai.openrouterModels : [];
  for (const rawModel of models) {
    const model = String(rawModel || "").trim();
    if (!model) continue;
    try {
      const text = await callOpenRouterModel(config, payload, model);
      if (text) return text;
    } catch {
      // Try next free model in the list.
    }
  }
  throw new Error("openrouter_http_429:all_models_failed_or_unavailable");
}

export function getProviderLabel(config) {
  return providerLabel(config);
}

export async function* streamChat(config, payload, options = {}) {
  const normalized = normalizePayload(config, payload);
  const consumerKey = String(options?.consumerKey || "global");

  if (!config?.ai?.allowExternal) {
    yield { type: "meta", provider: "mock" };
    for (const chunk of toChunked(buildMockResponse(normalized))) {
      await new Promise((resolve) => setTimeout(resolve, 24));
      yield { type: "chunk", text: chunk };
    }
    return;
  }

  const budget = takeBudget(config, consumerKey);
  if (!budget.ok) {
    yield { type: "meta", provider: "mock" };
    for (const chunk of toChunked(buildMockResponse(normalized))) {
      await new Promise((resolve) => setTimeout(resolve, 18));
      yield { type: "chunk", text: chunk };
    }
    return;
  }

  let text = "";
  let usedProvider = "mock";
  const now = Date.now();
  const attempts = [
    {
      id: "groq",
      enabled: Boolean(config.groqApiKey) && quotaCooldownUntil.groq <= now,
      run: () => callGroq(config, normalized),
    },
    {
      id: "gemini",
      enabled: Boolean(config.geminiApiKey) && quotaCooldownUntil.gemini <= now,
      run: () => callGemini(config, normalized),
    },
    {
      id: "openrouter",
      enabled: Boolean(config.openrouterApiKey) && quotaCooldownUntil.openrouter <= now,
      run: () => callOpenRouter(config, normalized),
    },
  ];

  for (const attempt of attempts) {
    if (!attempt.enabled) continue;
    try {
      text = await attempt.run();
      if (text) {
        usedProvider = attempt.id;
        break;
      }
    } catch (error) {
      const message = String(error || "");
      const cooldownMs = Math.max(60_000, Number(config?.ai?.quotaCooldownMs || 60 * 60 * 1000));
      if (isQuotaError(message)) {
        quotaCooldownUntil[attempt.id] = Date.now() + cooldownMs;
      }
    }
  }

  if (!text) {
    text = buildMockResponse(normalized);
    usedProvider = "mock";
  }

  yield { type: "meta", provider: usedProvider };
  for (const chunk of toChunked(text)) {
    await new Promise((resolve) => setTimeout(resolve, 18));
    yield { type: "chunk", text: chunk };
  }
}

export function classifySentiment(headline = "") {
  const source = headline.toLowerCase();
  const bullish = ["surge", "record", "approval", "wins", "up", "inflow", "launch", "buy"];
  const bearish = ["drop", "falls", "hack", "ban", "lawsuit", "sell", "liquidation", "outflow"];
  const bullHits = bullish.filter((word) => source.includes(word)).length;
  const bearHits = bearish.filter((word) => source.includes(word)).length;

  if (bullHits > bearHits) {
    return { score: "bullish", confidence: 74, reason: "Positive catalyst words dominate the headline." };
  }

  if (bearHits > bullHits) {
    return { score: "bearish", confidence: 71, reason: "Negative catalyst words dominate the headline." };
  }

  return { score: "neutral", confidence: 58, reason: "No clear directional catalyst stands out in the headline." };
}
