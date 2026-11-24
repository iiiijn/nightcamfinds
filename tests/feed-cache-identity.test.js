"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFeedCacheKey } = require("../src/services/feed-cache-identity.cjs");

test("feed cache keys isolate visitors even when they share a country", () => {
  const first = buildFeedCacheKey({ country: "GB", clientIp: "203.0.113.10" });
  const second = buildFeedCacheKey({ country: "GB", clientIp: "203.0.113.11" });
  assert.notEqual(first, second);
  assert.match(first, /^ip:GB:[a-f0-9]{48}$/);
});

test("feed cache keys retain country context and normalize unknown countries", () => {
  assert.notEqual(
    buildFeedCacheKey({ country: "GB", clientIp: "203.0.113.10" }),
    buildFeedCacheKey({ country: "US", clientIp: "203.0.113.10" })
  );
  assert.match(buildFeedCacheKey({ country: "XX", clientIp: "203.0.113.10" }), /^ip:UNKNOWN:/);
});

test("feed cache key requires a visitor IP", () => {
  assert.throws(() => buildFeedCacheKey({ country: "GB" }), /client IP is required/);
});
