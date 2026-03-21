import { createClient } from "redis";

function createMemoryLimiter() {
  const windows = new Map();

  function consume(key, limit, windowMs) {
    const now = Date.now();
    const existing = windows.get(key);
    if (!existing || existing.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (existing.count >= limit) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  return { consume };
}

export function createRateLimiter(config, logger) {
  const memory = createMemoryLimiter();
  const redisUrl = String(config?.rateLimit?.redisUrl || "").trim();
  const keyPrefix = String(config?.rateLimit?.prefix || "traderbross:ratelimit");
  let client = null;
  let connecting = null;

  async function getClient() {
    if (!redisUrl) return null;
    if (client?.isReady) return client;
    if (connecting) return connecting;

    const next = createClient({ url: redisUrl });
    next.on("error", (error) => {
      logger?.warn?.("ratelimit.redis.error", { error: String(error) });
    });

    connecting = next
      .connect()
      .then(() => {
        client = next;
        connecting = null;
        logger?.info?.("ratelimit.redis.connected", {});
        return client;
      })
      .catch((error) => {
        connecting = null;
        logger?.warn?.("ratelimit.redis.connect_failed", { error: String(error) });
        try {
          next.disconnect();
        } catch {
          // no-op
        }
        return null;
      });
    return connecting;
  }

  async function consumeDistributed(key, limit, windowMs) {
    const redis = await getClient();
    if (!redis) return memory.consume(key, limit, windowMs);

    const nowBucket = Math.floor(Date.now() / windowMs);
    const redisKey = `${keyPrefix}:${key}:${nowBucket}`;
    try {
      const txResult = await redis.multi().incr(redisKey).pExpire(redisKey, windowMs + 1000).exec();
      const raw = Array.isArray(txResult?.[0]) ? txResult[0][1] : txResult?.[0];
      const count = Number(raw || 0);
      if (!Number.isFinite(count)) return memory.consume(key, limit, windowMs);
      return count <= limit;
    } catch (error) {
      logger?.warn?.("ratelimit.redis.consume_failed", { error: String(error) });
      return memory.consume(key, limit, windowMs);
    }
  }

  return { consume: consumeDistributed };
}

