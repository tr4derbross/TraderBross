// TraderBross News System v2.0 — Server-side RSS/Atom XML parser
// Uses only regex — no DOMParser (unavailable in Node.js), no external packages.
// Handles both CDATA and plain text in title/description/link.
// Handles both <pubDate> (RSS 2.0) and <published>/<updated> (Atom).
//
// NOTE: Sentiment/ticker/impact helpers are inlined here to avoid a circular
// dependency with news-aggregator.ts (which itself imports parseRSSFeed).

import type { NewsItem } from "@/types/news";

// ── Regex constants ────────────────────────────────────────────────────────────

const ITEM_REGEX = /<item>([\s\S]*?)<\/item>/g;
const ENTRY_REGEX = /<entry>([\s\S]*?)<\/entry>/g; // Atom feeds
const TITLE_REGEX = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
const LINK_REGEX =
  /<link(?:\s[^>]*)?>([^<]+)<\/link>|<link[^>]+href="([^"]+)"/i;
const DATE_REGEX =
  /<pubDate>([\s\S]*?)<\/pubDate>|<published>([\s\S]*?)<\/published>|<updated>([\s\S]*?)<\/updated>/i;
const DESC_REGEX =
  /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>|<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i;
const GUID_REGEX = /<guid[^>]*>([\s\S]*?)<\/guid>|<id>([\s\S]*?)<\/id>/i;

// ── Inlined helpers (mirrors news-aggregator.ts — no import to avoid cycles) ──

/** Strip all HTML tags from a string. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Decode common HTML entities. */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(parseInt(code, 10))
    );
}

function clean(raw: string): string {
  return decodeEntities(stripHtml(raw)).trim();
}

function parseDate(raw: string): Date {
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? new Date() : d;
}

function extractBlock(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    "i"
  );
  return xml.match(re)?.[1]?.trim() ?? "";
}

// Sentiment (inlined — mirrors news-aggregator.detectSentiment)
const BULLISH_WORDS = [
  "surge", "surges", "rally", "rallies", "bullish", "buy", "buying",
  "accumulate", "accumulation", "inflow", "inflows", "adoption", "approval",
  "approved", "record", "growth", "launch", "partnership", "upgrade", "breakout",
  "gains", "positive", "profit", "long", "withdrawal", "hodl",
];
const BEARISH_WORDS = [
  "crash", "crashes", "dump", "dumping", "bearish", "sell", "selling",
  "hack", "hacked", "exploit", "rug", "scam", "fraud", "lawsuit", "charges",
  "ban", "banned", "plunge", "plunges", "drop", "drops", "decline", "fall",
  "loss", "losses", "liquidation", "short", "regulation", "fine", "penalty",
  "warning", "attack", "breach", "stolen", "collapse", "fear",
];

function detectSentimentLocal(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  let bull = 0;
  let bear = 0;
  for (const w of BULLISH_WORDS) { if (lower.includes(w)) bull++; }
  for (const w of BEARISH_WORDS) { if (lower.includes(w)) bear++; }
  if (bull > bear + 1) return "bullish";
  if (bear > bull + 1) return "bearish";
  return "neutral";
}

// Ticker detection (inlined — mirrors news-aggregator.extractTickers)
const KNOWN_TICKERS_LOCAL = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "ARB", "OP",
  "NEAR", "INJ", "SUI", "APT", "TIA", "ATOM", "HYPE", "TON", "MATIC", "UNI",
];
const TICKER_KW: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "satoshi", "microstrategy", "gbtc"],
  ETH: ["ethereum", "eth", "vitalik", "ether"],
  SOL: ["solana", "sol"],
  BNB: ["binance", "bnb"],
  XRP: ["xrp", "ripple"],
  DOGE: ["dogecoin", "doge"],
  AVAX: ["avalanche", "avax"],
  LINK: ["chainlink"],
  ARB: ["arbitrum"],
  OP: ["optimism"],
  NEAR: ["near protocol"],
  INJ: ["injective"],
  ATOM: ["cosmos"],
  MATIC: ["polygon", "matic"],
  UNI: ["uniswap"],
};

function extractTickersLocal(text: string): string[] {
  const upper = text.toUpperCase();
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const ticker of KNOWN_TICKERS_LOCAL) {
    const re = new RegExp(`(?:^|[\\s$#,.(])${ticker}(?:[\\s,.)!?]|$)`, "g");
    if (re.test(upper)) found.add(ticker);
  }
  for (const [ticker, keywords] of Object.entries(TICKER_KW)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { found.add(ticker); break; }
    }
  }
  const result = Array.from(found).slice(0, 5);
  return result.length > 0 ? result : ["BTC"];
}

// Impact detection (inlined — mirrors news-aggregator.detectImpact)
const HIGH_IMPACT_WORDS_LOCAL = [
  "breaking", "sec", "etf", "hack", "exploit", "arrest", "charges", "approval",
  "approved", "ban", "banned", "crash", "surge", "liquidation", "all-time high",
  "ath", "record", "emergency", "halving", "fork",
];
const HIGH_IMPACT_SOURCES_LOCAL = [
  "CoinDesk", "CoinTelegraph", "Reuters", "Bloomberg", "The Block", "Decrypt",
];

function detectImpactLocal(text: string, source: string): "high" | "medium" | "low" {
  const lower = text.toLowerCase();
  for (const w of HIGH_IMPACT_WORDS_LOCAL) { if (lower.includes(w)) return "high"; }
  if (HIGH_IMPACT_SOURCES_LOCAL.includes(source)) return "medium";
  return "low";
}

// Breaking detection (inlined)
const BREAKING_PATTERNS_LOCAL = [/^breaking/i, /\bbreaking\b/i, /^alert:/i, /^urgent:/i, /\bjust in\b/i];

function detectBreakingLocal(text: string): boolean {
  return BREAKING_PATTERNS_LOCAL.some((re) => re.test(text));
}

// ── Raw entry interface ────────────────────────────────────────────────────────

interface RawEntry {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseEntry(chunk: string): RawEntry | null {
  const titleMatch = chunk.match(TITLE_REGEX);
  const title = titleMatch ? clean(titleMatch[1]) : "";
  if (!title) return null;

  const linkMatch = chunk.match(LINK_REGEX);
  const link = clean(linkMatch?.[1] ?? linkMatch?.[2] ?? "");

  const descMatch = chunk.match(DESC_REGEX);
  const rawDesc = descMatch?.[1] ?? descMatch?.[2] ?? "";
  const description = clean(rawDesc).slice(0, 400);

  const dateMatch = chunk.match(DATE_REGEX);
  const pubDate =
    (dateMatch ?? []).find((m, i) => i > 0 && m !== undefined) ??
    new Date().toISOString();

  const guidMatch = chunk.match(GUID_REGEX);
  const guid = clean(guidMatch?.[1] ?? guidMatch?.[2] ?? link);

  if (!link && !guid) return null;

  return { title, link: link || guid, description, pubDate, guid };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch and parse an RSS 2.0 or Atom feed.
 * Returns up to 25 NewsItem records. Never throws.
 */
export async function parseRSSFeed(
  url: string,
  sourceName: string,
  category: "news" | "social"
): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TraderBross/2.0 RSS Reader (+https://traderbross.com)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    const xml = await res.text();

    // Detect Atom vs RSS
    const isAtom = /<feed[\s>]/i.test(xml);
    const regex = isAtom
      ? new RegExp(ENTRY_REGEX.source, "g")
      : new RegExp(ITEM_REGEX.source, "g");

    const items: NewsItem[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = regex.exec(xml)) !== null && items.length < 25) {
      const entry = parseEntry(match[1]);
      if (!entry) continue;

      const fullText = `${entry.title} ${entry.description}`;

      items.push({
        id: `rss-${sourceName.toLowerCase().replace(/\s+/g, "-")}-${idx++}-${entry.guid.slice(-20)}`,
        title: entry.title,
        summary: entry.description || undefined,
        url: entry.link,
        source: sourceName,
        sourceLabel: sourceName,
        category,
        sentiment: detectSentimentLocal(fullText),
        tickers: extractTickersLocal(fullText),
        timestamp: parseDate(entry.pubDate),
        isBreaking: detectBreakingLocal(entry.title),
        impact: detectImpactLocal(fullText, sourceName),
      });
    }

    return items;
  } catch {
    return [];
  }
}

// ── Legacy compatibility export (used by news-service.ts) ────────────────────

export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
}

/** Fetch raw RSS items without converting to NewsItem. Used by legacy news-service. */
export async function fetchRSS(url: string, timeoutMs = 10_000): Promise<RSSItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TraderBross/2.0 RSS Reader",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const text = await res.text();
    const isAtom = /<feed[\s>]/i.test(text);
    const itemTag = isAtom ? "entry" : "item";
    const itemRegex = new RegExp(
      `<${itemTag}[\\s>]([\\s\\S]*?)<\\/${itemTag}>`,
      "gi"
    );

    const items: RSSItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(text)) !== null) {
      const chunk = match[1];
      const entry = parseEntry(chunk);
      if (!entry) continue;

      const author =
        clean(extractBlock(chunk, "dc:creator")) ||
        clean(extractBlock(chunk, "author")) ||
        clean(extractBlock(chunk, "name"));

      items.push({
        guid: entry.guid,
        title: entry.title,
        link: entry.link,
        description: entry.description,
        pubDate: entry.pubDate,
        ...(author ? { author } : {}),
      });
    }

    return items.slice(0, 25);
  } catch {
    return [];
  }
}
