"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { patchServerSource } = require("../scripts/patch-country-directory.js");

test("country directory compatibility patch preserves CRLF checkouts and is idempotent", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const windowsSource = source.replace(/\n/g, "\r\n");
  const patched = patchServerSource(windowsSource);
  assert.ok(patched.includes("roomCache.get(cacheKey"));
  assert.ok(patched.includes("createFeedSnapshotCache"));
  assert.ok(patched.includes("getCountryPage(countryRoute[1]"));
  assert.ok(patched.includes("\r\n"), "the current implementation should retain CRLF line endings");
  assert.equal(patched.replace(/\r\n/g, "").includes("\n"), false, "the output should not contain mixed line endings");
  assert.equal(patchServerSource(patched), patched, "reapplying the compatibility patch should be a no-op");
});

test("modern country directory patch preserves mixed line endings without rewriting the server", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

  assert.ok(source.includes("getEligibleCountrySitemapSlugs"));
  assert.match(source, /pathname\s*===\s*["']\/sitemap\.xml["']/);
  assert.ok(source.includes("COUNTRIES: COUNTRY_PAGE_CONTENT"));
  assert.match(source, /\r\n/);
  assert.match(source, /(?<!\r)\n/);
  assert.equal(patchServerSource(source), source);
});
