"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeFeedIngestion, summarizeMetadataFieldPresence, summarizeChaturbateLocationShapes, classifyChaturbateLocation } = require("../src/services/feed-ingestion-diagnostics.cjs");
const { resolveChaturbateCountry } = require("../src/services/country-directory.cjs");

const room = (username, overrides = {}) => ({
  normalized: {
    id: "chaturbate:" + username,
    platform: "chaturbate",
    username,
    displayName: "Model " + username,
    gender: "female",
    viewerCount: 10,
    isLive: true,
    href: "https://chaturbate.com/" + username + "/",
    country: "GB",
    ...overrides
  },
  rawText: "Friendly chat"
});

test("feed diagnostics separate raw, normalized, accepted, rejected and duplicate counts", () => {
  const result = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [
      { username: "one", country: "GB" },
      { username: "two", country: "GB" },
      { username: "three", country: "" },
      { username: "four" },
      { username: "five", country: "Atlantis" }
    ],
    entries: [
      room("one"),
      room("two", { href: "http://chaturbate.com/two/" }),
      room("three"),
      room("one")
    ],
    pagination: { pagesFetched: 2, receivedCount: 5, uniqueCount: 5, duplicateCount: 0, truncated: false, stopReason: "short_page" }
  });

  assert.equal(result.provider, "chaturbate");
  assert.equal(result.rawRoomCount, 5);
  assert.equal(result.normalizedRoomCount, 4);
  assert.equal(result.acceptedUniqueRoomCount, 2);
  assert.equal(result.rejectedRoomCount, 1);
  assert.equal(result.duplicateRoomCount, 1);
  assert.equal(result.missingCountryCount, 2);
  assert.equal(result.unrecognizedCountryCount, 1);
  assert.deepEqual(result.countryCounts, [{ country: "GB", roomCount: 2 }]);
  assert.deepEqual(result.rejectionReasons, { invalid_destination: 1 });
  assert.deepEqual(result.pagination, {
    pagesFetched: 2, receivedCount: 5, uniqueCount: 5, duplicateCount: 0,
    pageSize: null, maxPages: null, truncated: false, stopReason: "short_page", pageMetrics: []
  });
  assert.equal(JSON.stringify(result).includes('"one"'), false);
});

test("Bonga diagnostics classify country using the same fallback rules as room normalization", () => {
  const result = summarizeFeedIngestion({
    provider: "bongacams",
    rawRows: [
      { username: "a", homecountry: "not-a-country", country: "Germany" },
      { username: "b", homecountry: "unknown", country_code: "GB" },
      { username: "c", homecountry: "mysteryland" },
      { username: "d", hometown: "Nairobi, Kenya" },
      { username: "e", hometown: "Nairobi" },
      { username: "f", homecountry: "", country: null, country_code: 0, hometown: "" },
      { username: "g" }
    ],
    entries: [room("a"), room("b")],
    pagination: { pagesFetched: 5, receivedCount: 500, uniqueCount: 490, duplicateCount: 10, truncated: true, stopReason: "max_pages" }
  });
  assert.deepEqual(result.countryCounts, [
    { country: "DE", roomCount: 1 },
    { country: "GB", roomCount: 1 },
    { country: "KE", roomCount: 1 }
  ]);
  assert.equal(result.missingCountryCount, 1);
  assert.equal(result.unrecognizedCountryCount, 3);
  assert.equal(result.pagination.truncated, true);
  assert.equal(result.pagination.stopReason, "max_pages");
});

test("server records each Chaturbate region and exposes provider diagnostics only on request", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.ok(server.includes("latestProviderFeedDiagnostics.chaturbateRegions.push"));
  assert.ok(server.includes('summarizeFeedIngestion({provider:"chaturbate",rawRows:pages.items,entries,pagination:{...pages,pageSize:CHATURBATE_PAGE_SIZE,maxPages}})'));
  assert.ok(server.includes("pageSize:CHATURBATE_PAGE_SIZE,maxPages"));
  assert.ok(server.includes("latestProviderFeedDiagnostics.bongacams=diagnostics"));
  assert.ok(server.includes("providerIngestion: latestProviderFeedDiagnostics"));
  assert.ok(server.includes('console.info("[provider-feed-diagnostics]"'));
});
 assert.deepEqual(result.countryCounts,[
  {country:"FR",roomCount:1},
  {country:"GB",roomCount:1},
  {country:"US",roomCount:1}
 ]);
 assert.equal(result.missingCountryCount,0);
 assert.equal(result.unrecognizedCountryCount,3);
 const serialized=JSON.stringify(result);
 for(const privateValue of ["private-1","London","United Kingdom","Paris","Atlantis","Springfield","Nairobi"]) {
  assert.equal(serialized.includes(privateValue),false);
 }
});

test("pagination diagnostics preserve repeated-page truncation and sanitize page metrics", () => {
  const result = summarizeFeedIngestion({
    provider: "chaturbate", rawRows: [],
    pagination: {
      pagesFetched: 2, receivedCount: 4, uniqueCount: 2, duplicateCount: 2,
      pageSize: 2, maxPages: 5, truncated: true, stopReason: "repeated_page",
      pageMetrics: [
        { offset: 0, responseTimeMs: 18, receivedCount: 2, uniqueCount: 2, duplicateCount: 0 },
        { offset: 2, responseTimeMs: 23, receivedCount: 2, uniqueCount: 0, duplicateCount: 2, username: "must-not-appear" },
        { offset: -1, responseTimeMs: "fast", receivedCount: 1, uniqueCount: 1, duplicateCount: 0 }
      ]
    }
  });
  assert.equal(result.pagination.truncated, true);
  assert.equal(result.pagination.stopReason, "repeated_page");
  assert.deepEqual(result.pagination.pageMetrics, [
    { offset: 0, responseTimeMs: 18, receivedCount: 2, uniqueCount: 2, duplicateCount: 0 },
    { offset: 2, responseTimeMs: 23, receivedCount: 2, uniqueCount: 0, duplicateCount: 2 },
    { offset: null, responseTimeMs: null, receivedCount: 1, uniqueCount: 1, duplicateCount: 0 }
  ]);
  assert.equal(JSON.stringify(result).includes("must-not-appear"), false);
});

test("Chaturbate location diagnostics recognize a valid country suffix after multiple location components", () => {
  const rows = [
    { username: "private-a", location: "New York, NY, United States" },
    { username: "private-b", location: "Berlin, State, Germany" },
    { username: "private-c", location: "Springfield, Unknownland, Region" },
    { username: "private-d", location: "Nairobi, Kenya" }
  ];
  const result = summarizeChaturbateLocationShapes(rows);
  assert.deepEqual(result.locationShapeCounts, {
    missing: 0,
    exact_country: 0,
    city_country: 1,
    location_country: 2,
    comma_unrecognized: 1,
    semicolon_country: 0,
    pipe_country: 0,
    slash_country: 0,
    semicolon_unrecognized: 0,
    pipe_unrecognized: 0,
    slash_unrecognized: 0,
    mixed_delimiter: 0,
    delimited_empty_component: 0,
    other_nonempty: 0
  });
  assert.equal(classifyChaturbateLocation("New York, NY, United States"), "location_country");
  assert.equal(classifyChaturbateLocation("Springfield, Unknownland, Region"), "comma_unrecognized");
  const serialized = JSON.stringify(result);
  for (const privateValue of ["New York", "Berlin", "Nairobi", "private-a"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});


test("Chaturbate location diagnostics classify semicolon and pipe country suffixes without inferring ambiguous formats", () => {
  const rows = [
    { username: "private-a", location: "Toronto; Canada" },
    { username: "private-b", location: "Sydney | Australia" },
    { username: "private-c", location: "Springfield; Unknownland" },
    { username: "private-d", location: "Berlin | Unknownland" },
    { username: "private-e", location: "Paris, France | Europe" },
    { username: "private-f", location: "London,, United Kingdom" },
    { username: "private-g", location: "Somewhere / Germany" },
    { username: "private-h", location: "Somewhere / Unknownland" },
    { username: "private-i", location: "Paris, France / Germany" },
    { username: "private-j", location: "Paris / France, Germany" },
    { username: "private-k", location: "Nairobi, Kenya" }
  ];
  const result = summarizeChaturbateLocationShapes(rows);
  assert.deepEqual(result.locationShapeCounts, {
    missing: 0,
    exact_country: 0,
    city_country: 1,
    location_country: 0,
    comma_unrecognized: 0,
    semicolon_country: 1,
    pipe_country: 1,
    slash_country: 1,
    semicolon_unrecognized: 1,
    pipe_unrecognized: 1,
    slash_unrecognized: 1,
    mixed_delimiter: 3,
    delimited_empty_component: 1,
    other_nonempty: 0
  });
  assert.equal(classifyChaturbateLocation("Toronto; Canada"), "semicolon_country");
  assert.equal(classifyChaturbateLocation("Sydney | Australia"), "pipe_country");
  assert.equal(classifyChaturbateLocation("Springfield; Unknownland"), "semicolon_unrecognized");
  assert.equal(classifyChaturbateLocation("Berlin | Unknownland"), "pipe_unrecognized");
  assert.equal(classifyChaturbateLocation("Paris, France | Europe"), "mixed_delimiter");
  assert.equal(classifyChaturbateLocation("London,, United Kingdom"), "delimited_empty_component");
  assert.equal(classifyChaturbateLocation("Somewhere / Germany"), "slash_country");
  assert.equal(classifyChaturbateLocation("Somewhere / Unknownland"), "slash_unrecognized");
  assert.equal(classifyChaturbateLocation("Paris, France / Germany"), "mixed_delimiter");
  assert.equal(classifyChaturbateLocation("Paris / France, Germany"), "mixed_delimiter");
  assert.equal(resolveChaturbateCountry("", "Somewhere / Germany"), "DE");
  assert.equal(resolveChaturbateCountry("", "Somewhere / Unknownland"), "");
  assert.equal(resolveChaturbateCountry("", "Paris, France / Germany"), "");
  assert.equal(resolveChaturbateCountry("", "Paris / France, Germany"), "");
  const serialized = JSON.stringify(result);
  for (const privateValue of ["Toronto", "Sydney", "Springfield", "Unknownland", "private-a"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
