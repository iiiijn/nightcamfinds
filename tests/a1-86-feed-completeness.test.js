"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createFeedSnapshotCache } = require("../src/services/feed-snapshot-cache.cjs");

const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("server uses visitor-specific feed cache identity instead of country-only snapshots", () => {
  assert.match(serverSource, /buildFeedCacheKey\(\{country:visitor,clientIp:rawIp\}\)/);
  assert.doesNotMatch(serverSource, /const cacheKey=visitor!==["']UNKNOWN["']\?["']country:/);
  assert.match(serverSource, /cacheScope:["']visitor-ip["']/);
});

test("BongaCams V2 limits the final page to the remaining configured inventory", () => {
  assert.match(serverSource, /remainingLimit=Math\.max\(1,Math\.min\(limit,BONGA_LIMIT-offset\)\)/);
  assert.match(serverSource, /limit:remainingLimit,offset/);
});

test("BongaCams logs safe configuration state without exposing origin credentials", () => {
  assert.match(serverSource, /BongaCams feed configuration/);
  assert.match(serverSource, /configuredApiVersion:BONGA_API_VERSION/);
  assert.match(serverSource, /trustedClientIpHeaderConfigured:Boolean\(BONGA_TRUSTED_CLIENT_IP_HEADER\)/);
  assert.match(serverSource, /originAuthConfigured:Boolean\(BONGA_ORIGIN_AUTH_SECRET\)/);
  assert.doesNotMatch(serverSource, /originAuthConfigured:BONGA_ORIGIN_AUTH_SECRET/);
});

test("an incomplete cold refresh is not cached as a successful feed snapshot", async () => {
  let calls = 0;
  const cache = createFeedSnapshotCache({ now: () => 10000 });
  const incomplete = async () => {
    calls += 1;
    return { at: 10000, rooms: [{ id: "partial" }], cacheable: false, notice: "A provider region failed." };
  };
  await cache.get("ip:GB:visitor-a", incomplete);
  await cache.get("ip:GB:visitor-a", incomplete);
  assert.equal(calls, 2);
});
