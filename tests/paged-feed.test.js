"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchPagedResults } = require("../src/services/paged-feed.cjs");

test("fetches sequential partner-feed pages until a short page is returned", async () => {
  const offsets = [];
  const result = await fetchPagedResults(async ({ offset, limit }) => {
    offsets.push([offset, limit]);
    if (offset === 0) return Array.from({ length: 2 }, (_, i) => ({ username: "model" + i }));
    return [{ username: "model2" }];
  }, { pageSize: 2, maxPages: 4 });
  assert.deepEqual(offsets, [[0, 2], [2, 2]]);
  assert.deepEqual(result.items.map((item) => item.username), ["model0", "model1", "model2"]);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.receivedCount, 3);
  assert.equal(result.uniqueCount, 3);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.truncated, false);
  assert.equal(result.stopReason, "short_page");
});

test("deduplicates repeated models across feed pages and reports duplicate volume", async () => {
  const result = await fetchPagedResults(async ({ offset }) => offset === 0
    ? [{ username: "alice" }, { username: "bob" }]
    : [{ username: "bob" }, { username: "cara" }], { pageSize: 2, maxPages: 2 });
  assert.deepEqual(result.items.map((item) => item.username), ["alice", "bob", "cara"]);
  assert.equal(result.receivedCount, 4);
  assert.equal(result.uniqueCount, 3);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.stopReason, "max_pages");
});

test("stops safely when a provider repeats the same page", async () => {
  let calls = 0;
  const result = await fetchPagedResults(async () => {
    calls += 1;
    return [{ username: "alice" }, { username: "bob" }];
  }, { pageSize: 2, maxPages: 5 });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.receivedCount, 4);
  assert.equal(result.duplicateCount, 2);
  assert.equal(result.truncated, true);
  assert.equal(result.stopReason, "repeated_page");
  assert.deepEqual(result.pageMetrics.map(({ offset, receivedCount, uniqueCount, duplicateCount }) => ({ offset, receivedCount, uniqueCount, duplicateCount })), [
    { offset: 0, receivedCount: 2, uniqueCount: 2, duplicateCount: 0 },
    { offset: 2, receivedCount: 2, uniqueCount: 0, duplicateCount: 2 }
  ]);
  assert.ok(result.pageMetrics.every((metric) => Number.isInteger(metric.responseTimeMs) && metric.responseTimeMs >= 0));
});

test("marks a feed as truncated when the configured page ceiling is reached", async () => {
  const result = await fetchPagedResults(async ({ offset }) => [
    { username: "model" + offset }, { username: "model" + (offset + 1) }
  ], { pageSize: 2, maxPages: 2 });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.receivedCount, 4);
  assert.equal(result.uniqueCount, 4);
  assert.equal(result.truncated, true);
  assert.equal(result.stopReason, "max_pages");
});

test("reports empty provider pages without marking a feed truncated", async () => {
  const result = await fetchPagedResults(async () => [], { pageSize: 2, maxPages: 3 });
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.receivedCount, 0);
  assert.equal(result.truncated, false);
  assert.equal(result.stopReason, "empty_page");
});

test("rejects malformed feed pages", async () => {
  await assert.rejects(() => fetchPagedResults(async () => ({ results: [] })), /must be an array/);
});
