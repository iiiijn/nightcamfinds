'use strict';

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const promoSource = fs.readFileSync(path.join(__dirname, "..", "public", "promo.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const resolverSource = fs.readFileSync(path.join(__dirname, "..", "src", "services", "visit-id-attribution.cjs"), "utf8");

test("promo tracking delegates visit identity to the shared tracker first", () => {
  assert.match(promoSource, /window\.NCFVisitTracking\?\.getVisitId\?\.\(\)/);
  assert.match(promoSource, /document\.cookie\.split\(';?'/);
});

test("promo tracking uses the shared landing path when available", () => {
  assert.match(promoSource, /window\.NCFVisitTracking\?\.getLandingPath\?\.\(location\.pathname\)/);
});

test("affiliate redirects resolve and label the visit ID origin", () => {
  assert.match(serverSource, /resolveVisitIdentity\(/);
  assert.match(serverSource, /visitIdOrigin/);
  assert.match(resolverSource, /origin: "redirect_fallback"/);
});

test("affiliate redirects set first-party cookies when needed", () => {
  assert.match(serverSource, /buildVisitCookieHeaders\(/);
  assert.match(serverSource, /redirectHeaders\["Set-Cookie"\] = setCookies/);
});
