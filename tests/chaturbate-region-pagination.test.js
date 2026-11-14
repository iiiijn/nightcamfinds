"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveChaturbateRegionMaxPages } = require("../src/services/chaturbate-region-pagination.cjs");

test("raises only South America from the six-page regional default to eight pages", () => {
  const options = { globalMaxPages: 10, regionalMaxPages: 6 };
  assert.equal(resolveChaturbateRegionMaxPages("southamerica", options), 8);
  for (const region of ["other", "northamerica", "asia", "europe_russia"]) {
    assert.equal(resolveChaturbateRegionMaxPages(region, options), 6);
  }
});

test("allows a bounded South America override without exceeding the global ceiling", () => {
  assert.equal(resolveChaturbateRegionMaxPages("southamerica", {
    globalMaxPages: 10, regionalMaxPages: 6, southAmericaMaxPages: "9"
  }), 9);
  assert.equal(resolveChaturbateRegionMaxPages("southamerica", {
    globalMaxPages: 7, regionalMaxPages: 6, southAmericaMaxPages: "9"
  }), 7);
});

test("uses a safe eight-page default for invalid South America overrides", () => {
  assert.equal(resolveChaturbateRegionMaxPages("southamerica", {
    globalMaxPages: 10, regionalMaxPages: 6, southAmericaMaxPages: "invalid"
  }), 8);
});

test("does not allow the South America override to change other regions", () => {
  assert.equal(resolveChaturbateRegionMaxPages("northamerica", {
    globalMaxPages: 10, regionalMaxPages: 6, southAmericaMaxPages: "9"
  }), 6);
});
