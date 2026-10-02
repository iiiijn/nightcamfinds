const FRESH_MS = 2 * 60 * 1000;
const STALE_MS = 10 * 60 * 1000;

export function createProviderCache() {
  const buckets = {};
  return {
    put(provider, rooms, at = Date.now()) {
      buckets[provider] = { rooms, at };
    },
    get(provider, now = Date.now()) {
      const bucket = buckets[provider];
      if (!bucket) return { state: "EXPIRED", rooms: [] };
      const age = now - bucket.at;
      if (age > STALE_MS) return { state: "EXPIRED", rooms: [] };
      if (age > FRESH_MS) return { state: "STALE_BUT_USABLE", rooms: bucket.rooms };
      return { state: "FRESH", rooms: bucket.rooms };
    },
    live() {
      const out = [];
      for (const provider of Object.keys(buckets)) {
        const snap = this.get(provider);
        if (snap.state === "EXPIRED") continue;
        for (const room of snap.rooms) out.push({ ...room, freshness: snap.state });
      }
      return out;
    }
  };
}
