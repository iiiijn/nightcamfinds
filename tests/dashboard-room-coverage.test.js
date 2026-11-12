"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const dashboard = fs.readFileSync("public/dashboard.html", "utf8");

test("dashboard exposes a read-only live room coverage panel", () => {
  assert.match(dashboard, /id="roomCoveragePanel"/);
  assert.match(dashboard, /id="roomCoverageRefresh"/);
  assert.match(dashboard, /fetch\('\/api\/rooms\?summary=1&coverage=1(?:&diagnostics=1)?'/);
  assert.match(dashboard, /loadRoomCoverage\(\)/);
  assert.match(dashboard, /countryFeedHealth/);
});

test("dashboard coverage panel reports regions, categories, priority markets and metadata gaps", () => {
  for (const marker of [
    "roomCoverageRegions",
    "roomCoverageCategories",
    "roomCoverageMarkets",
    "roomCoverageCountries",
    "missingCountryRooms",
    "uncategorizedRooms",
    "count<10",
    "Zero",
    "Low"
  ]) {
    assert.ok(dashboard.includes(marker), `missing coverage dashboard marker: ${marker}`);
  }
});

test("coverage panel labels the feed as a snapshot, not total market supply", () => {
  assert.match(dashboard, /Snapshot of rooms currently returned by the partner feeds/);
  assert.match(dashboard, /not a count of every performer or total market supply/);
});
