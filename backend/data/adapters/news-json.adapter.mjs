import { fetchJson } from "../../services/http.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";

function inferSentimentFromVotes(positive = 0, negative = 0) {
  if (positive > negative) return "bullish";
  if (negative > positive) return "bearish";
  return "neutral";
}

function parseBlockchairTime(value) {
  if (!value) return new Date().toISOString();
  const normalized = String(value).trim().replace(" ", "T");
  const withZone = /z$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export async function fetchJsonNews({ cryptopanicKey = "", cryptocompareApiKey = "" } = {}) {
  const requests = [
    fetchJson("https://api.blockchair.com/news", { timeoutMs: 7000 }),
  ];
  if (cryptocompareApiKey) {
    requests.push(
      fetchJson(
        `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&api_key=${encodeURIComponent(
          cryptocompareApiKey,
        )}`,
        { timeoutMs: 7000 },
      ),
    );
  }

  // CryptoPanic v1 endpoint often returns 404 without the correct account tier.
  // Keep it optional to avoid wasting free-tier request budget.
  if (cryptopanicKey) {
    const params = new URLSearchParams({
      auth_token: cryptopanicKey,
      kind: "news",
      metadata: "true",
      regions: "en",
    });
    requests.push(fetchJson(`https://cryptopanic.com/api/v1/posts/?${params.toString()}`, { timeoutMs: 7000 }));
  }

  const settled = await Promise.allSettled(requests);
  const [blockchair, cc, cp] = settled;
  const output = [];

  if (blockchair?.status === "fulfilled") {
    const rows = Array.isArray(blockchair.value?.data) ? blockchair.value.data : [];
    rows
      .filter((row) => {
        const language = String(row?.language || "").toLowerCase();
        return !language || language === "en";
      })
      .slice(0, 40)
      .forEach((row, index) => {
        output.push(
          normalizeNewsEvent({
            id: `bc-${row.hash || index}`,
            title: row.title,
            summary: String(row.description || row.title || "").slice(0, 300),
            source: row.source || "Blockchair",
            sourceType: "news",
            sentiment: "neutral",
            importance: "watch",
            tickers: [],
            url: row.link || row.permalink || "#",
            timestamp: parseBlockchairTime(row.time),
            provider: "json",
          }),
        );
      });
  }

  if (cc?.status === "fulfilled") {
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

  if (cp?.status === "fulfilled") {
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
