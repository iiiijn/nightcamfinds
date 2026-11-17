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
  assert.match(css, /#top\s*>\s*\.directory-section\s*\{\s*order:\s*3/);
  assert.match(css, /#top\s*>\s*\.promo-strip/);
  assert.match(css, /#top\s*>\s*\.loyalty-section\s*\{\s*order:\s*5/);
  assert.match(html, /id="category-rows"/);
  assert.match(html, /id="grid"/);
});

test("homepage model rows use a dense five-column desktop grid and two-column phone grid", () => {
  assert.match(css, /\.grid,\s*\.home-group \.grid,\s*\.category-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*1050px\)[\s\S]*?\.category-row\s*\{\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*?\.category-row\s*\{\s*grid-template-columns:\s*repeat\(3,/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.category-row\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.category-row\s*\{\s*overflow:\s*visible;\s*scroll-snap-type:\s*none/);
});

test("responsive redesign preserves real room rendering and affiliate redirect destinations", () => {
  assert.match(app, /function card\(room\)/);
  assert.match(app, /const redirect = isBonga \? "\/bgo\/" : "\/go\/"/);
  assert.match(app, /rooms\.map\(card\)/);
  assert.match(app, /fetch\("\/api\/rooms\?/);
  assert.match(app, /window\.__ncfTopChaturbateByCategory/);
  assert.match(html, /Some links are affiliate links/);
  assert.match(html, /18\+ only/);
});
