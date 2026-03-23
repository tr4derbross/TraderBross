import type {
  VenueAdapter,
  VenueActionResult,
  VenueBalance,
  VenueConnectionInput,
  VenueConnectionTestResult,
  VenueLeverageInput,
  VenueMarginModeInput,
  VenueOrderInput,
  VenuePosition,
  VenueTicker,
} from "@/lib/venues/types";
import { buildApiUrl } from "@/lib/runtime-env";

const FETCH_TIMEOUT_MS = 20_000;

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const signal = init?.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(buildApiUrl(input), { ...init, signal });
  if (!response.ok) {
    let detail = "";
    try {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await response.json() as { error?: string; message?: string };
        detail = body?.message || body?.error || "";
      }
    } catch { /* ignore */ }
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function createPollingSubscribe(
  getTicker: VenueAdapter["getTicker"],
  intervalMs = 5000
): VenueAdapter["subscribeTicker"] {
  return async (symbol, onTick) => {
    const push = async () => {
      const ticker = await getTicker(symbol);
      if (ticker) onTick(ticker);
    };

    await push();
    const intervalId = window.setInterval(() => {
      void push();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  };
}

export function notEnabledAction<TInput = void>(message: string) {
  return async (
    _input?: TInput,
    _connection?: VenueConnectionInput
  ): Promise<VenueActionResult> => ({
    ok: false,
    message,
  });
}

export async function emptyBalance(): Promise<VenueBalance | null> {
  return null;
}

export async function emptyPositions(): Promise<VenuePosition[]> {
  return [];
}

export async function disconnectedResult(message: string): Promise<VenueConnectionTestResult> {
  return { ok: false, message };
}

export function normalizeQuoteTicker(
  symbol: string,
  price: number,
  sourceLabel: string
): VenueTicker {
  return {
    symbol,
    price,
    sourceLabel,
    timestamp: Date.now(),
  };
}
