"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("server.js", "utf8");
const meta = source.slice(source.indexOf("const LEGAL_PAGE_META"), source.indexOf("function legal("));

test("legal routes define unique SEO titles and useful meta descriptions", () => {
  const entries = [...meta.matchAll(/"([^"]+)":\s*\{\s*title:\s*"([^"]+)",\s*description:\s*"([^"]+)"/g)];
  assert.equal(entries.length, 5);
  const titles = entries.map(([, , title]) => title);
  const descriptions = entries.map(([, , , description]) => description);
  assert.equal(new Set(titles).size, 5);
  assert.equal(new Set(descriptions).size, 5);
  for (const title of titles) assert.ok(title.length >= 25 && title.length <= 70, title);
  for (const description of descriptions) assert.ok(description.length >= 100 && description.length <= 170, description);
  assert.match(source, /<meta name="description" content="\$\{escapeAttr\(meta\.description\)\}">/);
  assert.match(source, /<link rel="canonical" href=/);
});

test("legal page copy explains the directory, affiliate relationship and external-platform boundary", () => {
  for (const phrase of [
    "does not host or transmit live video",
    "may receive a commission or referral payment",
    "partner platforms own privacy policies",
    "at least 18 years old",
    "privacy requests, correction requests"
  ]) assert.ok(source.includes(phrase), phrase);
});
