"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifySafeValueShape,
  summarizeSafeFieldValueShapes,
  summarizeFeedIngestion
} = require("../src/services/feed-ingestion-diagnostics.cjs");

test("safe value shape classification identifies formats without retaining source text", () => {
  assert.equal(classifySafeValueShape("US"), "two_letter_code");
  assert.equal(classifySafeValueShape("United States"), "multiword_text");
  assert.equal(classifySafeValueShape("Nairobi, Kenya"), "comma_delimited");
  assert.equal(classifySafeValueShape("Region/Area"), "slash_delimited");
  assert.equal(classifySafeValueShape("Unknown (Region)"), "bracketed_text");
  assert.equal(classifySafeValueShape("Москва"), "cyrillic_text");
  assert.equal(classifySafeValueShape(["Kenya"]), "array");
  assert.equal(classifySafeValueShape({ name: "Kenya" }), "object");
  assert.equal(classifySafeValueShape("   "), "missing");
});

test("safe field diagnostics return only aggregate shape counts", () => {
  const rows = [
    { country: "US", location: "New York, United States" },
    { country: "United States", location: "London, United Kingdom" },
    { country: "", location: "Unknown (Region)" },
    { country: ["GB"], location: null }
  ];
  const result = summarizeSafeFieldValueShapes(rows, ["country", "location"]);
  assert.deepEqual(result, {
    inspectedRoomCount: 4,
    fieldValueShapeCounts: {
      country: { two_letter_code: 1, multiword_text: 1, missing: 1, array: 1 },
      location: { comma_delimited: 2, bracketed_text: 1, missing: 1 }
    }
  });
  assert.equal(JSON.stringify(result).includes("New York"), false);
  assert.equal(JSON.stringify(result).includes("United Kingdom"), false);
});

test("feed ingestion diagnostics expose safe country format aggregates for both providers", () => {
  const chaturbate = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [
      { username: "private-model-a", country: "US", location: "New York, United States" },
      { username: "private-model-b", country: "", location: "Unknown (Region)" }
    ],
    entries: []
  });
  assert.deepEqual(chaturbate.metadata.safeValueShapes.fieldValueShapeCounts.country, {
    two_letter_code: 1,
    missing: 1
  });
  assert.deepEqual(chaturbate.metadata.safeValueShapes.fieldValueShapeCounts.location, {
    comma_delimited: 1,
    bracketed_text: 1
  });
  const bonga = summarizeFeedIngestion({
    provider: "bongacams",
    rawRows: [
      { username: "private-model-c", homecountry: "DE", hometown: "Berlin, Germany" },
      { username: "private-model-d", homecountry: "", hometown: "Unknown City" }
    ],
    entries: []
  });
  assert.deepEqual(bonga.metadata.safeValueShapes.fieldValueShapeCounts.homecountry, {
    two_letter_code: 1,
    missing: 1
  });
  assert.deepEqual(bonga.metadata.safeValueShapes.fieldValueShapeCounts.hometown, {
    comma_delimited: 1,
    multiword_text: 1
  });
  const serialized = JSON.stringify({ chaturbate, bonga });
  for (const privateValue of ["private-model-a", "private-model-b", "private-model-c", "private-model-d", "New York", "Berlin"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
