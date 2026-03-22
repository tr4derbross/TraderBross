import { Redis } from "@upstash/redis";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTtl(ttlSec) {
  return Math.max(1, toNumber(ttlSec, 2));
}

export function createUpstashCache(config, logger) {
  const restUrl = String(config?.upstash?.restUrl || "").trim();
  const restToken = String(config?.upstash?.restToken || "").trim();
  const prefix = String(config?.upstash?.prefix || "traderbross:cache").trim() || "traderbross:cache";
  const enabled = Boolean(restUrl && restToken);

  if (!enabled) {
    return {
      enabled: false,
      async getJson() {
        return null;
      },
      async setJson() {
        return false;
      },
      ttl: {
        bootstrapSec: normalizeTtl(config?.upstash?.ttl?.bootstrapSec),
        newsSec: normalizeTtl(config?.upstash?.ttl?.newsSec),
        pricesSec: normalizeTtl(config?.upstash?.ttl?.pricesSec),
      },
      key(rawKey) {
        return `${prefix}:${rawKey}`;
      },
    };
  }

  const redis = new Redis({ url: restUrl, token: restToken });
  let warned = false;

  function fullKey(rawKey) {
    return `${prefix}:${rawKey}`;
  }

  async function getJson(rawKey) {
    try {
      return await redis.get(fullKey(rawKey));
    } catch (error) {
      if (!warned) {
        warned = true;
        logger?.warn?.("upstash.cache.read_failed", { error: String(error) });
      }
      return null;
    }
  }

  async function setJson(rawKey, value, ttlSec) {
    try {
      await redis.set(fullKey(rawKey), value, { ex: normalizeTtl(ttlSec) });
      return true;
    } catch (error) {
      if (!warned) {
        warned = true;
        logger?.warn?.("upstash.cache.write_failed", { error: String(error) });
      }
      return false;
    }
  }

  return {
    enabled: true,
    getJson,
    setJson,
    ttl: {
      bootstrapSec: normalizeTtl(config?.upstash?.ttl?.bootstrapSec),
      newsSec: normalizeTtl(config?.upstash?.ttl?.newsSec),
      pricesSec: normalizeTtl(config?.upstash?.ttl?.pricesSec),
    },
    key: fullKey,
  };
}
