import { NextResponse } from "next/server";
import { NewsItem, MOCK_WHALES } from "@/lib/mock-data";
import { WHALE_ALERT_URL } from "@/lib/news-sources";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhaleAlertTx {
  id: string;
  blockchain: string;
  symbol: string;
  amount: number;
  amount_usd: number;
  transaction_type: string;
  hash: string;
  from: { address?: string; owner?: string; owner_type?: string };
  to: { address?: string; owner?: string; owner_type?: string };
  timestamp: number;
}

interface BtcMempoolTx {
  hash: string;
  time: number;
  inputs: Array<{ prev_out?: { addr?: string; value?: number } }>;
  out: Array<{ addr?: string; value?: number }>;
}

interface BinanceAggTrade {
  a: number;   // aggregate trade ID
  p: string;   // price
  q: string;   // quantity
  T: number;   // timestamp
  m: boolean;  // is buyer maker (true = sell pressure, false = buy pressure)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelAddress(side: WhaleAlertTx["from"]): string {
  if (side.owner) {
    const name = side.owner.charAt(0).toUpperCase() + side.owner.slice(1);
    return name.replace(/_/g, " ");
  }
  const addr = side.address || "Unknown";
  return addr.length > 16 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "Unknown";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function blockchainToTicker(blockchain: string, symbol: string): string[] {
  const sym = symbol.toUpperCase();
  const map: Record<string, string> = {
    bitcoin: "BTC", ethereum: "ETH", solana: "SOL",
    "binance-chain": "BNB", "xrp-ledger": "XRP", tron: "TRX",
  };
  if (["USDT", "USDC", "DAI", "BUSD", "FRAX"].includes(sym)) return ["BTC", "ETH"];
  return [map[blockchain.toLowerCase()] || sym];
}

function formatAmount(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  return `$${(usd / 1000).toFixed(0)}K`;
}

function formatTokenAmount(amount: number, symbol: string): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${symbol}`;
  if (amount >= 1_000) return `${(amount / 1000).toFixed(1)}K ${symbol}`;
  return `${amount.toLocaleString()} ${symbol}`;
}

function inferSentimentFromWA(tx: WhaleAlertTx): "bullish" | "bearish" | "neutral" {
  const to = (tx.to.owner || "").toLowerCase();
  const from = (tx.from.owner || "").toLowerCase();
  const exchanges = ["binance", "coinbase", "kraken", "okex", "huobi", "bybit", "kucoin"];
  const toExchange = exchanges.some((e) => to.includes(e));
  const fromExchange = exchanges.some((e) => from.includes(e));
  if (toExchange && !fromExchange) return "bearish";
  if (fromExchange && !toExchange) return "bullish";
  return "neutral";
}

// ─── Whale Alert API ──────────────────────────────────────────────────────────

async function fetchWhaleAlert(): Promise<NewsItem[]> {
  const apiKey = process.env.WHALE_ALERT_KEY;
  if (!apiKey) return [];
  try {
    const since = Math.floor(Date.now() / 1000) - 3600;
    const url = `${WHALE_ALERT_URL}&api_key=${apiKey}&start=${since}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    const txs: WhaleAlertTx[] = data.transactions || [];
    return txs.map((tx): NewsItem => ({
      id: `whale-wa-${tx.id || tx.hash?.slice(-10) || Date.now()}`,
      headline: `🐋 ${formatTokenAmount(tx.amount, tx.symbol.toUpperCase())} (${formatAmount(tx.amount_usd)}) moved from ${labelAddress(tx.from)} to ${labelAddress(tx.to)}`,
      summary: `${tx.blockchain} transaction: ${formatTokenAmount(tx.amount, tx.symbol.toUpperCase())} (${formatAmount(tx.amount_usd)}). ${labelAddress(tx.from)} → ${labelAddress(tx.to)}`,
      source: "Whale Alert",
      ticker: blockchainToTicker(tx.blockchain, tx.symbol),
      sector: "Crypto",
      timestamp: new Date(tx.timestamp * 1000),
      url: tx.hash ? `https://etherscan.io/tx/${tx.hash}` : "#",
      type: "whale",
      whaleAmountUsd: tx.amount_usd,
      whaleToken: tx.symbol.toUpperCase(),
      whaleFrom: labelAddress(tx.from),
      whaleTo: labelAddress(tx.to),
      whaleTxHash: tx.hash,
      whaleBlockchain: tx.blockchain,
      sentiment: inferSentimentFromWA(tx),
    }));
  } catch { return []; }
}

// ─── BTC Mempool (blockchain.info — free, no key) ─────────────────────────────

async function fetchBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { cache: "no-store", signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return 72000;
    const data = await res.json();
    return data.bitcoin?.usd ?? 72000;
  } catch { return 72000; }
}

async function fetchBtcMempoolWhales(): Promise<NewsItem[]> {
  const MIN_BTC = 8; // ~$576K+ at $72K/BTC
  try {
    const [btcRes, btcPrice] = await Promise.all([
      fetch("https://blockchain.info/unconfirmed-transactions?format=json", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "application/json" },
      }),
      fetchBtcPrice(),
    ]);
    if (!btcRes.ok) return [];
    const data = await btcRes.json();
    const txs: BtcMempoolTx[] = data.txs || [];

    const largeTxs = txs
      .map((tx) => {
        const totalSats = (tx.out || []).reduce((sum, o) => sum + (o.value || 0), 0);
        const totalBtc = totalSats / 1e8;
        const totalUsd = totalBtc * btcPrice;
        return { tx, totalBtc, totalUsd };
      })
      .filter(({ totalBtc }) => totalBtc >= MIN_BTC)
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 8);

    return largeTxs.map(({ tx, totalBtc, totalUsd }): NewsItem => {
      const fromAddr = tx.inputs?.[0]?.prev_out?.addr || "";
      const toAddr = tx.out?.[0]?.addr || "";
      const from = fromAddr ? truncateAddr(fromAddr) : "Unknown";
      const to = toAddr ? truncateAddr(toAddr) : "Unknown";

      return {
        id: `whale-btc-${tx.hash?.slice(-12) || Date.now()}`,
        headline: `🐋 ${totalBtc.toFixed(2)} BTC (${formatAmount(totalUsd)}) pending — ${from} → ${to}`,
        summary: `Unconfirmed Bitcoin transaction: ${totalBtc.toFixed(4)} BTC worth ${formatAmount(totalUsd)}. From: ${from} → To: ${to}. Tx: ${tx.hash?.slice(0, 14)}…`,
        source: "BTC Mempool",
        ticker: ["BTC"],
        sector: "Bitcoin",
        timestamp: tx.time ? new Date(tx.time * 1000) : new Date(),
        url: tx.hash ? `https://blockchain.info/tx/${tx.hash}` : "#",
        type: "whale",
        whaleAmountUsd: totalUsd,
        whaleToken: "BTC",
        whaleFrom: from,
        whaleTo: to,
        whaleTxHash: tx.hash,
        whaleBlockchain: "bitcoin",
        sentiment: "neutral",
      };
    });
  } catch { return []; }
}

// ─── Binance Large Spot Trades (free, no key) ─────────────────────────────────

const BINANCE_SYMBOLS = [
  { symbol: "BTCUSDT", token: "BTC", minUsd: 200_000 },
  { symbol: "ETHUSDT", token: "ETH", minUsd: 100_000 },
  { symbol: "SOLUSDT", token: "SOL", minUsd:  80_000 },
  { symbol: "BNBUSDT", token: "BNB", minUsd:  80_000 },
];

async function fetchBinanceLargeTrades(): Promise<NewsItem[]> {
  const results: NewsItem[] = [];

  await Promise.allSettled(
    BINANCE_SYMBOLS.map(async ({ symbol, token, minUsd }) => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=50`,
          { cache: "no-store", signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) return;
        const trades: BinanceAggTrade[] = await res.json();

        // Filter large trades
        for (const t of trades) {
          const price = parseFloat(t.p);
          const qty = parseFloat(t.q);
          const usd = price * qty;
          if (usd < minUsd) continue;

          const side = t.m ? "sold" : "bought";
          const sentiment: "bullish" | "bearish" | "neutral" = t.m ? "bearish" : "bullish";
          results.push({
            id: `whale-binance-${symbol}-${t.a}`,
            headline: `🐋 ${qty.toFixed(2)} ${token} (${formatAmount(usd)}) ${side} on Binance`,
            summary: `Large Binance spot trade: ${qty.toFixed(4)} ${token} at $${price.toLocaleString("en-US", { maximumFractionDigits: 2 })} = ${formatAmount(usd)}. ${t.m ? "Aggressive sell (taker)" : "Aggressive buy (taker)"}.`,
            source: "Binance Spot",
            ticker: [token],
            sector: "Crypto",
            timestamp: new Date(t.T),
            url: "#",
            type: "whale",
            whaleAmountUsd: usd,
            whaleToken: token,
            whaleFrom: t.m ? "Whale Seller" : "Unknown",
            whaleTo: t.m ? "Binance" : "Whale Buyer",
            whaleTxHash: String(t.a),
            whaleBlockchain: "binance",
            sentiment,
          });
        }
      } catch { /* ignore per-symbol failures */ }
    })
  );

  return results;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  // 1. Try Whale Alert (if API key configured)
  const waItems = await fetchWhaleAlert();
  if (waItems.length > 0) return NextResponse.json(waItems);

  // 2. Fetch free on-chain data in parallel
  const [mempoolItems, binanceItems] = await Promise.all([
    fetchBtcMempoolWhales(),
    fetchBinanceLargeTrades(),
  ]);

  const combined = [...mempoolItems, ...binanceItems].sort(
    (a, b) => (b.whaleAmountUsd || 0) - (a.whaleAmountUsd || 0)
  );

  if (combined.length > 0) return NextResponse.json(combined.slice(0, 20));

  // 3. Last resort: mock data
  return NextResponse.json(MOCK_WHALES);
}
