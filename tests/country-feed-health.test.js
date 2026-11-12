"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { summarizeCountryFeedHealth } = require("../src/services/country-feed-health.cjs");
const { patchServerSource } = require("../scripts/patch-country-directory.js");

function rooms(count, country = "US", platform = "chaturbate") {
  return Array.from({ length: count }, (_, index) => ({
    id: platform + ":" + index,
    platform,
    country
  }));
}

test("country feed health separates partner availability from country room supply", () => {
  const result = summarizeCountryFeedHealth({
    countries: [{ slug: "us", code: "US", name: "United States" }],
    providerHealth: { chaturbate: "available", bongacams: "unavailable" },
    rooms: rooms(10),
    refreshedAt: 1794500000000
  });
  assert.equal(result.feedHealth, "partial");
  assert.equal(result.countries[0].feedHealth, "partial");
  assert.equal(result.countries[0].supplyStatus, "adequate");
  assert.equal(result.countries[0].qualifyingRoomCount, 10);
  assert.equal(result.countries[0].indexable, true);
  assert.equal(result.indexableCountries, 1);
  assert.equal(result.refreshedAt, new Date(1794500000000).toISOString());
});

test("country supply counts unique valid rooms and applies the ten-room threshold", () => {
  const nine = rooms(9);
  const result = summarizeCountryFeedHealth({
    countries: [{ code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }],
    providerHealth: { chaturbate: "available", bongacams: "disabled" },
    rooms: [...nine, nine[0], { id: "invalid", platform: "other", country: "US" }]
  });
  assert.equal(result.feedHealth, "healthy");
  assert.equal(result.countries.find((x) => x.code === "US").roomCount, 11);
  assert.equal(result.countries.find((x) => x.code === "US").qualifyingRoomCount, 9);
  assert.equal(result.countries.find((x) => x.code === "US").supplyStatus, "thin");
  assert.equal(result.countries.find((x) => x.code === "US").indexable, false);
  assert.equal(result.countries.find((x) => x.code === "GB").supplyStatus, "empty");
  assert.equal(result.thinCountries, 1);
  assert.equal(result.emptyCountries, 1);
});

test("country feed health handles unavailable and unknown provider states safely", () => {
  const unavailable = summarizeCountryFeedHealth({
    countries: [{ code: "US", name: "United States" }],
    providerHealth: { chaturbate: "unavailable", bongacams: "unavailable" },
    rooms: []
  });
  assert.equal(unavailable.feedHealth, "unavailable");
  const unknown = summarizeCountryFeedHealth({
    countries: [{ code: "US", name: "United States" }],
    providerHealth: {},
    rooms: []
  });
  assert.equal(unknown.feedHealth, "unknown");
  assert.equal(unknown.refreshedAt, null);
});

test("startup patch exposes country feed health only through requested summary diagnostics", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const patched = patchServerSource(source);
  assert.ok(patched.includes('require("./src/services/country-feed-health.cjs")'));
  assert.ok(patched.includes("countryFeedHealth: summarizeCountryFeedHealth("));
  assert.ok(patched.includes("providerHealth: feed.providerHealth || {}"));
  assert.ok(patched.includes('const providerHealth={chaturbate:results[0].status==="fulfilled"?"available":"unavailable"'));
  assert.ok(patched.includes('bongacams:!BONGA_ENABLED?"disabled":results[1].status==="fulfilled"?"available":"unavailable"'));
  assert.equal(patchServerSource(patched), patched);
});
