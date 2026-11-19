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

test("laptop-width layouts keep search in the top row and use five room columns", () => {
  assert.ok(css.includes("@media (min-width: 761px) and (max-width: 980px)"));
  assert.ok(css.includes(".topbar {\n    flex-wrap: nowrap;"));
  assert.ok(css.includes(".topbar #q {\n    flex: 1 1 180px;"));
  assert.ok(css.includes("grid-template-columns: repeat(5, minmax(0, 1fr));"));
});



test("homepage exposes separate official model signup paths without misusing viewer affiliate routes", () => {
  const modelPage = read("public/broadcast.html");
  assert.ok(html.includes('href="/broadcast/" data-ncf-path="model"'));
  assert.ok(modelPage.includes("Choose your platform. Build your creator business."));
  assert.ok(modelPage.includes("https://chaturbate.com/in/?tour=LQps&amp;campaign=C6yxN&amp;track=broadcast"));
  assert.ok(modelPage.includes("https://bongacash.com/model-ref?c=840974"));
  assert.ok(modelPage.includes('id="platform-chaturbate"'));
  assert.ok(modelPage.includes('id="platform-bongacams"'));
  assert.ok(!html.includes('href="/go/" target="_blank"'));
  assert.ok(!html.includes('href="/bgo/" target="_blank"'));
  assert.ok(!html.includes("https://chaturbate.com/accounts/broadcaster_register/"));
  assert.ok(!html.includes("https://bongamodels.com/"));
});

test("model recruitment copy accurately describes separate referral signup paths", () => {
  const modelPage = read("public/broadcast.html");
  assert.ok(modelPage.includes("Register for a broadcaster account through the NightCamFinds Chaturbate broadcaster referral link."));
  assert.ok(modelPage.includes("Register through the BongaCash model referral link."));
  assert.ok(modelPage.includes("Separate referral paths"));
});

test("model recruitment page retains responsive two-platform cards", () => {
  assert.ok(css.includes(".model-platforms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));"));
  assert.ok(css.includes("@media (max-width: 640px)"));
  assert.ok(css.includes(".model-platforms { grid-template-columns: 1fr;"));
});

test("homepage places both broadcaster signup choices beside the room directory", () => {
  const directory = html.slice(html.indexOf('<section class="directory-section"'), html.indexOf('<div class="two">'));
  assert.ok(directory.includes('class="broadcaster-sidebar"'));
  assert.ok(directory.includes('href="/broadcast/#platform-chaturbate"'));
  assert.ok(directory.includes('href="/broadcast/#platform-bongacams"'));
  assert.ok(!html.includes('id="become-a-model"'));
  assert.ok(read("public/broadcast.html").includes('id="platform-chaturbate"'));
  assert.ok(read("public/broadcast.html").includes('id="platform-bongacams"'));
});

test("homepage exposes independent live category rows for both providers", () => {
  assert.ok(app.includes('["BongaCams", "bongacams", window.__ncfTopBongaByCategory || {}]'));
  assert.ok(app.includes('["Chaturbate", "chaturbate", window.__ncfTopChaturbateByCategory || {}]'));
  assert.ok(app.includes('window.__ncfTopBongaByCategory = data.topBongaByCategory || {};'));
  assert.ok(css.includes(".global-platform-group"));
  const server = read("server.js");
  assert.ok(server.includes("const topBongaByCategory = {};"));
  assert.ok(server.includes("topBongaByCategory,liveCount"));
});
