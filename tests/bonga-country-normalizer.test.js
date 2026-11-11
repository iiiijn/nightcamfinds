"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBongaCountry } = require("../src/services/bonga-country-normalizer.cjs");

test("Bonga country normalization prefers explicit provider country fields", () => {
  assert.equal(normalizeBongaCountry({ homecountry: "россия", country: "DE" }), "RU");
  assert.equal(normalizeBongaCountry({ homecountry: "not-a-country", country: "Germany" }), "DE");
  assert.equal(normalizeBongaCountry({ country_code: "gb" }), "GB");
});

test("Bonga country normalization accepts only explicit country values in hometown", () => {
  assert.equal(normalizeBongaCountry({ hometown: "Nairobi, Kenya" }), "KE");
  assert.equal(normalizeBongaCountry({ hometown: "Moscow, Russia" }), "RU");
  assert.equal(normalizeBongaCountry({ hometown: "Germany" }), "DE");
});

test("Bonga country normalization does not guess from cities, languages, or arbitrary text", () => {
  assert.equal(normalizeBongaCountry({ hometown: "Nairobi" }), "");
  assert.equal(normalizeBongaCountry({ hometown: "Berlin" }), "");
  assert.equal(normalizeBongaCountry({ hometown: "English, German" }), "");
  assert.equal(normalizeBongaCountry({ hometown: "Somewhere, Unknownland" }), "");
  assert.equal(normalizeBongaCountry({ hometown: "Paris, France / Berlin, Germany" }), "");
  assert.equal(normalizeBongaCountry(null), "");
  assert.equal(normalizeBongaCountry([]), "");
});
