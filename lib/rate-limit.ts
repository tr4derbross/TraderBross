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

/** Extract the best-effort client IP from a Next.js request */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (req.headers as Headers).get("x-real-ip") ?? "unknown";
}
