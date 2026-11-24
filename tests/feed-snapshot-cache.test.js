"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createFeedSnapshotCache } = require("../src/services/feed-snapshot-cache.cjs");

const snapshot = (at, rooms = [{ id: "chaturbate:room" }]) => ({ at, rooms, notice: "" });

test("returns a fresh snapshot without calling the provider", async () => {
  let time = 10000;
  let calls = 0;
  const cache = createFeedSnapshotCache({ ttlMs: 60000, now: () => time });
  const first = await cache.get("country:GB", async () => { calls += 1; return snapshot(time); });
  const second = await cache.get("country:GB", async () => { calls += 1; return snapshot(time); });
  assert.equal(calls, 1);
  assert.equal(second.at, first.at);
});

test("serves stale data immediately and refreshes it in the background", async () => {
  let time = 10000;
  let resolveRefresh;
  const saved = [];
  const cache = createFeedSnapshotCache({
    ttlMs: 1000,
    staleMs: 10000,
    now: () => time,
    saveSnapshot: async (key, value) => saved.push([key, value])
  });
  await cache.get("country:NL", async () => snapshot(time));
  time = 12000;
  const stale = await cache.get("country:NL", () => new Promise(resolve => { resolveRefresh = resolve; }));
  assert.equal(stale.stale, true);
  assert.equal(stale.at, 10000);
  assert.equal(typeof resolveRefresh, "function");
  resolveRefresh(snapshot(12000, [{ id: "chaturbate:new" }]));
  await new Promise(resolve => setImmediate(resolve));
  const fresh = await cache.get("country:NL", async () => assert.fail("fresh snapshot should be reused"));
  assert.equal(fresh.at, 12000);
  assert.equal(saved.length, 2);
});

test("loads a persisted snapshot before deciding whether to fetch", async () => {
  let calls = 0;
  const cache = createFeedSnapshotCache({
    ttlMs: 5000,
    now: () => 20000,
    loadSnapshot: async key => key === "country:US" ? snapshot(19000) : null
  });
  const result = await cache.get("country:US", async () => { calls += 1; return snapshot(20000); });
  assert.equal(result.at, 19000);
  assert.equal(calls, 0);
});

test("coalesces concurrent cold requests for the same cache key", async () => {
  let calls = 0;
  let resolveFetch;
  const cache = createFeedSnapshotCache({ now: () => 10000 });
  const fetcher = () => {
    calls += 1;
    return new Promise(resolve => { resolveFetch = resolve; });
  };
  const a = cache.get("country:DE", fetcher);
  const b = cache.get("country:DE", fetcher);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  resolveFetch(snapshot(10000));
  const [one, two] = await Promise.all([a, b]);
  assert.equal(one.at, two.at);
});

test("keeps a usable stale snapshot when a refresh fails", async () => {
  let time = 10000;
  const cache = createFeedSnapshotCache({ ttlMs: 1000, staleMs: 10000, now: () => time });
  await cache.get("country:CA", async () => snapshot(time));
  time = 12000;
  const stale = await cache.get("country:CA", async () => { throw new Error("provider timeout"); });
  assert.equal(stale.stale, true);
  assert.equal(stale.rooms.length, 1);
});

test("does not serve snapshots beyond the stale retention window", async () => {
  let time = 10000;
  const cache = createFeedSnapshotCache({ ttlMs: 1000, staleMs: 2000, now: () => time });
  await cache.get("country:AU", async () => snapshot(time));
  time = 13000;
  const result = await cache.get("country:AU", async () => snapshot(time, [{ id: "fresh" }]));
  assert.equal(result.at, 13000);
  assert.equal(result.rooms[0].id, "fresh");
});
