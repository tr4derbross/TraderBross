import { buildApiUrl } from "@/lib/runtime-env";

const DEFAULT_GET_TTL_MS = Number(process.env.NEXT_PUBLIC_CLIENT_FETCH_TTL_MS || 8000);
const inflightRequests = new Map<string, Promise<unknown>>();
const recentResponses = new Map<string, { expiresAt: number; value: unknown }>();

function normalizeMethod(init?: RequestInit) {
  return (init?.method || "GET").toUpperCase();
}

function getRequestKey(path: string, init?: RequestInit) {
  const method = normalizeMethod(init);
  return `${method}:${path}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = normalizeMethod(init);
  const isGet = method === "GET";
  const key = getRequestKey(path, init);

  if (isGet) {
    const cached = recentResponses.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (inflightRequests.has(key)) {
      return inflightRequests.get(key) as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(buildApiUrl(path), {
      ...init,
      cache: init?.cache ?? "no-store",
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      let detail = "";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await response.json() as { error?: string; message?: string; detail?: string };
          detail = payload?.message || payload?.error || payload?.detail || "";
        } else {
          detail = (await response.text()).trim();
        }
      } catch {
        detail = "";
      }
      throw new Error(detail ? `Request failed: ${response.status} (${detail})` : `Request failed: ${response.status}`);
    }

    const payload = (await response.json()) as T;
    if (isGet && DEFAULT_GET_TTL_MS > 0) {
      recentResponses.set(key, {
        value: payload,
        expiresAt: Date.now() + DEFAULT_GET_TTL_MS,
      });
    }
    return payload;
  })();

  if (isGet) {
    inflightRequests.set(key, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (isGet) {
      inflightRequests.delete(key);
    }
  }
}

export function clearApiClientCache() {
  inflightRequests.clear();
  recentResponses.clear();
}
