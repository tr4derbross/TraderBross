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

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
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
