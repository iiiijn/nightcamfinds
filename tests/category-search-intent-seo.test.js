const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const server = fs.readFileSync("server.js", "utf8");
const renderer = fs.readFileSync("src/services/category-seo-renderer.cjs", "utf8");

test("primary category SEO copy targets live-room discovery intent", () => {
  for (const category of ["female", "male", "trans", "couples"]) {
    assert.ok(server.includes(category + ":{") || server.includes(category + ": {"), category + " category copy exists");
  }
  for (const title of [
    "Female Live Cam Rooms Online | NightCamFinds",
    "Male Live Webcam Rooms | NightCamFinds",
    "Trans Live Webcam Rooms | NightCamFinds",
    "Couples Live Webcam Rooms | NightCamFinds"
  ]) assert.ok(server.includes(title), title + " title exists");
  assert.ok(server.includes("Find couples live cam rooms online"));
  assert.ok(server.includes("Browse female live cam rooms online"));
  assert.ok(server.includes("Female Live Cam Rooms Online | NightCamFinds"));
  assert.ok(server.includes("Browse female live cam rooms from Chaturbate and BongaCams."));
  assert.ok(server.includes("Chaturbate and BongaCams"));
  assert.ok(server.includes("Find male live webcam rooms online"));
  assert.ok(server.includes("Find couples live cam rooms online"));
  assert.ok(server.includes("Chaturbate Germany"));
});

test("country directory SEO targets country-based discovery across both partner platforms", () => {
  assert.ok(server.includes('countries: {'));
  assert.ok(server.includes("Live Cams by Country | Chaturbate & BongaCams | NightCamFinds"));
  assert.ok(server.includes("Find Chaturbate and BongaCams live cams by country."));
  assert.ok(server.includes("Find live cams by country using the location information supplied"));
  assert.ok(server.includes("Country labels are supplied by partner feeds"));
});

test("category pages render useful copy and links to eligible country directories", () => {
  assert.ok(server.includes("renderCategorySeoHtml"));
  assert.ok(server.includes("getEligibleCountrySitemapSlugs"));
  assert.ok(renderer.includes("category-seo-content"));
  assert.ok(renderer.includes("Related room categories"));
  assert.ok(renderer.includes("Eligible country room directories"));
});

test("category pages publish CollectionPage structured data and Open Graph metadata", () => {
  assert.ok(renderer.includes('"@type": "CollectionPage"'));
  assert.ok(renderer.includes("application/ld+json"));
  assert.ok(renderer.includes("og:title"));
  assert.ok(renderer.includes("og:description"));
});
