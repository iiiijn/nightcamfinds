"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCountryCandidates } = require("../src/services/country-candidate-diagnostics.cjs");
const { summarizeFeedIngestion } = require("../src/services/feed-ingestion-diagnostics.cjs");

test("country candidate diagnostics aggregate only verified ISO country codes", () => {
  const rows = [
    { username: "private-a", country: "Россия", location: "Moscow, Россия" },
    { username: "private-b", country: "", location: "Berlin; Germany" },
    { username: "private-c", country: "Unknownland", location: "Springfield, Unknownland" },
    { username: "private-d", homecountry: "DE", hometown: "Hamburg, Germany" }
  ];
  const result = summarizeCountryCandidates("chaturbate", rows.slice(0, 3));
  assert.deepEqual(result.candidateCountryCounts, [
    { country: "DE", roomCount: 1 },
    { country: "RU", roomCount: 1 }
  ]);
  assert.equal(result.rowsWithVerifiedCandidateCount, 2);
  const serialized = JSON.stringify(result);
  for (const privateValue of ["private-a", "Россия", "Moscow", "Berlin", "Unknownland", "Springfield"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("feed diagnostics include candidate aggregates without exposing source values", () => {
  const result = summarizeFeedIngestion({
    provider: "bongacams",
    rawRows: [
      { username: "secret-user", homecountry: "Germany", hometown: "Berlin, Germany" },
      { username: "secret-user-2", homecountry: "Mysteryland", hometown: "Unknown City" }
    ]
  });
  assert.deepEqual(result.metadata.countryCandidates.candidateCountryCounts, [
    { country: "DE", roomCount: 1 }
  ]);
  const serialized = JSON.stringify(result);
  for (const privateValue of ["secret-user", "Germany", "Berlin", "Mysteryland", "Unknown City"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
