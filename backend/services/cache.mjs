export class MemoryCache {
  constructor() {
    this.store = new Map();
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

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}
