function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const runtimeEnv = {
  apiBaseUrl: trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4001"),
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:4001/ws",
};

export function buildApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${runtimeEnv.apiBaseUrl}${normalized}`;
}
