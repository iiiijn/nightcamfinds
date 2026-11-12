"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCountryCode } = require("../src/services/country-directory.cjs");

test("Bonga Ukrainian country name is normalized from Cyrillic in either case", () => {
  assert.equal(normalizeCountryCode("украина"), "UA");
  assert.equal(normalizeCountryCode("УКРАИНА"), "UA");
});

test("English Ukraine mapping remains unchanged", () => {
  assert.equal(normalizeCountryCode("Ukraine"), "UA");
  assert.equal(normalizeCountryCode("UKRAINE"), "UA");
});
