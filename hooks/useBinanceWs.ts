"use client";

import { useEffect, useRef, useState } from "react";
import { type TickerQuote } from "@/lib/mock-data";

const BINANCE_WS_BASE = "wss://data-stream.binance.vision";

const SYMBOLS: Record<string, string> = {
  // Top 10
  BTC: "BTCUSDT", ETH: "ETHUSDT", BNB: "BNBUSDT", XRP: "XRPUSDT", SOL: "SOLUSDT",
  DOGE: "DOGEUSDT", ADA: "ADAUSDT", TRX: "TRXUSDT", AVAX: "AVAXUSDT", SHIB: "SHIBUSDT",
  // 11-25
  TON: "TONUSDT", LINK: "LINKUSDT", DOT: "DOTUSDT", LTC: "LTCUSDT", BCH: "BCHUSDT",
  UNI: "UNIUSDT", ICP: "ICPUSDT", NEAR: "NEARUSDT", APT: "APTUSDT", OP: "OPUSDT",
  ARB: "ARBUSDT", ATOM: "ATOMUSDT", FIL: "FILUSDT", VET: "VETUSDT", HBAR: "HBARUSDT",
  // 26-50
  MKR: "MKRUSDT", IMX: "IMXUSDT", STX: "STXUSDT", ALGO: "ALGOUSDT", GRT: "GRTUSDT",
  EOS: "EOSUSDT", AAVE: "AAVEUSDT", INJ: "INJUSDT", SUI: "SUIUSDT", SEI: "SEIUSDT",
  TIA: "TIAUSDT", RUNE: "RUNEUSDT", LDO: "LDOUSDT", RNDR: "RNDRUSDT", FET: "FETUSDT",
  WLD: "WLDUSDT", PENDLE: "PENDLEUSDT", PYTH: "PYTHUSDT", JTO: "JTOUSDT", BLUR: "BLURUSDT",
  // 51-70
  ETC: "ETCUSDT", SNX: "SNXUSDT", CRV: "CRVUSDT", COMP: "COMPUSDT", SUSHI: "SUSHIUSDT",
  CAKE: "CAKEUSDT", APE: "APEUSDT", SAND: "SANDUSDT", MANA: "MANAUSDT", AXS: "AXSUSDT",
  GALA: "GALAUSDT", ENJ: "ENJUSDT", CHZ: "CHZUSDT", FLOW: "FLOWUSDT", XLM: "XLMUSDT",
  GMX: "GMXUSDT", DYDX: "DYDXUSDT", MAGIC: "MAGICUSDT", ANKR: "ANKRUSDT", WOO: "WOOUSDT",
  // 71-100
  FTM: "FTMUSDT", THETA: "THETAUSDT", YFI: "YFIUSDT", ZEC: "ZECUSDT", BAND: "BANDUSDT",
  OCEAN: "OCEANUSDT", AGIX: "AGIXUSDT", GMT: "GMTUSDT", ALPHA: "ALPHAUSDT", BNT: "BNTUSDT",
  CELR: "CELRUSDT", SKL: "SKLUSDT", ARPA: "ARPAUSDT", ACH: "ACHUSDT", COTI: "COTIUSDT",
  TRB: "TRBUSDT", GLMR: "GLMRUSDT", ZIL: "ZILUSDT", IOST: "IOSTUSDT", QTUM: "QTUMUSDT",
  ONT: "ONTUSDT", WAVES: "WAVESUSDT", REEF: "REEFUSDT", "1INCH": "1INCHUSDT", ZRX: "ZRXUSDT",
  PEPE: "PEPEUSDT", FLOKI: "FLOKIUSDT", HOOK: "HOOKUSDT", HIGH: "HIGHUSDT", SFP: "SFPUSDT",
};

const REVERSE = Object.fromEntries(
  Object.entries(SYMBOLS).map(([ticker, symbol]) => [symbol, ticker])
);

const WS_URL = `${BINANCE_WS_BASE}/stream?streams=!miniTicker@arr`;

const FALLBACK_PRICES: Record<string, number> = {
  BTC: 71000, ETH: 2100, BNB: 600, XRP: 1.4, SOL: 88,
  DOGE: 0.095, ADA: 0.38, TRX: 0.12, AVAX: 9.5, SHIB: 0.000014,
  TON: 3.5, LINK: 9.2, DOT: 1.4, LTC: 75, BCH: 330,
  UNI: 6.2, ICP: 7.5, NEAR: 1.3, APT: 4.8, OP: 0.85,
  ARB: 0.38, ATOM: 4.2, FIL: 3.2, VET: 0.022, HBAR: 0.055,
  MKR: 1450, IMX: 0.95, STX: 0.82, ALGO: 0.12, GRT: 0.095,
  EOS: 0.55, AAVE: 92, INJ: 12, SUI: 1.8, SEI: 0.22,
  TIA: 3.8, RUNE: 2.8, LDO: 0.82, RNDR: 3.5, FET: 0.95,
  WLD: 1.1, PENDLE: 2.2, PYTH: 0.28, JTO: 1.8, BLUR: 0.18,
  ETC: 18, SNX: 1.2, CRV: 0.38, COMP: 42, SUSHI: 0.75,
  CAKE: 1.8, APE: 0.52, SAND: 0.28, MANA: 0.28, AXS: 4.2,
  GALA: 0.015, ENJ: 0.12, CHZ: 0.055, FLOW: 0.42, XLM: 0.088,
  GMX: 18, DYDX: 0.75, MAGIC: 0.42, ANKR: 0.022, WOO: 0.12,
  FTM: 0.42, THETA: 0.82, YFI: 4200, ZEC: 25, BAND: 1.0,
  OCEAN: 0.38, AGIX: 0.35, GMT: 0.082, ALPHA: 0.055, BNT: 0.38,
  CELR: 0.012, SKL: 0.028, ARPA: 0.028, ACH: 0.018, COTI: 0.055,
  TRB: 42, GLMR: 0.12, ZIL: 0.012, IOST: 0.0055, QTUM: 2.2,
  ONT: 0.18, WAVES: 1.1, REEF: 0.0012, "1INCH": 0.25, ZRX: 0.22,
  PEPE: 0.0000075, FLOKI: 0.000075, HOOK: 0.15, HIGH: 0.22, SFP: 0.42,
};

function getDecimals(price: number) {
  if (price < 1) return 5;
  if (price < 10) return 4;
  if (price < 1000) return 3;
  return 2;
}

export function useBinanceWs() {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK_PRICES);
  const [connected, setConnected] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (!alive.current) return;

      socket = new WebSocket(WS_URL);

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          data?: Array<{
            s: string;
            c: string;
            o: string;
          }>;
        };

        const entries = payload.data;
        if (!Array.isArray(entries)) return;

        setQuotes((prev) => {
          const nextMap = new Map(prev.map((quote) => [quote.symbol, quote]));
          const priceUpdates: Record<string, number> = {};

          for (const item of entries) {
            const ticker = REVERSE[item.s];
            if (!ticker) continue;

            const price = parseFloat(item.c);
            const open = parseFloat(item.o);
            const change = price - open;
            const changePct = open > 0 ? (change / open) * 100 : 0;
            const dp = getDecimals(price);

            priceUpdates[ticker] = price;
            nextMap.set(ticker, {
              symbol: ticker,
              price: parseFloat(price.toFixed(dp)),
              change: parseFloat(change.toFixed(dp)),
              changePct: parseFloat(changePct.toFixed(2)),
            });
          }

          if (Object.keys(priceUpdates).length > 0) {
            setPrices((current) => ({ ...current, ...priceUpdates }));
          }

          return Array.from(nextMap.values());
        });
      };

      socket.onclose = () => {
        setConnected(false);
        if (alive.current) {
          timer = setTimeout(connect, 2500);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      alive.current = false;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { prices, quotes, connected };
}
