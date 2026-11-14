"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeFeedIngestion, summarizeMetadataFieldPresence, summarizeChaturbateLocationShapes, classifyChaturbateLocation } = require("../src/services/feed-ingestion-diagnostics.cjs");

const room = (username, overrides = {}) => ({
  normalized: {
    id: "chaturbate:" + username,
    platform: "chaturbate",
    username,
    displayName: "Model " + username,
    gender: "female",
    viewerCount: 10,
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
  assert.ok(fs.readFileSync(path.join(__dirname, "../scripts/patch-country-directory.js"), "utf8").includes('require("./src/services/feed-ingestion-diagnostics.cjs")'));
  const { patchServerSource } = require("../scripts/patch-country-directory.js");
  const patchedServer = patchServerSource(server);
  assert.ok(patchedServer.includes('require("./src/services/feed-ingestion-diagnostics.cjs")'));
  assert.ok(patchedServer.includes('summarizeFeedIngestion({provider:"chaturbate",rawRows:pages.items,entries,pagination:{...pages,pageSize:CHATURBATE_PAGE_SIZE,maxPages}})'));
  assert.ok(patchedServer.includes("pageSize:CHATURBATE_PAGE_SIZE,maxPages"));
  assert.ok(patchedServer.includes("stopReason:pages.stopReason"));
  assert.ok(server.includes("latestProviderFeedDiagnostics.chaturbateRegions.push"));
  assert.ok(server.includes('summarizeFeedIngestion({provider:"chaturbate",rawRows:pages.items,entries,pagination:{...pages,pageSize:CHATURBATE_PAGE_SIZE,maxPages}})'));
  assert.ok(server.includes("pageSize:CHATURBATE_PAGE_SIZE,maxPages"));
  assert.ok(server.includes("latestProviderFeedDiagnostics.bongacams=diagnostics"));
  assert.ok(server.includes("providerIngestion: latestProviderFeedDiagnostics"));
  assert.ok(server.includes('console.info("[provider-feed-diagnostics]"'));
});

test("feed diagnostics reject unsupported providers and sanitize pagination fields", () => {
  assert.throws(() => summarizeFeedIngestion({ provider: "other" }), /Unsupported feed provider/);
  const result = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [],
    entries: [],
    pagination: { pagesFetched: -1, receivedCount: "many", stopReason: "secret" }
  });
  assert.deepEqual(result.pagination, {
    pagesFetched: null, receivedCount: null, uniqueCount: null,
    duplicateCount: null, pageSize: null, maxPages: null, truncated: false, stopReason: "unknown", pageMetrics: []
  });
});

test("age-related and promotional rejections are counted without exposing raw profile text", () => {
  const unsafe = room("unsafe");
  unsafe.rawText = "teen room";
  const spam = room("spam");
  spam.normalized.roomSubject = "Join my Telegram channel";
  const result = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [],
    entries: [unsafe, spam]
  });
  assert.deepEqual(result.rejectionReasons, {
    unsafe_age_related_text: 1,
    promotional_spam: 1
  });
  assert.equal(JSON.stringify(result).includes("Telegram"), false);
});


test("Chaturbate diagnostics count metadata presence without exposing values or identities", () => {
  const rows = [
    { username: "private-one", country: "GB", location: "London", region: "Europe", region_name: "", state: null, province: "" },
    { username: "private-two", country: "", location: "Paris", region: { code: "EU" }, region_name: "West", state: 0, province: [] },
    { username: "private-three", country: null, location: "", region: "", region_name: undefined, state: "", province: null }
  ];
  const presence = summarizeMetadataFieldPresence(rows);
  assert.deepEqual(presence, {
    inspectedRoomCount: 3,
    fieldPresenceCounts: { country: 1, location: 2, region: 2, region_name: 1, state: 1, province: 0 }
  });
  const result = summarizeFeedIngestion({ provider: "chaturbate", rawRows: rows });
  assert.deepEqual(result.metadata, {
    ...presence,
    locationShapes: {
      inspectedRoomCount: 3,
      locationShapeCounts: {
        missing: 1,
        exact_country: 0,
        city_country: 0,
        comma_unrecognized: 0,
        other_nonempty: 2
      }
    }
  });
  assert.equal(JSON.stringify(result).includes("private-one"), false);
  assert.equal(JSON.stringify(result).includes("London"), false);
  assert.equal(JSON.stringify(result).includes("Paris"), false);
  assert.equal(result.missingCountryCount, 1);
  assert.equal(result.unrecognizedCountryCount, 1);
});

test("Chaturbate pagination diagnostics preserve bounded config without raising defaults", () => {
  const result = summarizeFeedIngestion({
    provider: "chaturbate", rawRows: [],
    pagination: { pagesFetched: 6, receivedCount: 3000, uniqueCount: 3000, duplicateCount: 0, pageSize: 500, maxPages: 6, truncated: true, stopReason: "max_pages" }
  });
  assert.equal(result.pagination.pageSize, 500);
  assert.equal(result.pagination.maxPages, 6);
  assert.equal(result.pagination.truncated, true);
  assert.equal(result.pagination.stopReason, "max_pages");
});

test("Chaturbate location diagnostics classify shapes without exposing location values or identities", () => {
  const rows = [
    { username: "private-a", location: "GB" },
    { username: "private-b", location: "United States" },
    { username: "private-c", location: "London, United Kingdom" },
    { username: "private-d", location: "Paris, France" },
    { username: "private-e", location: "Springfield, Unknownland" },
    { username: "private-f", location: "Some freeform profile text" },
    { username: "private-g", location: "" },
    { username: "private-h" },
    { username: "private-i", location: null },
    { username: "private-j", location: ["Paris", "France"] }
  ];
  const result = summarizeChaturbateLocationShapes(rows);
  assert.deepEqual(result, {
    inspectedRoomCount: 10,
    locationShapeCounts: {
      missing: 3,
      exact_country: 2,
      city_country: 2,
      comma_unrecognized: 1,
      other_nonempty: 2
    }
  });
  assert.equal(JSON.stringify(result).includes("London"), false);
  assert.equal(JSON.stringify(result).includes("private-a"), false);
  assert.equal(classifyChaturbateLocation("Nairobi, Kenya"), "city_country");
  assert.equal(classifyChaturbateLocation("Nairobi"), "other_nonempty");
  assert.equal(classifyChaturbateLocation(""), "missing");
});

test("Chaturbate feed metadata includes location shape counts but never raw location text", () => {
  const result = summarizeFeedIngestion({
    provider: "chaturbate",
    rawRows: [
      { username: "secret-user", country: "", location: "Berlin, Germany" },
      { username: "secret-user-two", country: "US", location: "Los Angeles, California" }
    ]
  });
  assert.deepEqual(result.metadata.locationShapes.locationShapeCounts, {
    missing: 0,
    exact_country: 0,
    city_country: 1,
    comma_unrecognized: 1,
    other_nonempty: 0
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("Berlin"), false);
  assert.equal(serialized.includes("secret-user"), false);
  assert.equal(serialized.includes("Los Angeles"), false);
});

test("Chaturbate feed diagnostics use a recognized location country without exposing raw location",()=>{
 const result=summarizeFeedIngestion({
  provider:"chaturbate",
  rawRows:[
   {username:"private-1",country:"",location:"London, United Kingdom"},
   {username:"private-2",country:"Atlantis",location:"Paris, France"},
   {username:"private-3",country:"",location:"Nairobi"},
   {username:"private-4",country:"",location:"Springfield, Unknownland"},
   {username:"private-5",country:"US",location:"Paris, France"},
   {username:"private-6",country:"",location:["Paris","France"]}
  ]
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
