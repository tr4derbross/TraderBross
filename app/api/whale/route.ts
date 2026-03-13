import { NextResponse } from "next/server";
import { NewsItem, MOCK_WHALES } from "@/lib/mock-data";
import { WHALE_ALERT_URL } from "@/lib/news-sources";

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

function labelAddress(side: WhaleAlertTx["from"]): string {
  if (side.owner) {
    const name = side.owner.charAt(0).toUpperCase() + side.owner.slice(1);
    return name.replace(/_/g, " ");
  }
  const addr = side.address || "Unknown";
  return addr.length > 16 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function blockchainToTicker(blockchain: string, symbol: string): string[] {
  const sym = symbol.toUpperCase();
  const map: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
    solana: "SOL",
    "binance-chain": "BNB",
    "xrp-ledger": "XRP",
    tron: "TRX",
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

function buildHeadline(tx: WhaleAlertTx): string {
  const from = labelAddress(tx.from);
  const to = labelAddress(tx.to);
  const sym = tx.symbol.toUpperCase();
  const amt = formatTokenAmount(tx.amount, sym);
  const usd = formatAmount(tx.amount_usd);
  return `🐋 ${amt} (${usd}) moved from ${from} to ${to}`;
}

function inferSentiment(tx: WhaleAlertTx): "bullish" | "bearish" | "neutral" {
  const to = (tx.to.owner || "").toLowerCase();
  const from = (tx.from.owner || "").toLowerCase();
  const exchanges = ["binance", "coinbase", "kraken", "okex", "huobi", "bybit", "kucoin"];

  const toExchange = exchanges.some((e) => to.includes(e));
  const fromExchange = exchanges.some((e) => from.includes(e));

  if (toExchange && !fromExchange) return "bearish"; // moving TO exchange = potential sell
  if (fromExchange && !toExchange) return "bullish"; // withdrawing FROM exchange = accumulation
  return "neutral";
}

async function fetchWhaleAlert(): Promise<NewsItem[]> {
  const apiKey = process.env.WHALE_ALERT_KEY;
  if (!apiKey) return [];

  try {
    const since = Math.floor(Date.now() / 1000) - 3600; // last 1 hour
    const url = `${WHALE_ALERT_URL}&api_key=${apiKey}&start=${since}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();
    const txs: WhaleAlertTx[] = data.transactions || [];

    return txs.map((tx): NewsItem => ({
      id: `whale-${tx.id || tx.hash?.slice(-10) || Date.now()}`,
      headline: buildHeadline(tx),
      summary: `Transaction on ${tx.blockchain} network. Amount: ${formatTokenAmount(tx.amount, tx.symbol.toUpperCase())} (${formatAmount(tx.amount_usd)}). From: ${labelAddress(tx.from)} → To: ${labelAddress(tx.to)}`,
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
      sentiment: inferSentiment(tx),
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const apiItems = await fetchWhaleAlert();
  // Fall back to mock data if no API key or empty response
  const items = apiItems.length > 0 ? apiItems : MOCK_WHALES;
  return NextResponse.json(items);
}
