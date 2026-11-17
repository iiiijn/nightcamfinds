"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const css = read("public/styles.css");
const app = read("public/app.js");
const html = read("public/index.html");

test("homepage puts live discovery ahead of secondary promotional content", () => {
  assert.match(css, /#top\\s*>\\s*\\.directory-section\\s*\\{\\s*order:\\s*3/);
  assert.match(css, /#top\\s*>\\s*\\.promo-strip/);
  assert.match(css, /#top\\s*>\\s*\\.loyalty-section\\s*\\{\\s*order:\\s*5/);
  assert.match(html, /id="category-rows"/);
  assert.match(html, /id="grid"/);
});

test("desktop room discovery uses a dense six-column grid with responsive tablet and phone layouts", () => {
  assert.match(css, /grid-template-columns:\\s*repeat\\(6,\\s*minmax\\(0,\\s*1fr\\)\\)/);
  assert.match(css, /@media \\(max-width: 1180px\\)[\\s\\S]*?repeat\\(5,/);
  assert.match(css, /@media \\(max-width: 980px\\)[\\s\\S]*?repeat\\(4,/);
  assert.match(css, /@media \\(max-width: 720px\\)[\\s\\S]*?repeat\\(3,/);
  assert.match(css, /@media \\(max-width: 480px\\)[\\s\\S]*?repeat\\(2,/);
  assert.match(css, /\\.category-row\\s*\\{[\\s\\S]*?overflow:\\s*visible/);
});

test("search is part of the compact top navigation and existing filter controls remain available", () => {
  assert.match(html, /class="topbar"[\\s\\S]*?id="q"/);
  assert.match(html, /id="country"/);
  assert.match(html, /id="language"/);
  assert.match(html, /id="region"/);
  assert.match(html, /id="sort"/);
});

test("live room feed refreshes every 30 seconds without interrupting hidden pages or active searches", () => {
  assert.match(app, /const ROOM_REFRESH_INTERVAL_MS = 30 \\* 1000/);
  assert.match(app, /if \\(document\\.hidden \\|\\| q\\.value\\) return/);
  assert.match(app, /\\}, ROOM_REFRESH_INTERVAL_MS\\)/);
  assert.doesNotMatch(app, /10 \\* 60 \\* 1000/);
});

test("responsive redesign preserves real room rendering and affiliate redirect destinations", () => {
  assert.match(app, /function card\\(room\\)/);
  assert.match(app, /const redirect = isBonga \\? "\\/bgo\\/" : "\\/go\\/"/);
  assert.match(app, /rooms\\.map\\(card\\)/);
  assert.match(app, /fetch\\("\\/api\\/rooms\\?/);
  assert.match(app, /window\\.__ncfTopChaturbateByCategory/);
  assert.match(html, /Some links are affiliate links/);
  assert.match(html, /18\\+ only/);
});
