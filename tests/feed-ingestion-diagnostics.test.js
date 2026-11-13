"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeFeedIngestion } = require("../src/services/feed-ingestion-diagnostics.cjs");

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
  assert.equal(result.missingCountryCount, 1);
  assert.equal(result.unrecognizedCountryCount, 1);
  assert.deepEqual(result.countryCounts, [{ country: "GB", roomCount: 2 }]);
  assert.deepEqual(result.rejectionReasons, { invalid_destination: 1 });
  assert.deepEqual(result.pagination, {
    pagesFetched: 2, receivedCount: 5, uniqueCount: 5, duplicateCount: 0,
    truncated: false, stopReason: "short_page"
  });
  assert.equal(JSON.stringify(result).includes("one"), false);
});

test("Bonga diagnostics use provider country normalization and report pagination truncation", () => {
  const result = summarizeFeedIngestion({
    provider: "bongacams",
    rawRows: [
      { username: "a", homecountry: "United Kingdom" },
      { username: "b", country_code: "GB" },
      { username: "c", homecountry: "mysteryland" }
    ],
    entries: [room("a"), room("b")],
    pagination: { pagesFetched: 5, receivedCount: 500, uniqueCount: 490, duplicateCount: 10, truncated: true, stopReason: "max_pages" }
  });
  assert.equal(result.countryCounts.find((row) => row.country === "GB").roomCount, 2);
  assert.equal(result.unrecognizedCountryCount, 1);
  assert.equal(result.pagination.truncated, true);
  assert.equal(result.pagination.stopReason, "max_pages");
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
    duplicateCount: null, truncated: false, stopReason: "unknown"
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
