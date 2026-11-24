"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCountryConflicts } = require("../src/services/country-conflict-diagnostics.cjs");
const { summarizeFeedIngestion } = require("../src/services/feed-ingestion-diagnostics.cjs");

test("Chaturbate conflict diagnostics distinguish matching, conflicting and location-only candidates", () => {
  const rows = [
    { username: "private-match", country: "DE", location: "Berlin, Germany" },
    { username: "private-conflict", country: "DE", location: "Amsterdam, Netherlands" },
    { username: "private-recoverable", country: "", location: "Paris, France" },
    { username: "private-unknown", country: "Unknownland", location: "Unknown City" }
  ];
  const result = summarizeCountryConflicts("chaturbate", rows);
  assert.equal(result.inspectedRoomCount, 4);
  assert.equal(result.provider, "chaturbate");
  assert.equal(result.explicitRecognizedCount, 2);
  assert.equal(result.locationRecognizedCount, 3);
  assert.equal(result.matchingCountryCount, 1);
  assert.equal(result.conflictingCountryCount, 1);
  assert.equal(result.locationOnlyRecoverableCount, 1);
  assert.equal(result.neitherRecognizedCount, 1);
  assert.deepEqual(result.conflictCountryPairCounts, [
    { countries: ["DE", "NL"], roomCount: 1 }
  ]);
  const serialized = JSON.stringify(result);
  for (const value of ["private-match", "private-conflict", "private-recoverable", "private-unknown", "Amsterdam", "Unknownland"]) {
    assert.equal(serialized.includes(value), false);
  }
});

test("Bonga diagnostics count disagreements across explicit country fields and hometown", () => {
  const rows = [
    { username: "private-a", homecountry: "DE", country: "DE", hometown: "Berlin, Germany" },
    { username: "private-b", homecountry: "DE", hometown: "Paris, France" },
    { username: "private-c", homecountry: "", country: "GB", hometown: "London, United Kingdom" },
    { username: "private-d", homecountry: "DE", country: "FR", hometown: "Lyon, France" },
    { username: "private-e", homecountry: "Unknownland", hometown: "Unknown City" }
  ];
  const result = summarizeCountryConflicts("bongacams", rows);
  assert.equal(result.explicitRecognizedCount, 4);
  assert.equal(result.locationRecognizedCount, 4);
  assert.equal(result.matchingCountryCount, 2);
  assert.equal(result.conflictingCountryCount, 2);
  assert.equal(result.locationOnlyRecoverableCount, 0);
  assert.equal(result.neitherRecognizedCount, 1);
  assert.equal(result.multipleExplicitFieldConflictCount, 1);
  const serialized = JSON.stringify(result);
  for (const value of ["private-a", "private-b", "private-c", "private-d", "private-e", "Paris", "Unknownland"]) {
    assert.equal(serialized.includes(value), false);
  }
});

test("feed ingestion metadata includes privacy-safe country conflict aggregates", () => {
  const result = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [{ username: "private-room", country: "DE", location: "Amsterdam, Netherlands" }]
  });
  assert.deepEqual(result.metadata.countryConflicts.conflictCountryPairCounts, [
    { countries: ["DE", "NL"], roomCount: 1 }
  ]);
  const serialized = JSON.stringify(result.metadata.countryConflicts);
  assert.equal(serialized.includes("private-room"), false);
  assert.equal(serialized.includes("Amsterdam"), false);
});
