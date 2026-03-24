import { AsterRestClient } from "asterdex-api";

const REST_BASE = "https://fapi.asterdex.com";
const WS_URL = "wss://fapi.asterdex.com/stream";

export function createAsterClient() {
  return new AsterRestClient({
    apiKey: "",
    apiSecret: "",
    futuresBaseUrl: REST_BASE,
  });
}

export async function getAsterOrderbook(symbol: string) {
  const res = await fetch(`${REST_BASE}/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=20`);
  return res.json();
}

export async function getAsterTicker(symbol: string) {
  const res = await fetch(`${REST_BASE}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
  return res.json();
}

export function subscribeAsterPrice(symbol: string, onData: (data: any) => void) {
  const ws = new WebSocket(`${WS_URL}/${symbol.toLowerCase()}@ticker`);
  ws.onmessage = (event) => onData(JSON.parse(event.data));
  return ws;
}
