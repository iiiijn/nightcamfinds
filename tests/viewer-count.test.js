"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeViewerCount, firstValidViewerCount } = require("../src/services/viewer-count.cjs");

test("normalizes non-negative integer and formatted provider viewer counts", () => {
  assert.equal(normalizeViewerCount(1234), 1234);
  assert.equal(normalizeViewerCount("1,234"), 1234);
  assert.equal(normalizeViewerCount(" 42 "), 42);
  assert.equal(normalizeViewerCount("12.9"), 12);
});

test("invalid, negative and non-finite viewer counts safely become zero", () => {
  for (const value of ["unknown", "12 viewers", "", -1, Infinity, NaN, null, undefined, {}, "1,2,3"]) {
    assert.equal(normalizeViewerCount(value), 0, String(value));
  }
});

test("Bonga count fallback selects the first valid supplied provider field", () => {
  assert.equal(firstValidViewerCount("", "not available", "1,205", 17), 1205);
  assert.equal(firstValidViewerCount(-1, null, undefined), 0);
  assert.equal(firstValidViewerCount(0, 99), 0);
});
