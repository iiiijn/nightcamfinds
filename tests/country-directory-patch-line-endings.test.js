"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { patchServerSource } = require("../scripts/patch-country-directory.js");

test("country directory startup patch supports CRLF checkouts and remains idempotent", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const windowsSource = source.replace(/\r?\n/g, "\r\n");
  const patched = patchServerSource(windowsSource);

  assert.ok(patched.includes("NIGHTCAMFINDS_COUNTRY_DIRECTORY_V1"));
  assert.ok(patched.includes("coalesceInFlight(roomFetchesInFlight,cacheKey"));
  assert.ok(patched.includes("summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms })"));
  assert.ok(patched.includes("\r\n"), "the patched file should retain CRLF line endings");
  assert.equal(patched.replace(/\r\n/g, "").includes("\n"), false, "the patched file should not contain mixed line endings");
  assert.equal(patchServerSource(patched), patched, "reapplying the patch should be a no-op");
});
