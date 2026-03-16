function providerLabel(config) {
  if (config.anthropicApiKey) return "Anthropic Claude";
  if (config.groqApiKey) return "Groq";
  if (config.geminiApiKey) return "Gemini";
  return "Mock Analyst";
}

function buildMockResponse({ messages, context }) {
  const last = messages[messages.length - 1]?.content || "Review the market.";
  const ticker = context?.ticker || "BTC";
  const price = context?.price || "market";
  return [
    `**Bias:** neutral-to-constructive on ${ticker} while price holds the current structure around ${price}.`,
    "",
    "- Watch the last impulse high and the nearest pullback base before chasing.",
    "- If news flow stays positive, continuation is more likely than full mean reversion.",
    "- Main risk factor: crowded positioning and sudden sentiment reversal after fast moves.",
    "",
    `Prompt summary: ${last}`,
  ].join("\n");
}

export function getProviderLabel(config) {
  return providerLabel(config);
}

export async function* streamChat(config, payload) {
  const text = buildMockResponse(payload);
  const chunks = text.match(/.{1,48}/g) || [text];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 24));
    yield chunk;
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
