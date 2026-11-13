"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { coalesceInFlight } = require("../src/services/request-coalescing.cjs");

test("concurrent requests with the same key share one in-flight operation", async () => {
  const inFlight = new Map();
  let calls = 0;
  let release;
  const request = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };

  const first = coalesceInFlight(inFlight, "GB", request);
  const second = coalesceInFlight(inFlight, "GB", request);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  release({ rooms: 12 });
  assert.deepEqual(await first, { rooms: 12 });
  assert.equal(inFlight.size, 0);
});

test("different visitor cache keys remain isolated", async () => {
  const inFlight = new Map();
  let calls = 0;
  const request = async () => ({ call: ++calls });
  const [gb, us] = await Promise.all([
    coalesceInFlight(inFlight, "GB", request),
    coalesceInFlight(inFlight, "US", request)
  ]);
  assert.notDeepEqual(gb, us);
  assert.equal(calls, 2);
  assert.equal(inFlight.size, 0);
});

test("failed operations are removed so later requests can retry", async () => {
  const inFlight = new Map();
  let calls = 0;
  await assert.rejects(
    coalesceInFlight(inFlight, "IE", async () => {
      calls += 1;
      throw new Error("upstream unavailable");
    }),
    /upstream unavailable/
  );
  assert.equal(inFlight.size, 0);
  const result = await coalesceInFlight(inFlight, "IE", async () => {
    calls += 1;
    return "recovered";
  });
  assert.equal(result, "recovered");
  assert.equal(calls, 2);
  assert.equal(inFlight.size, 0);
});

test("startup patch wires request coalescing into the existing country feed loader", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { patchServerSource } = require("../scripts/patch-country-directory.js");
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const patched = patchServerSource(source);
  assert.match(patched, /request-coalescing\.cjs/);
  assert.match(patched, /coalesceInFlight\(roomFetchesInFlight,cacheKey/);
  assert.match(patched, /\[room-feed-refresh\]/);
});
