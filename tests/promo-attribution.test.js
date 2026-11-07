"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("promo attribution captures an external referrer host without its path or query", () => {
  const promo = fs.readFileSync(path.join(__dirname, "../public/promo.js"), "utf8");
  assert.match(promo, /new URL\(document\.referrer\)/);
  assert.match(promo, /referrer\?\.hostname/);
  assert.match(promo, /host !== currentHost/);
  assert.match(promo, /referralOnly \? 'referral' : 'unknown'/);
  assert.match(promo, /explicitSource \|\| savedSource \|\| referral \|\| 'unknown'/);
});

test("explicit campaign attribution takes precedence over referral attribution", () => {
  const promo = fs.readFileSync(path.join(__dirname, "../public/promo.js"), "utf8");
  assert.match(promo, /const source = explicitSource \|\| savedSource \|\| referral \|\| 'unknown'/);
  assert.match(promo, /const referralOnly = !explicitSource && !savedSource && Boolean\(referral\)/);
});

test("directory room cards keep referral and visit attribution on outbound redirects", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const promo = fs.readFileSync(path.join(__dirname, "../public/promo.js"), "utf8");
  assert.match(app, /document\.referrer/);
  assert.match(app, /source: trafficSource/);
  assert.match(app, /vid: visitId/);
  assert.match(promo, /vid: currentVisitId/);
  assert.match(promo, /lp: originalLandingPath\.slice\(0, 255\)/);
});

test("room actions identify the destination affiliate platform", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const renderer = fs.readFileSync(path.join(__dirname, "../src/services/room-page-renderer.cjs"), "utf8");
  assert.match(app, /Watch on BongaCams/);
  assert.match(app, /Watch on Chaturbate/);
  assert.match(renderer, /Watch on BongaCams/);
  assert.match(renderer, /Watch on Chaturbate/);
});
