"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeProviderFeedQuality } = require("../src/services/feed-quality-diagnostics.cjs");

test("reports provider-level country and category quality from normalized rooms", () => {
  const result = summarizeProviderFeedQuality([
    { platform: "chaturbate", country: "US", gender: "male", region: "North America" },
    { platform: "chaturbate", country: "", gender: "unknown", region: "Other" },
    { platform: "bongacams", country: "DE", gender: "female", region: "Central Europe" },
    { platform: "bongacams", country: "GB", gender: "couples", region: "Western Europe" }
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    provider: "chaturbate",
    totalRooms: 2,
    missingCountry: 1,
    missingCountryPercent: 50,
    missingCategory: 1,
    missingCategoryPercent: 50,
    categories: { female: 0, male: 1, trans: 0, couples: 0 },
    countries: [{ country: "US", roomCount: 1 }],
    regions: [{ region: "North America", roomCount: 1 }, { region: "Other", roomCount: 1 }]
  });
  assert.equal(result[1].totalRooms, 2);
  assert.equal(result[1].missingCountry, 0);
  assert.equal(result[1].missingCategory, 0);
});

test("returns zeroed provider rows for empty or missing input", () => {
  const result = summarizeProviderFeedQuality(null);
  assert.deepEqual(result.map((row) => row.totalRooms), [0, 0]);
  assert.deepEqual(result.map((row) => row.missingCountryPercent), [0, 0]);
});

test("ignores rooms from unknown providers", () => {
  const result = summarizeProviderFeedQuality([
    { platform: "other", country: "US", gender: "male" }
  ]);
  assert.deepEqual(result.map((row) => row.totalRooms), [0, 0]);
});
