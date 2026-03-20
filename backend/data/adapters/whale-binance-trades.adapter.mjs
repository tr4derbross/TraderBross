import { fetchJson } from "../../services/http.mjs";

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchBinanceLargeTradeEvents({
  symbols = DEFAULT_SYMBOLS,
  minUsd = 250_000,
  perSymbolLimit = 700,
} = {}) {
  const symbolList = (Array.isArray(symbols) ? symbols : DEFAULT_SYMBOLS)
    .map((item) => String(item || "").toUpperCase())
    .filter(Boolean)
    .slice(0, 12);
  const eventsBySymbol = await Promise.all(
    symbolList.map(async (symbol) => {
      try {
        const rows = await fetchJson(
          `https://api.binance.com/api/v3/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=${perSymbolLimit}`,
          { timeoutMs: 6000 },
        );
        const token = symbol.replace(/USDT$/, "");
        return (Array.isArray(rows) ? rows : [])
          .map((row) => {
            const price = toNum(row.p);
            const qty = toNum(row.q);
            const usdValue = price * qty;
            return {
              id: `binance-trade-${symbol}-${row.a}`,
              chain: "binance_spot",
              txHash: null,
              token,
              amount: qty,
              usdValue,
              fromLabel: row.m ? "Smart Money Seller" : "Smart Money Buyer",
              fromOwnerType: "smart_money",
              toLabel: "Market Fill",
              toOwnerType: "unknown",
              eventType: "smart_money_watch",
              timestamp: new Date(Number(row.T || Date.now())).toISOString(),
              relatedAssets: [token],
              provider: "binance_large_trades",
              rawText: `${symbol} large tape trade @ ${price}`,
            };
          })
          .filter((item) => item.usdValue >= minUsd);
      } catch {
        return [];
      }
    }),
  );

  return eventsBySymbol
    .flat()
    .sort((a, b) => b.usdValue - a.usdValue || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 140);
}
