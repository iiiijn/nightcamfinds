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
  assert.match(renderer, /const linkAttrs = ` href=/);
  assert.match(renderer, /const tag = "a"/);
  assert.match(renderer, /\/go\//);
});

test("BongaCams room cards use the tracked room redirect and account-generated Direct Link target", () => {
  const app = read("public/app.js");
  const promo = read("public/promo.js");
  const renderer = read("src/services/room-page-renderer.cjs");
  const server = read("server.js");
  assert.match(app, /const redirect = isBonga \? "\/bgo\/" : "\/go\/"/);
  assert.match(app, /Watch on BongaCams/);
  assert.match(promo, /renderStrip\(bcPromo, bc, 'Live on BongaCams'/);
  assert.match(renderer, /const redirect = isBonga \? "\/bgo\/" : "\/go\/"/);
  assert.match(renderer, /Watch on BongaCams/);
  assert.match(server, /destination\.searchParams\.set\("type", "direct_link"\)/);
  assert.match(server, /destination\.searchParams\.set\("models\[\]", username\)/);
  assert.match(server, /destination\.searchParams\.set\("c", BONGA_CAMPAIGN\)/);
  assert.match(server, /await countClick\(\{ src, country, category, source, campaign, medium, content, device, clickId, platform, visitId, landingPath/);
  assert.match(server, /destination\.searchParams\.set\("models\[\]", username\)/);
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

test("recent room click report recognizes room IDs when promo content is also present", () => {
  const route = read("route.js");
  const server = read("server.js");
  assert.match(route, /LOWER\(content\) LIKE 'room-%' OR LOWER\(content\) LIKE '%:room-%'/);
  assert.match(route, /match\(\/(?:\^\|:\)room-/);
  assert.match(server, /\["room-" \+ username, suppliedContent\]/);
  assert.match(server, /room-\(\[a-z0-9_-\]\{1,64\}\)\(\?:\|\$\)/);
});
