"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveRegionalMaxPages } = require("../src/services/regional-feed-config.cjs");

test("defaults regional Chaturbate feeds to six pages", () => {
  assert.equal(resolveRegionalMaxPages(undefined, 10), 6);
});

test("never defaults above the global Chaturbate page limit", () => {
  assert.equal(resolveRegionalMaxPages(undefined, 4), 4);
});

test("respects an explicit regional page override within safety limits", () => {
  assert.equal(resolveRegionalMaxPages("8", 10), 8);
  assert.equal(resolveRegionalMaxPages("20", 20), 10);
  assert.equal(resolveRegionalMaxPages("0", 10), 1);
});

test("falls back safely for an invalid regional page override", () => {
  assert.equal(resolveRegionalMaxPages("invalid", 10), 6);
});
