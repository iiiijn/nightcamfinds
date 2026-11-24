"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCountryCode, resolveChaturbateCountry } = require("../src/services/country-directory.cjs");
const { normalizeBongaCountry } = require("../src/services/bonga-country-normalizer.cjs");

test("recognises verified common country aliases and accented spellings", () => {
  const cases = [
    ["United States of America", "US"], ["Great Britain", "GB"],
    ["South Korea", "KR"], ["Republic of Korea", "KR"],
    ["North Korea", "KP"], ["Iran, Islamic Republic of", "IR"],
    ["Viet Nam", "VN"], ["Lao People's Democratic Republic", "LA"],
    ["Tanzania, United Republic of", "TZ"], ["Palestine, State of", "PS"],
    ["Hong Kong", "HK"], ["Macao", "MO"], ["Taiwan", "TW"],
    ["Côte d'Ivoire", "CI"], ["Ivory Coast", "CI"],
    ["Democratic Republic of the Congo", "CD"], ["Republic of the Congo", "CG"],
    ["Türkiye", "TR"], ["россия", "RU"]
  ];
  for (const [value, expected] of cases) assert.equal(normalizeCountryCode(value), expected, value);
});

test("country aliases work in explicit Chaturbate and Bonga country fields", () => {
  assert.equal(resolveChaturbateCountry("South Korea", "Seoul"), "KR");
  assert.equal(resolveChaturbateCountry("", "Paris, Côte d'Ivoire"), "CI");
  assert.equal(normalizeBongaCountry({ homecountry: "Türkiye" }), "TR");
  assert.equal(normalizeBongaCountry({ hometown: "Seoul, South Korea" }), "KR");
});

test("ambiguous city names and mixed location formats remain unclassified", () => {
  for (const value of ["Paris", "Berlin", "London", "English, German", "Unknownland"]) {
    assert.equal(normalizeCountryCode(value), "", value);
  }
  assert.equal(resolveChaturbateCountry("", "Paris, France / Berlin, Germany"), "");
  assert.equal(resolveChaturbateCountry("", "Berlin, Germany; Europe"), "");
  assert.equal(resolveChaturbateCountry("", "London, England"), "GB");
});
