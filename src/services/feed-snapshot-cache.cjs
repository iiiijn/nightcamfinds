"use strict";

function createFeedSnapshotCache(options = {}) {
  const ttlMs = Math.max(1000, Number(options.ttlMs) || 60000);
  const staleMs = Math.max(ttlMs, Number(options.staleMs) || 300000);
  const loadSnapshot = typeof options.loadSnapshot === "function" ? options.loadSnapshot : async () => null;
  const saveSnapshot = typeof options.saveSnapshot === "function" ? options.saveSnapshot : async () => {};
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const retryMs = Math.max(1000, Number(options.retryMs) || 15000);
  const local = new Map();
  const inFlight = new Map();
  const lastAttempt = new Map();

  function valid(snapshot) {
    return snapshot && Number.isFinite(Number(snapshot.at)) && Array.isArray(snapshot.rooms);
  }
  function isFresh(snapshot, time) {
    return valid(snapshot) && time - Number(snapshot.at) < ttlMs;
  }
  function isUsableStale(snapshot, time) {
    return valid(snapshot) && time - Number(snapshot.at) <= staleMs;
  }
  async function refresh(key, fetcher, staleSnapshot) {
    if (inFlight.has(key)) return inFlight.get(key);
    if (staleSnapshot) {
      if (lastAttempt.has(key) && now() - Number(lastAttempt.get(key)) < retryMs) return staleSnapshot;
      lastAttempt.set(key, now());
    }
    const task = (async () => {
      try {
        const snapshot = await fetcher();
        if (!valid(snapshot)) throw new TypeError("Feed refresh must return a timestamped room snapshot.");
        if (snapshot.cacheable === false) {
          return staleSnapshot
            ? { ...staleSnapshot, stale: true, refreshError: snapshot.notice || "A provider feed was incomplete." }
            : snapshot;
        }
        if (!snapshot.rooms.length && staleSnapshot && staleSnapshot.rooms.length) {
          return { ...staleSnapshot, stale: true, refreshError: "The latest provider refresh returned no rooms." };
        }
        const cacheableSnapshot = { ...snapshot };
        delete cacheableSnapshot.cacheable;
        local.set(key, cacheableSnapshot);
        try { await saveSnapshot(key, cacheableSnapshot); } catch {}
        return cacheableSnapshot;
      } catch (error) {
        if (staleSnapshot) return { ...staleSnapshot, stale: true, refreshError: String(error && error.message || "Feed refresh failed") };
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    return task;
  }
  async function get(key, fetcher) {
    const cacheKey = String(key);
    const time = now();
    let snapshot = local.get(cacheKey) || null;
    if (isFresh(snapshot, time)) return snapshot;

    if (!snapshot) {
      try {
        const stored = await loadSnapshot(cacheKey);
        if (valid(stored)) {
          snapshot = stored;
          local.set(cacheKey, stored);
        }
      } catch {}
    }
    const checkedAt = now();
    if (isFresh(snapshot, checkedAt)) return snapshot;
    if (isUsableStale(snapshot, checkedAt)) {
      void refresh(cacheKey, fetcher, snapshot).catch(() => {});
      return { ...snapshot, stale: true };
    }
    return refresh(cacheKey, fetcher, null);
  }
  return {
    get,
    clear(key) {
      if (key === undefined) { local.clear(); lastAttempt.clear(); }
      else { local.delete(String(key)); lastAttempt.delete(String(key)); }
    },
    get inFlightCount() { return inFlight.size; }
  };
}

module.exports = { createFeedSnapshotCache };
