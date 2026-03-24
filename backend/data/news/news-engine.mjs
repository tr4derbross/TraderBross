import crypto from "node:crypto";
import { canonicalSymbol, CORE_SYMBOLS } from "../core/symbol-map.mjs";
import { createWatchlistRelevance } from "../core/watchlist-relevance.mjs";

const WATCHLIST_DEFAULT = ["BTC", "ETH", "SOL", "BNB", "XRP"];
const PRIORITY_KEYWORDS = [
  { keyword: "listing", weight: 10, eventType: "listing", tag: "listing" },
  { keyword: "listed", weight: 10, eventType: "listing", tag: "listing" },
  { keyword: "etf", weight: 12, eventType: "regulation", tag: "etf" },
  { keyword: "sec", weight: 12, eventType: "regulation", tag: "sec" },
  { keyword: "regulation", weight: 9, eventType: "regulation", tag: "regulation" },
  { keyword: "exploit", weight: 14, eventType: "exploit", tag: "exploit" },
  { keyword: "hack", weight: 14, eventType: "exploit", tag: "hack" },
  { keyword: "liquidation", weight: 8, eventType: "onchain", tag: "liquidation" },
  { keyword: "funding", weight: 7, eventType: "exchange", tag: "funding" },
  { keyword: "treasury", weight: 8, eventType: "macro", tag: "treasury" },
  { keyword: "burn", weight: 8, eventType: "stablecoin", tag: "burn" },
  { keyword: "mint", weight: 8, eventType: "stablecoin", tag: "mint" },
  { keyword: "partnership", weight: 7, eventType: "watchlist", tag: "partnership" },
  { keyword: "unlock", weight: 9, eventType: "watchlist", tag: "unlock" },
];

const EVENT_PRIORITY = ["breaking", "regulation", "listing", "exploit", "macro", "stablecoin", "exchange", "onchain", "watchlist", "noise"];
const SOURCE_IMPORTANCE = {
  "CoinDesk": 20,
  "Cointelegraph": 17,
  "Decrypt": 15,
  "The Block": 17,
  "CryptoCompare": 12,
  "CryptoPanic": 10,
  "Tree News": 16,
  "Twitter": 12,
  "Blogs": 10,
  "Bloomberg": 22,
  "Reuters": 22,
  "SEC": 24,
  "Reddit r/CryptoCurrency": 11,
  "Reddit r/Bitcoin": 13,
  "Reddit r/ethereum": 12,
  "Reddit r/CryptoMarkets": 11,
  "Reddit r/ethfinance": 11,
  "Reddit r/solana": 10,
  "Reddit r/defi": 10,
};

const TICKER_ALIAS = {
  BITCOIN: "BTC",
  ETHEREUM: "ETH",
  SOLANA: "SOL",
  BINANCE: "BNB",
  RIPPLE: "XRP",
  DOGECOIN: "DOGE",
  CHAINLINK: "LINK",
  ARBITRUM: "ARB",
  OPTIMISM: "OP",
  TETHER: "USDT",
  USDC: "USDC",
};

const SENTIMENT_WORDS = {
  bullish: [
    ["rally", 2],
    ["surge", 2],
    ["gain", 1],
    ["approval", 2],
    ["partnership", 2],
    ["inflow", 2],
    ["launch", 1],
    ["buy", 1],
    ["breakout", 2],
    ["record high", 2],
    ["accumulation", 2],
    ["etf inflow", 3],
    ["upgrade", 1],
    ["integration", 1],
  ],
  bearish: [
    ["dump", 2],
    ["drop", 2],
    ["fall", 1],
    ["hack", 3],
    ["exploit", 3],
    ["lawsuit", 2],
    ["outflow", 2],
    ["liquidation", 2],
    ["depeg", 3],
    ["breach", 3],
    ["drain", 3],
    ["unlock", 2],
    ["sell-off", 2],
    ["rejection", 1],
  ],
};

function toIsoDate(value) {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  return normalizeWhitespace(String(value || "").replace(/<[^>]+>/g, " "));
}

function canonicalUrl(raw) {
  const value = String(raw || "").trim();
  if (!value || value === "#") return "#";
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return value;
  }
}

function tokenize(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9$ ]/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

function titleFingerprint(title) {
  return tokenize(title).join(" ");
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? overlap / union : 0;
}

function canUseTicker(symbol, { allowUnknownTickers = false, knownTickerSet = null } = {}) {
  if (!symbol) return false;
  if (allowUnknownTickers) return true;
  if (knownTickerSet && knownTickerSet.size > 0) return knownTickerSet.has(symbol);
  return CORE_SYMBOLS.includes(symbol);
}

function extractTickers(text, existing = [], { allowUnknownTickers = false, knownTickerSet = null } = {}) {
  const found = new Set();
  (Array.isArray(existing) ? existing : []).forEach((value) => {
    const parsed = canonicalSymbol(value);
    if (canUseTicker(parsed, { allowUnknownTickers, knownTickerSet })) {
      found.add(parsed);
    }
  });
  const upper = ` ${String(text || "").toUpperCase()} `;

  const symbolTokens = upper.match(/\$[A-Z0-9]{2,10}\b/g) || [];
  symbolTokens.forEach((token) => {
    const parsed = canonicalSymbol(token.slice(1));
    if (canUseTicker(parsed, { allowUnknownTickers, knownTickerSet })) {
      found.add(parsed);
    }
  });

  const wordTokens = upper.match(/\b[A-Z]{2,6}\b/g) || [];
  wordTokens.forEach((word) => {
    const parsed = canonicalSymbol(word);
    if (canUseTicker(parsed, { allowUnknownTickers, knownTickerSet })) {
      found.add(parsed);
    }
  });

  const normalized = upper.replace(/[^A-Z0-9 ]/g, " ");
  Object.entries(TICKER_ALIAS).forEach(([name, symbol]) => {
    if (normalized.includes(` ${name} `)) {
      const parsed = canonicalSymbol(symbol);
      if (canUseTicker(parsed, { allowUnknownTickers, knownTickerSet })) {
        found.add(parsed);
      }
    }
  });

  return Array.from(found).slice(0, 8);
}

function scorePhraseHits(text, pairs) {
  const normalized = String(text || "").toLowerCase();
  const isNegated = (phrase) => {
    const escaped = phrase
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    const negationPattern = new RegExp(`\\b(?:not|no|hardly|rarely|without)\\b[^.!?]{0,24}\\b${escaped}\\b`, "i");
    return negationPattern.test(normalized);
  };

  return pairs.reduce((acc, [phrase, weight]) => {
    if (normalized.includes(phrase) && !isNegated(phrase)) {
      acc.score += weight;
      acc.hits.push(phrase);
    } else if (normalized.includes(phrase)) {
      acc.negated += 1;
    }
    return acc;
  }, { score: 0, hits: [], negated: 0 });
}

function inferSentimentMeta(text, matchedKeywords = []) {
  const normalized = String(text || "").toLowerCase();
  const bull = scorePhraseHits(normalized, SENTIMENT_WORDS.bullish);
  const bear = scorePhraseHits(normalized, SENTIMENT_WORDS.bearish);
  let score = bull.score - bear.score;
  if (bull.negated > 0) score -= 1;
  if (bear.negated > 0) score += 1;
  if (matchedKeywords.some((item) => item.eventType === "listing")) score += 1;
  if (matchedKeywords.some((item) => item.eventType === "exploit" || item.eventType === "regulation")) score -= 1;
  const magnitude = Math.abs(score);
  const confidence = score === 0 ? 50 : Math.min(96, 58 + magnitude * 8);

  if (score > 0) {
    return {
      sentiment: "bullish",
      sentimentScore: confidence,
      sentimentReason: bull.hits.length > 0
        ? `Bullish trigger words: ${bull.hits.slice(0, 3).join(", ")}.`
        : "Positive event weighting favors bullish bias.",
    };
  }

  if (score < 0) {
    return {
      sentiment: "bearish",
      sentimentScore: confidence,
      sentimentReason: bear.hits.length > 0
        ? `Bearish trigger words: ${bear.hits.slice(0, 3).join(", ")}.`
        : "Negative event weighting favors bearish bias.",
    };
  }

  return {
    sentiment: "neutral",
    sentimentScore: 50,
    sentimentReason: "No dominant bullish/bearish signal in the text.",
  };
}

function inferEventType(text, tickers, matchedKeywords) {
  if (/\bbreaking\b|\burgent\b|\bjust in\b/.test(text)) return "breaking";
  if (/\bsec\b|\bcftc\b|\bdoj\b|\bregulat/.test(text)) return "regulation";
  if (/\blisting\b|\blisted\b|\blaunches trading\b/.test(text)) return "listing";
  if (/\bexploit\b|\bhack\b|\bdrain\b|\bbreach\b/.test(text)) return "exploit";
  if (/\bfed\b|\bcpi\b|\bnfp\b|\btreasury\b|\brate hike\b|\brate cut\b/.test(text)) return "macro";
  if (/\bstablecoin\b|\busdt\b|\busdc\b|\bdai\b|\bdepeg\b|\bmint\b|\bburn\b/.test(text)) return "stablecoin";
  if (/\bbinance\b|\bcoinbase\b|\bbybit\b|\bokx\b|\bkraken\b|\bexchange\b/.test(text)) return "exchange";
  if (/\bon-chain\b|\bonchain\b|\bwallet\b|\baddress\b|\bbridge\b|\bliquidation\b/.test(text)) return "onchain";
  if (matchedKeywords.some((item) => item.eventType === "watchlist")) return "watchlist";
  if (tickers.length > 0) return "watchlist";
  return "noise";
}

function sourceImportance(source) {
  const normalized = String(source || "").trim();
  if (normalized.startsWith("Nitter @")) return 12;
  if (SOURCE_IMPORTANCE[normalized] != null) return SOURCE_IMPORTANCE[normalized];
  return 8;
}

function recencyScore(publishedAt, nowMs) {
  const ageMs = Math.max(0, nowMs - new Date(publishedAt).getTime());
  const ageHours = ageMs / (60 * 60 * 1000);
  if (ageHours <= 1) return 26;
  if (ageHours <= 3) return 20;
  if (ageHours <= 6) return 14;
  if (ageHours <= 12) return 9;
  if (ageHours <= 24) return 6;
  if (ageHours <= 48) return 3;
  return 0;
}

function computePriority({ source, publishedAt, text, tickers, watchlistTickers }) {
  const lower = text.toLowerCase();
  const matchedKeywords = PRIORITY_KEYWORDS.filter((item) => lower.includes(item.keyword));
  const sourceScore = sourceImportance(source);
  const recentScore = recencyScore(publishedAt, Date.now());
  const keywordScore = matchedKeywords.reduce((sum, item) => sum + item.weight, 0);
  const watchlistHit = tickers.some((ticker) => watchlistTickers.has(ticker));
  const watchlistScore = watchlistHit ? 14 : 0;
  const total = Math.min(100, sourceScore + recentScore + keywordScore + watchlistScore);
  return {
    total,
    matchedKeywords,
    watchlistHit,
  };
}

function classifyPriorityLabel(score) {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function buildId(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 20);
}

function normalizeRawNewsItem(raw, watchlistTickers, options = {}) {
  const { allowUnknownTickers = false, knownTickerSet = null } = options;
  const title = normalizeWhitespace(raw.title || raw.headline || "");
  if (!title) return null;
  const summary = stripHtml(raw.summary || raw.description || "");
  const source = normalizeWhitespace(raw.source || "Unknown");
  const url = canonicalUrl(raw.url || "#");
  const publishedAt = toIsoDate(raw.timestamp || raw.publishedAt || Date.now());
  const text = `${title} ${summary}`.trim();
  const tickers = extractTickers(text, raw.tickers, { allowUnknownTickers, knownTickerSet });
  const priorityMeta = computePriority({
    source,
    publishedAt,
    text,
    tickers,
    watchlistTickers,
  });
  const sentimentMeta = raw.sentiment
    ? {
        sentiment: raw.sentiment,
        sentimentScore: Number(raw.sentimentScore || 70),
        sentimentReason: String(raw.sentimentReason || "Provided by source."),
      }
    : inferSentimentMeta(text, priorityMeta.matchedKeywords);
  const keywordTags = priorityMeta.matchedKeywords.map((item) => item.tag);
  const tags = Array.from(
    new Set([
      ...keywordTags,
      ...tickers.map((ticker) => `ticker:${ticker}`),
      priorityMeta.watchlistHit ? "watchlist" : null,
    ].filter(Boolean)),
  );
  const eventType = raw.eventType && EVENT_PRIORITY.includes(raw.eventType)
    ? raw.eventType
    : inferEventType(text.toLowerCase(), tickers, priorityMeta.matchedKeywords);
  const id = String(raw.id || buildId(`${source}|${title}|${publishedAt}`));

  return {
    id,
    source,
    title,
    summary: summary.slice(0, 420),
    url,
    publishedAt,
    tickers,
    tags,
    priority: {
      score: priorityMeta.total,
      label: classifyPriorityLabel(priorityMeta.total),
      components: {
        source: sourceImportance(source),
        recency: recencyScore(publishedAt, Date.now()),
        keyword: priorityMeta.matchedKeywords.reduce((sum, item) => sum + item.weight, 0),
        watchlist: priorityMeta.watchlistHit ? 14 : 0,
      },
    },
    sentiment: sentimentMeta.sentiment,
    sentimentScore: sentimentMeta.sentimentScore,
    sentimentReason: sentimentMeta.sentimentReason,
    eventType,
    clusterId: null,
    sourceType: raw.sourceType || "news",
    provider: raw.provider || "unknown",
  };
}

function removeObviousDuplicates(items) {
  const byUrl = new Set();
  const byTitle = new Set();
  const output = [];
  for (const item of items) {
    const urlKey = item.url && item.url !== "#" ? item.url : null;
    const titleKey = titleFingerprint(item.title);
    if (urlKey && byUrl.has(urlKey)) continue;
    if (byTitle.has(titleKey)) continue;
    if (urlKey) byUrl.add(urlKey);
    byTitle.add(titleKey);
    output.push(item);
  }
  return output;
}

function clusterNearDuplicates(items) {
  const clusters = [];
  const clustered = [];

  items.forEach((item) => {
    let found = null;
    for (const cluster of clusters) {
      const leader = cluster.items[0];
      const sim = jaccardSimilarity(item.title, leader.title);
      const ageGap = Math.abs(new Date(item.publishedAt).getTime() - new Date(leader.publishedAt).getTime());
      if (sim >= 0.72 && ageGap <= 36 * 60 * 60 * 1000) {
        found = cluster;
        break;
      }
    }

    if (!found) {
      const cluster = { id: `cluster-${clusters.length + 1}`, items: [item] };
      clusters.push(cluster);
    } else {
      found.items.push(item);
    }
  });

  clusters.forEach((cluster) => {
    cluster.items.sort((a, b) => b.priority.score - a.priority.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const leader = cluster.items[0];
    leader.clusterId = cluster.id;
    clustered.push(leader);
  });

  const clusterSummary = clusters
    .filter((cluster) => cluster.items.length > 1)
    .map((cluster) => ({
      clusterId: cluster.id,
      headline: cluster.items[0].title,
      size: cluster.items.length,
      sources: Array.from(new Set(cluster.items.map((item) => item.source))),
      itemIds: cluster.items.map((item) => item.id),
    }));

  return { items: clustered, clusters: clusterSummary };
}

export function createNewsIngestionEngine({
  watchlistTickers = WATCHLIST_DEFAULT,
  allowUnknownTickers = false,
  logger,
} = {}) {
  const watchlist = new Set(
    (Array.isArray(watchlistTickers) ? watchlistTickers : WATCHLIST_DEFAULT)
      .map((item) => canonicalSymbol(item))
      .filter(Boolean),
  );
  const relevance = createWatchlistRelevance({ watchlistTickers: Array.from(watchlist) });

  function ingest(rawItems, options = {}) {
    const nowIso = toIsoDate(options.now || Date.now());
    const knownTickerSet = options.knownTickers instanceof Set
      ? options.knownTickers
      : new Set(
          (Array.isArray(options.knownTickers) ? options.knownTickers : CORE_SYMBOLS)
            .map((item) => canonicalSymbol(item))
            .filter(Boolean),
        );
    const normalized = (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => normalizeRawNewsItem(item, watchlist, { allowUnknownTickers, knownTickerSet }))
      .filter(Boolean);

    const deduped = removeObviousDuplicates(normalized);
    const { items: clustered, clusters } = clusterNearDuplicates(deduped);
    const ranked = clustered
      .sort((a, b) => {
        const eventRankA = EVENT_PRIORITY.indexOf(a.eventType);
        const eventRankB = EVENT_PRIORITY.indexOf(b.eventType);
        if (a.priority.score !== b.priority.score) return b.priority.score - a.priority.score;
        if (eventRankA !== eventRankB) return eventRankA - eventRankB;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, 150);

    const payload = {
      generatedAt: nowIso,
      count: ranked.length,
      items: ranked.map((item) => {
        const relevanceMeta = relevance.score(item.tickers, { priorityScore: item.priority.score });
        return {
          kind: "news",
          sourceType: item.sourceType || "news",
          id: item.id,
          source: item.source,
          title: item.title,
          summary: item.summary,
          url: item.url,
          publishedAt: item.publishedAt,
          tickers: item.tickers,
          relatedAssets: item.tickers,
          tags: item.tags,
          priority: item.priority,
          priorityLabel: relevanceMeta.priorityLabel,
          sentiment: item.sentiment,
          sentimentScore: item.sentimentScore,
          sentimentReason: item.sentimentReason,
          eventType: item.eventType,
          watchlistRelevance: relevanceMeta.score,
          relevanceLabels: relevanceMeta.labels,
        };
      }),
      clusters,
      status: ranked.length > 0 ? "ok" : "empty",
      errors: [],
    };

    logger?.info?.("news.engine.ingest", {
      input: normalized.length,
      deduped: deduped.length,
      clustered: ranked.length,
      clusters: clusters.length,
    });
    return payload;
  }

  return { ingest };
}
