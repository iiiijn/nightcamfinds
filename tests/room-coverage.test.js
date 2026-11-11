"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeRoomCoverage } = require("../src/services/room-coverage.cjs");

test("summarizes live room counts by country, region and recognized category", () => {
  const report = summarizeRoomCoverage([
    { country: "US", gender: "male" },
    { country: "US", gender: "female" },
    { country: "GB", gender: "trans" },
    { country: "KE", gender: "couples" }
  ], ["US", "GB", "DE"]);

  assert.equal(report.totalRooms, 4);
  assert.equal(report.countryReportedRooms, 4);
  assert.deepEqual(report.categories, { female: 1, male: 1, trans: 1, couples: 1 });
  assert.equal(report.countries.find((row) => row.country === "US").roomCount, 2);
  assert.equal(report.regions.find((row) => row.region === "North America").roomCount, 2);
  assert.equal(report.priorityMarkets.find((row) => row.country === "DE").roomCount, 0);
});

test("keeps missing country and unknown category metadata visible as coverage gaps", () => {
  const report = summarizeRoomCoverage([
    { country: "", gender: "" },
    { country: "ZZ", gender: "unrecognized" },
    { country: "CA", gender: "male" }
  ], ["CA"]);

  assert.equal(report.totalRooms, 3);
  assert.equal(report.missingCountryRooms, 1);
  assert.equal(report.uncategorizedRooms, 2);
  assert.equal(report.countryReportedRooms, 2);
  assert.equal(report.categories.male, 1);
  assert.equal(report.countries.some((row) => row.country === "ZZ"), false);
});

test("does not mutate the supplied room array and handles empty input", () => {
  const rooms = [{ country: "US", gender: "female" }];
  const before = structuredClone(rooms);
  const report = summarizeRoomCoverage(rooms, []);
  assert.deepEqual(rooms, before);
  assert.equal(summarizeRoomCoverage(null, []).totalRooms, 0);
  assert.equal(report.countries[0].country, "US");
});
