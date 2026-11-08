const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("redesigned directory shell keeps the live-feed and filter mount points", () => {
  const html = read("public/index.html");
  for (const id of ["gate", "enter", "country", "q", "language", "region", "sort", "featured-room", "category-rows", "grid", "partner-actions"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /id="notice"/);
  assert.match(html, /id="result-count"/);
  assert.match(html, /id="quick-exit"/);
});

test("redesign keeps truthful adult, affiliate and paid-feature disclosures", () => {
  const html = read("public/index.html");
  assert.match(html, /18\+ only/);
  assert.match(html, /Tips and private shows cost money/);
  assert.match(html, /Some links are affiliate links/);
  assert.match(html, /Email signup is not available yet/);
  assert.doesNotMatch(html, /You're on the list|Next Crew drop in|members online|nights in a row you visited/i);
});

test("age gate blurs real room thumbnails until the visitor accepts", () => {
  const html = read("public/index.html");
  const css = read("public/styles.css");
  const app = read("public/app.js");
  const countryPages = read("country-pages.js");
  assert.match(html, /age-pending/);
  assert.match(css, /\.age-pending \.thumb\s*\{\s*filter:\s*blur\(/);
  assert.match(app, /classList\.remove\("age-pending"\)/);
  assert.match(app, /localStorage\.setItem\("ncf18", "1"\)/);
  assert.match(countryPages, /class="age-gate"/);
  assert.match(countryPages, /classList\.remove\("age-pending"\)/);
});

test("homepage presentation is rendered from live API rooms, not generated sample profiles", () => {
  const app = read("public/app.js");
  assert.match(app, /fetch\("\/api\/rooms\?/);
  assert.match(app, /renderRegionalSections\(data\.regionalRooms/);
  assert.match(app, /featuredPanel\.append\(featured\)/);
  assert.match(app, /rooms\.map\(card\)/);
  assert.doesNotMatch(app, /var NAMES=\[|function rnd\(\)|Math\.floor\(300\s*\+/);
});

test("room cards retain platform-specific buttons and internal redirect paths", () => {
  const app = read("public/app.js");
  const renderer = read("src/services/room-page-renderer.cjs");
  assert.match(app, /const redirect = isBonga \? "\/bgo\/" : "\/go\/"/);
  assert.match(app, /Watch on BongaCams/);
  assert.match(app, /Watch on Chaturbate/);
  assert.match(renderer, /platform bongacams/);
  assert.match(renderer, /Watch on BongaCams/);
  assert.doesNotMatch(renderer, /href="\\\$\{escapeHtml\(href\)\}"/);
  assert.match(renderer, /platform chaturbate/);
});

test("redesign includes responsive layout and distinct partner badge colours", () => {
  const css = read("public/styles.css");
  assert.match(css, /--bg:\s*#120b1b/i);
  assert.match(css, /--accent:\s*#ff5c8a/i);
  assert.match(css, /\.badge\.platform\.chaturbate\s*\{/);
  assert.match(css, /\.badge\.platform\.bongacams\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
});

test("unavailable partner thumbnails fall back to the branded static preview", () => {
  const app = read("public/app.js");
  const promo = read("public/promo.js");
  assert.match(app, /img\.onerror = \(\) => \{/);
  assert.match(app, /img\.src = "\/og\.svg"/);
  assert.match(promo, /img\.onerror = \(\) => \{/);
  assert.match(promo, /img\.src = '\/og\.svg'/);
  assert.match(app, /img\.onerror = null/);
  assert.match(promo, /img\.onerror = null/);
});



test("BongaCash static and dynamic promotions share a dedicated responsive sidebar", () => {
  const html = read("public/index.html");
  const css = read("public/styles.css");
  assert.match(html, /<div class="directory-layout">[\s\S]*?<div class="directory-main">[\s\S]*?<\/div>\s*<aside class="bonga-promo-sidebar"[\s\S]*?id="bonga-dynamic-banner"[\s\S]*?id="bonga-static-banners"[\s\S]*?<\/aside>/);
  assert.doesNotMatch(html, /<section id="bonga-static-banners"[^>]*><\/section>\s*<section class="loyalty-section"/);
  assert.match(css, /\.directory-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(300px,\s*320px\)/s);
  assert.match(css, /\.bonga-promo-sidebar\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.bonga-promo-sidebar\s*\{\s*margin-top:\s*18px/s);
  assert.match(css, /\.bonga-static-banner iframe\s*\{[^}]*width:\s*300px[^}]*height:\s*250px/s);
});
