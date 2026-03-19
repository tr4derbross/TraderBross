import { fetchJson } from "../../services/http.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";

function inferSentimentFromVotes(positive = 0, negative = 0) {
  if (positive > negative) return "bullish";
  if (negative > positive) return "bearish";
  return "neutral";
}

export async function fetchJsonNews({ cryptopanicKey = "" } = {}) {
  const requests = [
    fetchJson("https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest", { timeoutMs: 6000 }),
  ];

  const params = new URLSearchParams({
    public: "true",
    kind: "news",
    metadata: "true",
    regions: "en",
  });
  if (cryptopanicKey) {
    params.set("auth_token", cryptopanicKey);
  }
  requests.push(fetchJson(`https://cryptopanic.com/api/v1/posts/?${params.toString()}`, { timeoutMs: 6000 }));

  const [cc, cp] = await Promise.allSettled(requests);
  const output = [];

  if (cc.status === "fulfilled") {
    const rows = Array.isArray(cc.value?.Data) ? cc.value.Data : [];
    rows.slice(0, 30).forEach((row, index) => {
      output.push(
        normalizeNewsEvent({
          id: `cc-${row.id || index}`,
          title: row.title,
          summary: String(row.body || row.title || "").slice(0, 300),
          source: row.source_info?.name || row.source || "CryptoCompare",
          sourceType: "news",
          sentiment: "neutral",
          importance: "watch",
          tickers: [],
          url: row.url || "#",
          timestamp: row.published_on ? new Date(Number(row.published_on) * 1000).toISOString() : new Date().toISOString(),
          provider: "json",
        }),
      );
    });
  }

  if (cp.status === "fulfilled") {
    const rows = Array.isArray(cp.value?.results) ? cp.value.results : [];
    rows.slice(0, 30).forEach((row) => {
      output.push(
        normalizeNewsEvent({
          id: `cp-${row.id}`,
          title: row.title,
          summary: row.metadata?.description || row.title,
          source: row.source?.title || "CryptoPanic",
          sourceType: "news",
          sentiment: inferSentimentFromVotes(row.votes?.positive, row.votes?.negative),
          importance: "watch",
          tickers: Array.isArray(row.currencies) ? row.currencies.map((item) => item.code) : [],
          url: row.url || "#",
          timestamp: row.published_at || new Date().toISOString(),
          provider: "json",
        }),
      );
    });
  }

  return output;
}

