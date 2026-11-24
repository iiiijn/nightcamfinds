"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeProviderFeedQuality, summarizeFeedIngestion } = require("../src/services/feed-quality-diagnostics.cjs");

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


test("summarizes feed ingestion counts without exposing raw payloads", () => {
  const result = summarizeFeedIngestion({
    provider: "bongacams",
    rawRows: [{ username: "one" }, { username: "two" }, { username: "bad" }],
    entries: [
      { normalized: { country: "GB", gender: "male" } },
      { normalized: { country: "", gender: "" } },
      { normalized: null }
    ],
    pagination: {
      pagesFetched: 2, receivedCount: 3, uniqueCount: 2,
      duplicateCount: 1, truncated: true, stopReason: "max_pages",
      pageSize: 100, maxPages: 2
    }
  });

  assert.deepEqual(result, {
    provider: "bongacams",
    rawCount: 3,
    normalizedCount: 2,
    rejectedCount: 1,
    missingCountry: 1,
    missingCategory: 1,
    pagination: {
      pagesFetched: 2, receivedCount: 3, uniqueCount: 2,
      duplicateCount: 1, truncated: true, stopReason: "max_pages",
      pageSize: 100, maxPages: 2
    }
  });
  assert.equal(JSON.stringify(result).includes("username"), false);
});

test("handles absent ingestion diagnostics input safely", () => {
  assert.deepEqual(summarizeFeedIngestion(), {
    provider: "unknown",
    rawCount: 0,
    normalizedCount: 0,
    rejectedCount: 0,
    missingCountry: 0,
    missingCategory: 0,
    pagination: null
  });
});
