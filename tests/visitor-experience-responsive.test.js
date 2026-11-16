"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const styles = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

test("tablet directory layout stacks the room feed above adaptive partner promotions", () => {
  assert.match(styles, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*?\.directory-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.bonga-promo-sidebar\s*\{\s*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*220px\),\s*1fr\)\)/);
  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
});

test("room thumbnails retain lazy loading and a styled unavailable-image fallback", () => {
  assert.match(app, /img\.loading\s*=\s*"lazy"/);
  assert.match(app, /img\.onerror\s*=\s*\(\)\s*=>\s*\{/);
  assert.match(app, /img\.src\s*=\s*"\/og\.svg"/);
  assert.match(app, /img\.classList\.add\("image-fallback"\)/);
  assert.match(styles, /\.image-fallback\s*\{/);
});

test("discovery keeps a clear empty state and live result announcements", () => {
  assert.match(app, /No live rooms with verified regional information are available in this category right now\./);
  assert.match(app, /No rooms match that filter\./);
  assert.match(html, /id="result-count" class="result-count" aria-live="polite"/);
  assert.match(html, /id="grid" class="grid" aria-live="polite"/);
});

test("load-more and initial feed failures remain visible and recoverable", () => {
  assert.match(app, /Could not load more rooms\. Please try again\./);
  assert.match(app, /Could not load rooms\. Please try again\./);
  assert.match(app, /loadMoreButton\.disabled = false/);
});
