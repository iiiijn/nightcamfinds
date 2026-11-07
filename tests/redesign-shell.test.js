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
  assert.match(app, /renderHomeSections\(rooms\)/);
  assert.match(app, /featuredPanel\.append\(featured\)/);
  assert.match(app, /pickHomeRooms\(rooms, key\)/);
  assert.doesNotMatch(app, /var NAMES=\[|function rnd\(\)|Math\.floor\(300\s*\+/);
});

test("room cards retain platform-specific buttons and internal redirect paths", () => {
  const app = read("public/app.js");
  const renderer = read("src/services/room-page-renderer.cjs");
  assert.match(app, /const redirect = "\/go\/"/);
  assert.match(app, /BongaCash link pending verification/);
  assert.match(app, /Watch on Chaturbate/);
  assert.match(renderer, /platform bongacams/);
  assert.match(renderer, /BongaCash link pending verification/);
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
