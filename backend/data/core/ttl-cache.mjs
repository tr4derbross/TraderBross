export class TtlCache {
  constructor() {
    this.store = new Map();
  }

  getFresh(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry.value;
  }

  getStale(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.staleUntil <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs, staleMs = ttlMs * 3) {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      staleUntil: now + Math.max(staleMs, ttlMs),
    });
    return value;
  }

  async remember(key, { ttlMs, staleMs = ttlMs * 3 }, factory) {
    const fresh = this.getFresh(key);
    if (fresh !== null) {
      return { value: fresh, source: "cache:fresh" };
    }

    try {
      const value = await factory();
      this.set(key, value, ttlMs, staleMs);
      return { value, source: "provider" };
    } catch (error) {
      const stale = this.getStale(key);
      if (stale !== null) {
        return { value: stale, source: "cache:stale", error };
      }
      throw error;
    }
  }
}

