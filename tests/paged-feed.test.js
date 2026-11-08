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
  assert.equal(result.truncated, false);
});

test("deduplicates repeated models across feed pages", async () => {
  const result = await fetchPagedResults(async ({ offset }) => offset === 0
    ? [{ username: "alice" }, { username: "bob" }]
    : [{ username: "bob" }, { username: "cara" }], { pageSize: 2, maxPages: 2 });
  assert.deepEqual(result.items.map((item) => item.username), ["alice", "bob", "cara"]);
  assert.equal(result.truncated, true);
});

test("stops safely when a provider repeats the same page", async () => {
  let calls = 0;
  const result = await fetchPagedResults(async () => {
    calls += 1;
    return [{ username: "alice" }, { username: "bob" }];
  }, { pageSize: 2, maxPages: 5 });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.truncated, false);
});

test("marks a feed as truncated when the configured page ceiling is reached", async () => {
  const result = await fetchPagedResults(async ({ offset }) => [
    { username: "model" + offset }, { username: "model" + (offset + 1) }
  ], { pageSize: 2, maxPages: 2 });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.truncated, true);
});

test("rejects malformed feed pages", async () => {
  await assert.rejects(() => fetchPagedResults(async () => ({ results: [] })), /must be an array/);
});
