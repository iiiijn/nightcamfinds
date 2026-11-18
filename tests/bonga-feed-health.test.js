"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveBongaV1Limit, summarizeBongaV1Feed } = require("../src/services/bonga-feed-health.cjs");
const fs = require("node:fs");
const path = require("node:path");

test("Bonga V1 limit preserves the existing default and clamps configuration", () => {
  assert.equal(resolveBongaV1Limit(undefined), 10);
  assert.equal(resolveBongaV1Limit("25"), 25);
  assert.equal(resolveBongaV1Limit("1"), 10);
  assert.equal(resolveBongaV1Limit("5000"), 100);
  assert.equal(resolveBongaV1Limit("invalid"), 10);
});

test("Bonga V1 diagnostics report counts without exposing model identities or raw country values", () => {
  const result = summarizeBongaV1Feed({
    rows: [{ username: "private-a", homecountry: "GB" }, { username: "private-b", country: "Germany" }, { username: "private-c" }],
    normalized: [{ username: "private-a" }, { username: "private-b" }], rooms: [{ username: "private-a" }],
    requestedLimit: 20, checkedAt: "2026-11-18T00:00:00.000Z"
  });
  assert.equal(result.status, "active_v1");
  assert.equal(result.pagination, "not_verified_single_response");
  assert.equal(result.rawRoomCount, 3);
  assert.equal(result.normalizedRoomCount, 2);
  assert.equal(result.acceptedRoomCount, 1);
  assert.equal(result.rejectedOrDuplicateCount, 1);
  assert.equal(result.missingCountryCount, 1);
  assert.equal(result.unrecognizedCountryCount, 1);
  assert.equal(result.requestedLimit, 20);
  const serialized = JSON.stringify(result);
  for (const value of ["private-a", "private-b", "Germany"]) assert.equal(serialized.includes(value), false);
});

test("Bonga feed route uses the production entry point and protects diagnostics", () => {
  const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.match(pkg.scripts.start, /node route\.js$/);
  assert.match(route, /BONGACAMS_V1_LIMIT/);
  assert.match(route, /diagnosticsRequested && !validDashboardSession\(req\)/);
  assert.match(route, /summarizeBongaV1Feed/);
  assert.match(route, /BongaCams feed temporarily unavailable/);
  assert.doesNotMatch(route, /Bonga API HTTP \$\{res\.statusCode\}: \$\{body\.slice/);
});
