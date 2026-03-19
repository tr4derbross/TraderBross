function shortDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown time";
  return parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function uniq(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

export function createRuleAnalysisEngine() {
  function analyzeNews(item) {
    const affected = uniq(item.tickers || item.relatedAssets || []);
    const priorityScore = Number(item.priority?.score || item.priorityScore || 0);
    const eventType = item.eventType || "noise";
    const sentiment = item.sentiment || "neutral";
    const source = item.source || "Unknown";
    const ts = shortDate(item.publishedAt || item.timestamp);

    const bullish = [];
    const bearish = [];
    if (sentiment === "bullish") bullish.push("Headline tone is positive.");
    if (sentiment === "bearish") bearish.push("Headline tone is negative.");
    if (eventType === "listing") bullish.push("Listing/liquidity expansion can support short-term momentum.");
    if (eventType === "exploit") bearish.push("Exploit headlines often trigger risk-off moves.");
    if (eventType === "regulation") bearish.push("Regulatory uncertainty can compress risk appetite.");
    if (priorityScore >= 70) bullish.push("High-priority source/recency mix supports near-term relevance.");

    return {
      summary: `${item.title || item.headline} (${source}, ${ts})`,
      whyItMatters: `Classified as ${eventType} with priority ${priorityScore}/100.`,
      affectedAssets: affected,
      bullishFactors: bullish.slice(0, 3),
      bearishFactors: bearish.slice(0, 3),
      riskNotes: [
        "Headline risk can fade quickly without confirmation.",
        "Check liquidity and funding before chasing.",
      ],
      tradeCaution: priorityScore >= 70 ? "Use tighter invalidation; volatility likely elevated." : "Prefer confirmation from price/volume before entry.",
    };
  }

  function analyzeWhale(event) {
    const affected = uniq(event.relatedAssets || [event.token]);
    const ts = shortDate(event.timestamp);
    const isInflow = event.eventType === "exchange_inflow";
    const isOutflow = event.eventType === "exchange_outflow";
    const isMint = event.eventType === "stablecoin_mint";

    const bullish = [];
    const bearish = [];
    if (isOutflow) bullish.push("Exchange outflow can imply accumulation.");
    if (isMint) bullish.push("Stablecoin mint can add deployable liquidity.");
    if (isInflow) bearish.push("Exchange inflow can precede sell pressure.");
    if (event.significance >= 75) bearish.push("Event size is large enough to move short-term sentiment.");

    return {
      summary: `${event.token} ${event.eventType.replace(/_/g, " ")} at ${ts}`,
      whyItMatters: `$${Math.round(event.usdValue).toLocaleString()} moved (${event.fromLabel} -> ${event.toLabel}), significance ${event.significance}/99.`,
      affectedAssets: affected,
      bullishFactors: bullish.slice(0, 3),
      bearishFactors: bearish.slice(0, 3),
      riskNotes: [
        "Single transfer does not guarantee direction.",
        "Cross-check with orderflow and derivatives positioning.",
      ],
      tradeCaution: event.confidence < 0.65 ? "Signal confidence is moderate; avoid oversized positions." : "Use event as context, not a standalone trigger.",
    };
  }

  function analyzeSelected(payload) {
    if (!payload) return null;
    if (payload.kind === "whale" || payload.eventType) return analyzeWhale(payload);
    return analyzeNews(payload);
  }

  return {
    analyzeNews,
    analyzeWhale,
    analyzeSelected,
  };
}
