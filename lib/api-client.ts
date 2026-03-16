import { buildApiUrl } from "@/lib/runtime-env";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
