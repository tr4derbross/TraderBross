/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Works per IP address. Not suitable for multi-instance deployments
 * (swap the Map for a Redis store in that case).
 */

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

/** Sweep stale entries every 5 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (entry.resetAt < now) windows.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Check whether the given key is within the allowed rate.
 * @param key     Unique key (e.g. `"vault-store:1.2.3.4"`)
 * @param limit   Max requests per window
 * @param windowMs Window size in milliseconds (default 60 s)
 * @returns `{ allowed: boolean; remaining: number }`
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return { allowed: entry.count <= limit, remaining };
}

function parseUpstashConfig() {
  const rawRateLimitUrl = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || "").trim();
  const restUrl =
    String(process.env.UPSTASH_REDIS_REST_URL || "").trim() ||
    (rawRateLimitUrl.startsWith("https://") ? rawRateLimitUrl : "");
  const restToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  const prefix = String(process.env.RATE_LIMIT_PREFIX || "traderbross:ratelimit").trim() || "traderbross:ratelimit";
  return { restUrl, restToken, prefix };
}

async function consumeDistributedCounter(key: string, windowMs: number): Promise<number | null> {
  const { restUrl, restToken, prefix } = parseUpstashConfig();
  if (!restUrl || !restToken) return null;

  const nowBucket = Math.floor(Date.now() / windowMs);
  const redisKey = `${prefix}:${key}:${nowBucket}`;
  const pipelineEndpoint = `${restUrl.replace(/\/+$/, "")}/pipeline`;

  try {
    const response = await fetch(pipelineEndpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${restToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs + 1000)],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as
      | Array<{ result?: number | string | null }>
      | null;
    const value = Array.isArray(payload) ? payload[0]?.result : null;
    const count = Number(value || 0);
    return Number.isFinite(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number }> {
  const distributedCount = await consumeDistributedCounter(key, windowMs);
  if (!distributedCount) {
    return rateLimit(key, limit, windowMs);
  }
  const remaining = Math.max(0, limit - distributedCount);
  return { allowed: distributedCount <= limit, remaining };
}

/** Extract the best-effort client IP from a Next.js request */
export function getClientIp(req: Request): string {
  const headers = req.headers as Headers;
  const trustProxyHeaders = String(process.env.TRUST_PROXY_HEADERS || "").toLowerCase() === "true";
  if (trustProxyHeaders) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const realIp = headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return headers.get("cf-connecting-ip")?.trim() || "unknown";
}
