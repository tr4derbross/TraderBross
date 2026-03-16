export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 6000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 6000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
