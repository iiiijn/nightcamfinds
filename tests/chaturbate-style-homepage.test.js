"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const css = read("public/styles.css");
const app = read("public/app.js");
const html = read("public/index.html");
const modelPage = read("public/broadcast.html");

test("homepage puts live discovery ahead of secondary promotional content", () => {
  assert.ok(css.includes("#top > .directory-section { order: 3"));
  assert.ok(css.includes("#top > .promo-strip"));
  assert.ok(css.includes("#top > .loyalty-section { order: 5"));
  assert.ok(html.includes('id="category-rows"'));
  assert.ok(html.includes('id="grid"'));
});

test("desktop room discovery uses a dense six-column grid with responsive tablet and phone layouts", () => {
  assert.ok(css.includes("grid-template-columns: repeat(6, minmax(0, 1fr));"));
  assert.ok(css.includes("@media (max-width: 1180px)"));
  assert.ok(css.includes("grid-template-columns: repeat(5, minmax(0,1fr))"));
  assert.ok(css.includes("@media (max-width: 980px)"));
  assert.ok(css.includes("grid-template-columns: repeat(4, minmax(0,1fr))"));
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(css.includes("grid-template-columns: repeat(3, minmax(0,1fr))"));
  assert.ok(css.includes("@media (max-width: 480px)"));
  assert.ok(css.includes("grid-template-columns: repeat(2, minmax(0,1fr))"));
});

test("search is part of the compact top navigation and existing filter controls remain available", () => {
  const topbar = html.slice(html.indexOf('<div class="topbar">'), html.indexOf("</div>", html.indexOf('<div class="topbar">')));
  assert.ok(topbar.includes('id="q"'));
  assert.ok(topbar.includes('id="country"'));
  assert.ok(html.includes('id="language"'));
  assert.ok(html.includes('id="region"'));
  assert.ok(html.includes('id="sort"'));
});

test("live room feed refreshes every 30 seconds without interrupting hidden pages or active searches", () => {
  assert.ok(app.includes("const ROOM_REFRESH_INTERVAL_MS = 30 * 1000;"));
  assert.ok(app.includes("if (document.hidden || q.value) return;"));
  assert.ok(app.includes("}, ROOM_REFRESH_INTERVAL_MS);"));
  assert.ok(!app.includes("10 * 60 * 1000"));
});

test("responsive redesign preserves real room rendering and affiliate redirect destinations", () => {
  assert.ok(app.includes("function card(room)"));
  assert.ok(app.includes('const redirect = isBonga ? "/bgo/" : "/go/"'));
  assert.ok(app.includes("rooms.map(card)"));
  assert.ok(app.includes('fetch("/api/rooms?'));
  assert.ok(app.includes("window.__ncfTopChaturbateByCategory"));
  assert.ok(html.includes("Some links are affiliate links"));
  assert.ok(html.includes("18+ only"));
});


test("homepage exposes separate official model signup paths without misusing viewer affiliate routes", () => {
  assert.ok(html.includes('id="become-a-model"'));
  assert.ok(html.includes('href="/broadcast/">Become a model</a>'));
  assert.ok(modelPage.includes("Become a live broadcaster"));
  assert.ok(modelPage.includes("https://chaturbate.com/in/?tour=LQps&amp;campaign=C6yxN&amp;track=broadcast"));
  assert.ok(modelPage.includes("https://bongacash.com/model-ref?c=840974"));
  assert.ok(modelPage.includes("BongaCash model-recruitment referral link supplied for NightCamFinds"));
  assert.ok(!html.includes('href="/go/" target="_blank"'));
  assert.ok(!html.includes('href="/bgo/" target="_blank"'));
  assert.ok(!html.includes("https://chaturbate.com/accounts/broadcaster_register/"));
  assert.ok(!html.includes("https://bongamodels.com/"));
});

test("model recruitment section has responsive two-platform cards", () => {
  assert.ok(css.includes(".model-platforms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));"));
  assert.ok(css.includes("@media (max-width: 640px)"));
  assert.ok(css.includes(".model-platforms { grid-template-columns: 1fr;"));
});
