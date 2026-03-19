export class SlidingWindowRateLimiter {
  constructor({ limit = 120, windowMs = 60_000 } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.windows = new Map();
  }

  consume(key) {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (existing.count >= this.limit) {
      return false;
    }
    existing.count += 1;
    return true;
  }
}

export async function runRateLimited(limiter, key, fn) {
  if (!limiter.consume(key)) {
    throw new Error(`rate_limit_exceeded:${key}`);
  }
  return fn();
}

