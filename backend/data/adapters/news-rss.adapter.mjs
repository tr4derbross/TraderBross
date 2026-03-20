import { fetchText } from "../../services/http.mjs";
import { normalizeNewsEvent } from "../core/normalize.mjs";

const DEFAULT_RSS_FEEDS = [
  { id: "cointelegraph", source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { id: "coindesk", source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss" },
  { id: "decrypt", source: "Decrypt", url: "https://decrypt.co/feed" },
  { id: "theblock", source: "The Block", url: "https://www.theblock.co/rss.xml" },
];

const DEFAULT_SOCIAL_REDDITS = ["CryptoCurrency", "Bitcoin", "ethfinance", "solana"];

function parseRss(xml) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const block of blocks.slice(0, 15)) {
    const content = block[1];
    const title =
      (content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] || content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "")
        .replace(/\s+/g, " ")
        .trim();
    const description =
      (content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
        content.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
        "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "#";
    const pubDate =
      content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ||
      content.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1] ||
      new Date().toISOString();
    if (!title) continue;
    items.push({ title, description, link, pubDate });
  }
  if (items.length > 0) return items;

  // Atom fallback (Reddit and many social feeds)
  const atomBlocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  for (const block of atomBlocks.slice(0, 20)) {
    const content = block[1];
    const title =
      (content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const summary =
      (content.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
        content.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
        "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const link =
      content.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)?.[1]?.trim() ||
      content.match(/<id>([\s\S]*?)<\/id>/i)?.[1]?.trim() ||
      "#";
    const pubDate =
      content.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ||
      content.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ||
      new Date().toISOString();
    if (!title) continue;
    items.push({ title, description: summary, link, pubDate });
  }
  return items;
}

function inferTickers(text) {
  const normalized = text.toLowerCase();
  const map = {
    BTC: ["bitcoin", " btc ", "xbt", "wbtc"],
    ETH: ["ethereum", " eth ", "weth", "steth"],
    SOL: ["solana", " sol "],
    BNB: ["binance", " bnb "],
    XRP: ["xrp", "ripple"],
    DOGE: ["doge"],
  };
  const matches = Object.entries(map)
    .filter(([, words]) => words.some((word) => normalized.includes(word)))
    .map(([symbol]) => symbol);
  return matches.length > 0 ? matches : [];
}

function inferImportance(text) {
  const lower = text.toLowerCase();
  if (["breaking", "sec", "etf", "hack", "lawsuit", "liquidation"].some((word) => lower.includes(word))) return "breaking";
  if (["surge", "plunge", "rally", "record", "inflow", "outflow"].some((word) => lower.includes(word))) return "market-moving";
  return "watch";
}

function inferSentiment(text) {
  const lower = text.toLowerCase();
  const bull = ["surge", "rally", "gain", "approval", "inflow", "buy"];
  const bear = ["drop", "fall", "hack", "sell", "outflow", "liquidation"];
  const bullScore = bull.filter((item) => lower.includes(item)).length;
  const bearScore = bear.filter((item) => lower.includes(item)).length;
  if (bullScore > bearScore) return "bullish";
  if (bearScore > bullScore) return "bearish";
  return "neutral";
}

export async function fetchRssNews({ feeds = DEFAULT_RSS_FEEDS } = {}) {
  const settled = await Promise.allSettled(
    feeds.map((feed) =>
      fetchText(feed.url, {
        timeoutMs: 7000,
        headers: {
          "User-Agent": "TraderBross/1.0 (+https://trader-bross.vercel.app)",
          Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        },
      }),
    ),
  );
  const output = [];

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const feed = feeds[index];
    const rows = parseRss(result.value);
    rows.forEach((row, rowIndex) => {
      const text = `${row.title} ${row.description}`.toLowerCase();
      const normalized = normalizeNewsEvent({
        id: `rss-${feed.id}-${rowIndex}-${new Date(row.pubDate).getTime() || Date.now()}`,
        title: row.title,
        summary: row.description.slice(0, 320),
        source: feed.source,
        sourceType: "news",
        sentiment: inferSentiment(text),
        importance: inferImportance(text),
        tickers: inferTickers(` ${text} `),
        url: row.link,
        timestamp: row.pubDate,
        provider: "rss",
      });
      output.push(normalized);
    });
  });

  return output;
}

export function getDefaultSocialRssFeeds(subreddits = DEFAULT_SOCIAL_REDDITS) {
  return (Array.isArray(subreddits) ? subreddits : DEFAULT_SOCIAL_REDDITS)
    .map((value) => String(value || "").trim().replace(/^r\//i, ""))
    .filter(Boolean)
    .slice(0, 30)
    .map((subreddit) => ({
      id: `reddit-${subreddit.toLowerCase()}`,
      source: `Reddit r/${subreddit}`,
      url: `https://www.reddit.com/r/${subreddit}/.rss`,
    }));
}

export function getDefaultNitterSocialFeeds(nitterBaseUrl = "", handles = []) {
  const base = String(nitterBaseUrl || "").trim().replace(/\/+$/, "");
  if (!base) return [];
  return (Array.isArray(handles) ? handles : [])
    .map((value) => String(value || "").trim().replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, 40)
    .map((handle) => ({
      id: `nitter-${handle.toLowerCase()}`,
      source: `Nitter @${handle}`,
      url: `${base}/${handle}/rss`,
    }));
}
