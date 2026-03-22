import { fetchJson } from "../../services/http.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";
import { canonicalSymbol } from "../core/symbol-map.mjs";

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferImportance(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/(delist|suspend|halt|maintenance|termination|margin call|liquidation)/i.test(lower)) return "breaking";
  if (/(list|listing|launch|futures|perpetual|pair|trading|convert|index)/i.test(lower)) return "market-moving";
  return "watch";
}

function inferSentiment(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/(delist|suspend|halt|terminate|termination|remove pair|withdrawal suspended)/i.test(lower)) return "bearish";
  if (/(list|launch|add pair|new pair|new listing|will launch)/i.test(lower)) return "bullish";
  return "neutral";
}

function inferTickers(text = "") {
  const source = String(text || "").toUpperCase();
  const rawCandidates = [
    ...source.matchAll(/\b([A-Z0-9]{2,15})(?:USDT|USDC|USD)\b/g),
    ...source.matchAll(/\(([A-Z0-9]{2,15})\)/g),
    ...source.matchAll(/\b([A-Z0-9]{2,15})\b/g),
  ].map((m) => String(m?.[1] || "").trim());

  const mapped = rawCandidates
    .map((candidate) => {
      const stripped = candidate.replace(/(USDT|USDC|USD)$/i, "");
      return canonicalSymbol(stripped) || null;
    })
    .filter(Boolean);

  return Array.from(new Set(mapped)).slice(0, 6);
}

function isMarketRelevant(headline = "", summary = "") {
  const text = `${headline} ${summary}`.toLowerCase();
  if (/(airdrop campaign|prize pool|share [\d,]+ usdt|bonus reward campaign|trading competition|invite friends|learn and earn)/i.test(text)) {
    return false;
  }
  return /(list|listing|delist|futures|perpetual|trading pair|margin|convert|index|launch|suspend|withdrawal|deposit|maintenance)/i.test(
    text,
  );
}

async function fetchBinanceAnnouncements(limit = 20) {
  const payload = await fetchJson(
    `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=${Math.min(
      Math.max(5, Number(limit) || 20),
      40,
    )}`,
    {
      timeoutMs: 7000,
      headers: {
        "User-Agent": "TraderBross/1.0 (+https://trader-bross.vercel.app)",
        Accept: "application/json",
      },
    },
  );
  const catalogs = Array.isArray(payload?.data?.catalogs) ? payload.data.catalogs : [];
  const rows = [];
  for (const catalog of catalogs) {
    const articles = Array.isArray(catalog?.articles) ? catalog.articles : [];
    for (const article of articles) {
      rows.push({
        id: `binance-${article?.id || article?.code || Math.random().toString(16).slice(2)}`,
        title: String(article?.title || "").trim(),
        summary: String(catalog?.catalogName || "Binance Announcement"),
        source: "Binance",
        url: article?.code
          ? `https://www.binance.com/en/support/announcement/${article.code}`
          : "https://www.binance.com/en/support/announcement",
        timestamp: Number(article?.releaseDate) > 0 ? new Date(Number(article.releaseDate)).toISOString() : new Date().toISOString(),
      });
    }
  }
  return uniqueBy(rows, (row) => row.id).slice(0, limit);
}

async function fetchBybitAnnouncements(limit = 20) {
  const payload = await fetchJson(
    `https://api.bybit.com/v5/announcements/index?locale=en-US&limit=${Math.min(Math.max(5, Number(limit) || 20), 40)}`,
    {
      timeoutMs: 7000,
      headers: {
        "User-Agent": "TraderBross/1.0 (+https://trader-bross.vercel.app)",
        Accept: "application/json",
      },
    },
  );
  const rows = Array.isArray(payload?.result?.list) ? payload.result.list : [];
  return rows.slice(0, limit).map((row, index) => ({
    id: `bybit-${(row?.url || "").split("/").filter(Boolean).pop() || index}`,
    title: String(row?.title || "").trim(),
    summary: String(row?.description || row?.type?.title || "Bybit announcement").trim(),
    source: "Bybit",
    url: String(row?.url || "https://announcements.bybit.com/en-US/"),
    timestamp:
      Number(row?.publishTime || row?.dateTimestamp || 0) > 0
        ? new Date(Number(row.publishTime || row.dateTimestamp)).toISOString()
        : new Date().toISOString(),
  }));
}

async function fetchOkxAnnouncements(limit = 20) {
  const payload = await fetchJson(
    `https://www.okx.com/api/v5/support/announcements?page=1&limit=${Math.min(Math.max(5, Number(limit) || 20), 40)}`,
    {
      timeoutMs: 7000,
      headers: {
        "User-Agent": "TraderBross/1.0 (+https://trader-bross.vercel.app)",
        Accept: "application/json",
      },
    },
  );
  const buckets = Array.isArray(payload?.data) ? payload.data : [];
  const rows = [];
  for (const bucket of buckets) {
    const details = Array.isArray(bucket?.details) ? bucket.details : [];
    for (const row of details) {
      rows.push({
        id: `okx-${(row?.url || "").split("/").filter(Boolean).pop() || row?.pTime || Math.random().toString(16).slice(2)}`,
        title: String(row?.title || "").trim(),
        summary: String(row?.annType || "OKX announcement").replace(/^announcements-/, "").replace(/-/g, " "),
        source: "OKX",
        url: String(row?.url || "https://www.okx.com/help"),
        timestamp:
          Number(row?.businessPTime || row?.pTime || 0) > 0
            ? new Date(Number(row.businessPTime || row.pTime)).toISOString()
            : new Date().toISOString(),
      });
    }
  }
  return uniqueBy(rows, (row) => row.id).slice(0, limit);
}

export async function fetchExchangeAnnouncements({ limit = 30 } = {}) {
  const perSourceLimit = Math.max(5, Math.min(40, Math.round(Number(limit) / 2) || 15));
  const settled = await Promise.allSettled([
    fetchBinanceAnnouncements(perSourceLimit),
    fetchBybitAnnouncements(perSourceLimit),
    fetchOkxAnnouncements(perSourceLimit),
  ]);

  const [binance, bybit, okx] = settled;
  const merged = [
    ...(binance.status === "fulfilled" ? binance.value : []),
    ...(bybit.status === "fulfilled" ? bybit.value : []),
    ...(okx.status === "fulfilled" ? okx.value : []),
  ];

  const relevant = merged.filter((item) => isMarketRelevant(item.title, item.summary));
  const base = relevant.length > 0 ? relevant : merged;

  return uniqueBy(base, (item) => item.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, Math.max(10, Math.min(100, Number(limit) || 30)))
    .map((item) =>
      normalizeNewsEvent({
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        sourceType: "news",
        sentiment: inferSentiment(`${item.title} ${item.summary}`),
        importance: inferImportance(`${item.title} ${item.summary}`),
        tickers: inferTickers(`${item.title} ${item.summary}`),
        url: item.url,
        timestamp: item.timestamp,
        provider: "exchange_announcements",
      }),
    );
}
