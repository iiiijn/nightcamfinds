const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const server = fs.readFileSync("server.js", "utf8");

test("primary category SEO copy targets live-room discovery intent", () => {
  for (const category of ["female", "male", "trans", "couples"]) {
    assert.ok(server.includes(category + ":[") || server.includes(category + ": ["), category + " category copy exists");
  }
  for (const title of [
    "Female Live Webcam Rooms | NightCamFinds",
    "Male Live Webcam Rooms | NightCamFinds",
    "Trans Live Webcam Rooms | NightCamFinds",
    "Couples Live Webcam Rooms | NightCamFinds"
  ]) assert.ok(server.includes(title), title + " title exists");
  assert.ok(server.includes("Find live couples cam rooms"));
});

test("category pages receive useful server-rendered copy and related category links", () => {
  assert.ok(server.includes("categorySeoContent"));
  assert.ok(server.includes("category-seo-content"));
  assert.ok(server.includes("Related room categories"));
  assert.ok(server.includes("categorySeo.paragraphs.map"));
});

test("category pages publish CollectionPage structured data and category Open Graph metadata", () => {
  assert.ok(server.includes('"@type": "CollectionPage"'));
  assert.ok(server.includes("application/ld+json"));
  assert.ok(server.includes("og:title"));
  assert.ok(server.includes("og:description"));
});
