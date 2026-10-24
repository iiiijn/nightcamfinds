class FeedCache {
  constructor({ ttlMs = 15000, staleMs = 120000 } = {}) {
    this.ttlMs = ttlMs;
    this.staleMs = staleMs;
    this.entries = new Map();
  }

  async get(key, loader) {
    const now = Date.now();
    const current = this.entries.get(key);

    if (current && now - current.fetchedAt < this.ttlMs) {
      return { ...current, stale: false, cached: true };
    }

    try {
      const rooms = await loader();
      const entry = {
        fetchedAt: Date.now(),
        rooms: Array.isArray(rooms) ? rooms : [],
        error: ""
      };
      this.entries.set(key, entry);
      return { ...entry, stale: false, cached: false };
    } catch (error) {
      if (current && now - current.fetchedAt < this.staleMs) {
        return {
          ...current,
          stale: true,
          cached: true,
          error: String(error?.message || error)
        };
      }
      throw error;
    }
  }

  clear(key) {
    if (key) this.entries.delete(key);
    else this.entries.clear();
  }
}

module.exports = { FeedCache };
