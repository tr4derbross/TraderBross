import { fetchJson } from "../../services/http.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";

const DEFAULT_NINJA_GRAPHQL_URL = "https://api-alpha.ninjanews.io/graphql";

const FETCH_NEWS_AND_TWEETS_QUERY = `
  query FetchNewsAndTweets {
    news {
      id
      type
      title
      image
      url
      description
      date
      publishedAt
      receivedAt
      data
      post
      source
      translations
      createdAt
      updatedAt
    }
    tweets {
      id
      type
      title
      image
      url
      description
      date
      publishedAt
      receivedAt
      data
      post
      source
      translations
      createdAt
      updatedAt
    }
  }
`;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function extractTickers(row) {
  const source = row?.source || {};
  const payload = row?.data?.externalPayload || row?.data || {};
  const suggestions = toArray(payload?.suggestions);
  const fromSourceTickers = toArray(source.tickers).map(upper);
  const fromSourceTicker = source?.ticker ? [upper(source.ticker)] : [];
  const fromPayloadCoin = payload?.coin ? [upper(payload.coin)] : [];
  const fromSuggestions = suggestions.map((item) => upper(item?.coin));
  return unique([
    ...fromSourceTickers,
    ...fromSourceTicker,
    ...fromPayloadCoin,
    ...fromSuggestions,
  ]).slice(0, 8);
}

function isCryptoRelevant(row, tickers = []) {
  if (tickers.length > 0) return true;
  const text = [
    row?.title,
    row?.description,
    row?.url,
    row?.source?.externalTypeCategory,
    row?.source?.externalType,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  const keywords = [
    "bitcoin",
    "ethereum",
    "solana",
    "crypto",
    "token",
    "blockchain",
    "web3",
    "defi",
    "stablecoin",
    "etf",
    "binance",
    "coinbase",
    "airdrop",
    "wallet",
    "onchain",
    "layer 2",
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeNinjaNewsRow(row) {
  const tickers = extractTickers(row);
  if (!isCryptoRelevant(row, tickers)) return null;
  const sourceLabel = firstNonEmpty(
    row?.source?.externalTypeCategory,
    row?.data?.externalPayload?.sourceName,
    row?.post?.source?.externalTypeCategory,
    row?.source?.externalType,
    row?.source?.id,
    "Unknown",
  );
  return normalizeNewsEvent({
    id: `ninja-news-${row?.id || Date.now()}`,
    title: row?.title || row?.data?.title || "",
    summary: String(row?.description || row?.data?.description || row?.title || "").slice(0, 380),
    source: sourceLabel,
    sourceType: "news",
    sentiment: "neutral",
    importance: "watch",
    tickers,
    url: row?.url || row?.data?.url || "#",
    timestamp: row?.receivedAt || row?.publishedAt || row?.date || row?.createdAt || new Date().toISOString(),
    provider: "ninjanews",
  });
}

function normalizeNinjaTweetRow(row) {
  const tickers = extractTickers(row);
  if (!isCryptoRelevant(row, tickers)) return null;
  const user = row?.data?.user || {};
  const sourceLabel = firstNonEmpty(
    row?.source?.externalTypeCategory,
    row?.data?.externalPayload?.source,
    row?.source?.externalType,
    "Twitter",
  );
  const normalizedSource = String(sourceLabel || "").toLowerCase() === "tweet" ? "Twitter" : sourceLabel;
  return normalizeNewsEvent({
    id: `ninja-social-${row?.id || Date.now()}`,
    title: row?.title || row?.data?.full_text || "",
    summary: String(row?.description || row?.data?.full_text || row?.title || "").slice(0, 380),
    source: normalizedSource,
    sourceType: "social",
    sentiment: "neutral",
    importance: "watch",
    tickers,
    url: row?.url || row?.data?.externalPayload?.url || "#",
    timestamp: row?.receivedAt || row?.publishedAt || row?.date || row?.createdAt || new Date().toISOString(),
    provider: "ninjanews",
    author: user?.name || row?.data?.externalPayload?.name || undefined,
    authorHandle: user?.screen_name || row?.data?.externalPayload?.username || undefined,
  });
}

export async function fetchNinjaNewsBundle({
  graphqlUrl = DEFAULT_NINJA_GRAPHQL_URL,
  limit = 30,
  timeoutMs = 7000,
} = {}) {
  const payload = await fetchJson(graphqlUrl, {
    method: "POST",
    timeoutMs,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      operationName: "FetchNewsAndTweets",
      query: FETCH_NEWS_AND_TWEETS_QUERY,
      variables: {},
    }),
  });
  const rowsNews = toArray(payload?.data?.news).slice(0, limit);
  const rowsTweets = toArray(payload?.data?.tweets).slice(0, limit);
  return {
    news: rowsNews.map(normalizeNinjaNewsRow).filter(Boolean),
    social: rowsTweets.map(normalizeNinjaTweetRow).filter(Boolean),
  };
}
