"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Chaturbate room cards and banners use real room IDs through the tracked redirect", () => {
  const app = read("public/app.js");
  const promo = read("public/promo.js");
  const renderer = read("src/services/room-page-renderer.cjs");
  assert.match(app, /encodeURIComponent\(room\.id\)/);
  assert.match(app, /\/go\//);
  assert.match(promo, /a\.href = trackUrl\(room, 'banner'\)/);
  assert.match(promo, /function renderBanner\(config, rooms\)/);
  assert.doesNotMatch(promo, /chaturbate:featured/);
  assert.match(renderer, /const linkAttrs = isBonga \? "" :/);
  assert.match(renderer, /const tag = isBonga \? "article" : "a"/);
  assert.match(renderer, /\/go\//);
});

test("BongaCams cards are visible but cannot send traffic to an unverified destination", () => {
  const app = read("public/app.js");
  const promo = read("public/promo.js");
  const renderer = read("src/services/room-page-renderer.cjs");
  const server = read("server.js");
  assert.match(app, /BongaCash link pending verification/);
  assert.match(app, /document\.createElement\(isBonga \? "article" : "a"\)/);
  assert.doesNotMatch(app, /\/bgo\//);
  assert.doesNotMatch(promo, /renderStrip\(bcPromo/);
  assert.match(renderer, /BongaCash link pending verification/);
  assert.match(renderer, /const linkAttrs = isBonga \? "" :/);
  assert.match(server, /if \(isBonga\) \{\s*return send\(res, 503/);
});

test("placeholder pseudo-room redirects are rejected and room names are recorded", () => {
  const server = read("server.js");
  assert.match(server, /\["directory", "featured"\]\.includes\(username\.toLowerCase\(\)\)/);
  assert.match(server, /"room-" \+ username/);
  assert.match(server, /stats\.byRoom/);
});

test("Chaturbate redirect uses the canonical affiliate entry point with unique click and session IDs", () => {
  const server = read("server.js");
  const helper = read("src/services/chaturbate-revshare.cjs");
  assert.match(server, /roomUrl: ""/);
  assert.match(server, /destination\.searchParams\.set\("room", username\)/);
  assert.match(helper, /url\.searchParams\.set\("click_id", clickId\)/);
  assert.match(helper, /url\.searchParams\.set\("sid", clickId\)/);
  assert.match(helper, /url\.searchParams\.set\("track", clean\(options\.track/);
});
