// TraderBross News System v2.0 — Zero-Key Multi-Agent Build
// AGENT-1: Public Telegram HTML scraper — no API key required

export interface WhaleMessage {
  id: string;
  type: "transfer" | "exchange_inflow" | "exchange_outflow" | "liquidation";
  asset: string;
  amount?: number;
  amountUSD: number;
  from: string;
  to: string;
  side?: "LONG" | "SHORT";
  timestamp: Date;
  rawText: string;
  channel: string;
  channelUrl: string;
  severity: 1 | 2 | 3 | 4 | 5;
}

const WHALE_CHANNELS = [
  { url: "https://t.me/s/WhaleBotAlerts", type: "transfer" as const },
  { url: "https://t.me/s/WhaleBotRektd",  type: "liquidation" as const },
  { url: "https://t.me/s/whale_alert_io", type: "transfer" as const },
];

// Parse USD strings like "87.4M" → 87400000, "1.2B" → 1200000000, "500K" → 500000
function parseUSD(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  const match = cleaned.match(/^([\d.]+)([MBKmbk]?)$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "K") return Math.round(num * 1_000);
  return Math.round(num);
}

// Count 🚨 emojis for severity (1–5)
function parseSeverity(text: string): 1 | 2 | 3 | 4 | 5 {
  const count = (text.match(/🚨/g) ?? []).length;
  if (count >= 5) return 5;
  if (count === 4) return 4;
  if (count === 3) return 3;
  if (count === 2) return 2;
  return 1;
}

// Regex parsers
const TRANSFER_REGEX =
  /(\d[\d,]*)\s+(\w+)\s+\(\$([0-9,.]+[MBKmbk]?)\)\s+transferred?\s+from\s+(.+?)\s+to\s+(.+)/i;
const LIQUIDATION_REGEX =
  /\$([0-9,.]+[MBKmbk]?)\s+(\w+)\s+(LONG|SHORT)\s+LIQUIDATED?\s+at\s+\$([0-9,.]+)/i;
const AMOUNT_REGEX = /(\d[\d,.]+[MBKmbk]?)\s+(\w+)/;

// Known exchange labels (lowercase) to detect inflow/outflow
const KNOWN_EXCHANGES = new Set([
  "binance", "coinbase", "kraken", "okx", "bybit", "huobi", "kucoin",
  "gate.io", "gemini", "bitfinex", "bitstamp", "upbit", "bithumb",
]);

function isExchange(label: string): boolean {
  return KNOWN_EXCHANGES.has(label.toLowerCase().trim());
}

function resolveTransferType(
  from: string,
  to: string,
): "transfer" | "exchange_inflow" | "exchange_outflow" {
  const fromEx = isExchange(from);
  const toEx = isExchange(to);
  if (toEx && !fromEx) return "exchange_inflow";
  if (fromEx && !toEx) return "exchange_outflow";
  return "transfer";
}

function parseMessage(
  text: string,
  channelUrl: string,
  channelType: string,
): WhaleMessage | null {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const severity = parseSeverity(normalized);
  const id = `${channelUrl}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Try liquidation first
  const liqMatch = normalized.match(LIQUIDATION_REGEX);
  if (liqMatch ?? channelType === "liquidation") {
    if (liqMatch) {
      const amountUSD = parseUSD(liqMatch[1]);
      const asset = liqMatch[2].toUpperCase();
      const side = liqMatch[3].toUpperCase() as "LONG" | "SHORT";
      return {
        id,
        type: "liquidation",
        asset,
        amountUSD,
        from: "Exchange",
        to: "Liquidated",
        side,
        timestamp: new Date(),
        rawText: normalized,
        channel: channelUrl.replace("https://t.me/s/", "@"),
        channelUrl,
        severity,
      };
    }
  }

  // Try standard transfer
  const txMatch = normalized.match(TRANSFER_REGEX);
  if (txMatch) {
    const amount = parseFloat(txMatch[1].replace(/,/g, ""));
    const asset = txMatch[2].toUpperCase();
    const amountUSD = parseUSD(txMatch[3]);
    const from = txMatch[4].trim();
    const to = txMatch[5].trim();
    const type = resolveTransferType(from, to);
    return {
      id,
      type,
      asset,
      amount,
      amountUSD,
      from,
      to,
      timestamp: new Date(),
      rawText: normalized,
      channel: channelUrl.replace("https://t.me/s/", "@"),
      channelUrl,
      severity,
    };
  }

  // Fallback: try to extract at least asset + amount
  const amtMatch = normalized.match(AMOUNT_REGEX);
  if (!amtMatch) return null;

  const asset = amtMatch[2].toUpperCase();
  // Only keep messages with a recognizable crypto symbol
  const KNOWN_ASSETS = new Set([
    "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK",
    "ARB", "OP", "USDT", "USDC", "TRX", "SHIB", "TON", "ADA",
  ]);
  if (!KNOWN_ASSETS.has(asset)) return null;

  const amountUSD = parseUSD(amtMatch[1]);
  if (amountUSD < 100_000) return null; // ignore dust

  return {
    id,
    type: "transfer",
    asset,
    amountUSD,
    from: "Unknown",
    to: "Unknown",
    timestamp: new Date(),
    rawText: normalized,
    channel: channelUrl.replace("https://t.me/s/", "@"),
    channelUrl,
    severity,
  };
}

// Cache: 30 seconds
const cache = new Map<string, { data: WhaleMessage[]; ts: number }>();
const CACHE_TTL = 30_000;

export async function scrapeWhaleChannel(
  channelDef: (typeof WHALE_CHANNELS)[0],
): Promise<WhaleMessage[]> {
  const cached = cache.get(channelDef.url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(channelDef.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    // 10 second timeout
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${channelDef.url}`);
  }

  const html = await response.text();

  // Extract all tgme_widget_message_text blocks via regex (no DOMParser in Node)
  // Telegram preview pages use <div class="tgme_widget_message_text ...">...</div>
  const messagePattern =
    /<div[^>]+class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  const messages: WhaleMessage[] = [];
  let match: RegExpExecArray | null;

  while ((match = messagePattern.exec(html)) !== null) {
    const rawHtml = match[1];
    // Strip HTML tags, decode basic entities
    const text = rawHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (!text) continue;

    const parsed = parseMessage(text, channelDef.url, channelDef.type);
    if (parsed) {
      messages.push(parsed);
    }

    // Max 10 most recent messages per channel
    if (messages.length >= 10) break;
  }

  cache.set(channelDef.url, { data: messages, ts: Date.now() });
  return messages;
}

export async function getAllWhaleMessages(limit = 20): Promise<WhaleMessage[]> {
  const results = await Promise.allSettled(
    WHALE_CHANNELS.map((ch) => scrapeWhaleChannel(ch)),
  );

  const all: WhaleMessage[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
    // Rejected channels are silently skipped — fallback to mock in the route
  }

  // Sort newest first
  all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return all.slice(0, limit);
}
