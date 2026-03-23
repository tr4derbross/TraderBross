export class MemoryCache {
  constructor() {
    this.store = new Map();
    /** Inflight deduplication: same key = same Promise, factory() called only once */
    this.inflight = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async remember(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // If another request is already fetching this key, reuse that Promise
    if (this.inflight.has(key)) {
      return this.inflight.get(key);
    }

    const promise = (async () => {
      try {
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }
}
