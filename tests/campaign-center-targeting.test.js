"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("campaign links apply a validated platform filter to the room API", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const center = fs.readFileSync(path.join(__dirname, "../public/campaign-center.html"), "utf8");
  assert.match(center, /ncf_platform/);
  assert.match(app, /\["chaturbate", "bongacams"\]\.includes/);
  assert.match(app, /if \(campaignPlatform\) params\.set\("platform", campaignPlatform\)/);
});

test("campaign links apply their selected country even when its feed currently has no rooms", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(app, /queryParams\.get\("ncf_country"\)/);
  assert.match(app, /countrySelect\.add\(new Option\(NAMES\[initialFilters\.country\]/);
  assert.match(app, /countrySelect\.value = initialFilters\.country/);
});

test("campaign links apply a validated room category to the room API", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(app, /const campaignCategory = \["all", "live", "female", "male", "trans", "couples", "hd", "new"\]/);
  assert.match(app, /category: campaignCategory \|\| category/);
});

test("campaign placement is preserved in affiliate click placement attribution", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(app, /const campaignPlacement = String\(queryParams\.get\("ncf_placement"\)/);
  assert.match(app, /if \(campaignPlacement\) return campaignPlacement/);
  assert.match(app, /placement: extra\.placement \|\| src/);
  assert.match(app, /placement: placement\(\)/);
});

test("campaign center explains that target selections are applied, not merely labelled", () => {
  const center = fs.readFileSync(path.join(__dirname, "../public/campaign-center.html"), "utf8");
  assert.match(center, /applies the selected platform, country and category to the live directory/);
});
