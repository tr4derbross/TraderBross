import { canonicalSymbol, symbolAliases } from "./symbol-map.mjs";

function asDate(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function normalizeMarketTick(input) {
  const symbol = canonicalSymbol(input.symbol);
  if (!symbol) return null;
  const priceUsd = Number(input.priceUsd ?? input.price ?? 0);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    type: "market_tick",
    symbol,
    aliases: symbolAliases(symbol),
    priceUsd,
    change24hPct: Number(input.change24hPct ?? input.changePct ?? 0) || 0,
    change24hUsd: Number(input.change24hUsd ?? input.change ?? 0) || 0,
    provider: input.provider || "unknown",
    timestamp: asDate(input.timestamp),
  };
}

export function normalizeTokenPair(input) {
  const baseSymbol = canonicalSymbol(input.baseSymbol);
  const quoteSymbol = canonicalSymbol(input.quoteSymbol || "USDT") || "USDT";
  if (!baseSymbol) return null;
  return {
    type: "token_pair",
    baseSymbol,
    quoteSymbol,
    pairAddress: String(input.pairAddress || ""),
    dexId: String(input.dexId || "unknown"),
    chainId: String(input.chainId || "unknown"),
    liquidityUsd: Number(input.liquidityUsd || 0),
    volume24hUsd: Number(input.volume24hUsd || 0),
    priceUsd: Number(input.priceUsd || 0),
    url: String(input.url || "#"),
    provider: input.provider || "unknown",
    timestamp: asDate(input.timestamp),
  };
}

export function normalizeNewsEvent(input) {
  const tickers = Array.isArray(input.tickers) ? input.tickers : [];
  const normalizedTickers = tickers
    .map((item) => canonicalSymbol(item))
    .filter(Boolean)
    .slice(0, 6);

  return {
    type: "news_event",
    id: String(input.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: String(input.title || input.headline || ""),
    summary: String(input.summary || input.description || ""),
    source: String(input.source || "Unknown"),
    sourceType: input.sourceType || "news",
    sentiment: input.sentiment || "neutral",
    importance: input.importance || "watch",
    url: String(input.url || "#"),
    tickers: normalizedTickers,
    timestamp: asDate(input.timestamp || input.publishedAt),
    provider: input.provider || "unknown",
    author: input.author || undefined,
    authorHandle: input.authorHandle || undefined,
  };
}

export function normalizeWhaleEvent(input) {
  const symbol = canonicalSymbol(input.symbol || input.token || input.asset || "BTC") || "BTC";
  const amountUsd = Number(input.usdValue ?? input.amountUsd ?? 0);
  const price = Number(input.price || 0);
  return {
    type: "whale_event",
    id: String(input.id || `${symbol}-${Date.now()}`),
    chain: String(input.chain || input.blockchain || "unknown"),
    txHash: input.txHash ? String(input.txHash) : null,
    token: symbol,
    amount: Number(input.amount || 0),
    usdValue: Number.isFinite(amountUsd) ? amountUsd : 0,
    fromLabel: String(input.fromLabel || input.from || "Unknown"),
    toLabel: String(input.toLabel || input.to || "Unknown"),
    eventType: input.eventType || "large_transfer",
    timestamp: asDate(input.timestamp),
    confidence: Number(input.confidence || 0.5),
    significance: Number(input.significance || 1),
    relatedAssets: Array.isArray(input.relatedAssets)
      ? input.relatedAssets.map((item) => canonicalSymbol(item)).filter(Boolean).slice(0, 6)
      : [symbol],
    labels: input.labels || null,
    price: Number.isFinite(price) ? price : 0,
    sentiment: input.sentiment || "neutral",
    provider: input.provider || "unknown",
    rawText: input.rawText ? String(input.rawText) : "",
  };
}

export function toFrontendQuote(tick) {
  return {
    symbol: tick.symbol,
    price: tick.priceUsd,
    change: tick.change24hUsd,
    changePct: tick.change24hPct,
  };
}

export function toFrontendNewsItem(news) {
  const tickers = (Array.isArray(news.tickers) ? news.tickers : [])
    .map((item) => canonicalSymbol(item))
    .filter(Boolean)
    .slice(0, 6);
  const fallbackReason =
    news.sentimentReason ||
    (news.sentiment === "bullish"
      ? "Auto signal favors bullish bias."
      : news.sentiment === "bearish"
        ? "Auto signal favors bearish bias."
        : "Auto signal is neutral.");
  const sentimentScore =
    Number.isFinite(Number(news.sentimentScore)) && Number(news.sentimentScore) > 0
      ? Math.max(50, Math.min(99, Math.round(Number(news.sentimentScore))))
      : news.sentiment === "neutral"
        ? 50
        : 62;

  return {
    id: news.id,
    headline: news.title,
    summary: news.summary,
    source: news.source,
    ticker: tickers,
    sector: tickers[0] || "Crypto",
    timestamp: news.timestamp,
    url: news.url,
    type: news.sourceType,
    sentiment: news.sentiment,
    sentimentScore,
    sentimentReason: fallbackReason,
    importance: news.importance,
    author: news.author,
    authorHandle: news.authorHandle,
    relatedAssets: Array.isArray(news.relatedAssets)
      ? news.relatedAssets.map((item) => canonicalSymbol(item)).filter(Boolean).slice(0, 6)
      : tickers,
    watchlistRelevance: Number(news.watchlistRelevance || 0),
    relevanceLabels: Array.isArray(news.relevanceLabels) ? news.relevanceLabels : [],
    priorityLabel: news.priorityLabel || undefined,
  };
}

export function toFrontendWhaleItem(event) {
  const amountText =
    event.usdValue >= 1e9
      ? `$${(event.usdValue / 1e9).toFixed(1)}B`
      : event.usdValue >= 1e6
        ? `$${(event.usdValue / 1e6).toFixed(1)}M`
        : `$${Math.round(event.usdValue).toLocaleString()}`;
  const direction =
    event.eventType === "exchange_inflow"
      ? "to exchange"
      : event.eventType === "exchange_outflow"
        ? "from exchange"
        : event.eventType.replace(/_/g, " ");
  const headline =
    event.eventType === "liquidation"
      ? `${event.token} ${event.sentiment === "bearish" ? "LONG" : "SHORT"} liquidation ${amountText}`
      : `${amountText} ${event.token} ${direction}`;

  return {
    id: event.id,
    headline,
    summary: event.rawText || `${event.token} moved from ${event.fromLabel} to ${event.toLabel}`,
    source: event.provider,
    ticker: Array.isArray(event.relatedAssets) && event.relatedAssets.length > 0 ? event.relatedAssets : [event.token],
    sector: "Whale",
    timestamp: event.timestamp,
    url: "#",
    type: "whale",
    sentiment: event.sentiment,
    whaleAmountUsd: event.usdValue,
    whaleToken: event.token,
    whaleFrom: event.fromLabel,
    whaleTo: event.toLabel,
    whaleTxHash: event.txHash || undefined,
    whaleBlockchain: event.chain,
    whaleEventType: event.eventType,
    whaleConfidence: event.confidence,
    whaleSignificance: event.significance,
    relatedAssets: event.relatedAssets,
    watchlistRelevance: event.watchlistRelevance ?? undefined,
    relevanceLabels: event.relevanceLabels ?? undefined,
    priorityLabel: event.priorityLabel ?? undefined,
  };
}

export function toFrontendLiquidation(event) {
  return {
    id: event.id,
    symbol: event.token,
    side: event.sentiment === "bearish" ? "long" : "short",
    qty: event.usdValue > 0 ? event.usdValue / Math.max(1, event.price || 1) : 0,
    price: event.price || 0,
    usdValue: event.usdValue,
    timestamp: event.timestamp,
  };
}
