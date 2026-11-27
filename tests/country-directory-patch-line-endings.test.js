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
  const lines = source.split(/\r?\n/);
  const mixedSource = lines
    .map((line, index) => line + (index === lines.length - 1 ? "" : index % 2 === 0 ? "\r\n" : "\n"))
    .join("");

  assert.ok(mixedSource.includes("getEligibleCountrySitemapSlugs"));
  assert.match(mixedSource, /pathname\s*===\s*["']\/sitemap\.xml["']/);
  assert.ok(mixedSource.includes("COUNTRIES: COUNTRY_PAGE_CONTENT"));
  assert.match(mixedSource, /\r\n/);
  assert.match(mixedSource, /(?<!\r)\n/);
  assert.equal(patchServerSource(mixedSource), mixedSource);
});
