const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const server = fs.readFileSync("server.js", "utf8");

test("primary category SEO copy targets live-room discovery intent", () => {
  for (const category of ["female", "male", "trans", "couples"]) {
    assert.match(server, new RegExp(category + ":\\["));
  }
  assert.match(server, /Female Live Webcam Rooms \\| NightCamFinds/);
  assert.match(server, /Male Live Webcam Rooms \\| NightCamFinds/);
  assert.match(server, /Trans Live Webcam Rooms \\| NightCamFinds/);
  assert.match(server, /Couples Live Webcam Rooms \\| NightCamFinds/);
  assert.match(server, /Find live couples cam rooms/);
});

test("category pages receive useful server-rendered copy and related category links", () => {
  assert.match(server, /categorySeoContent/);
  assert.match(server, /category-seo-content/);
  assert.match(server, /Related room categories/);
  assert.match(server, /categorySeo\\.paragraphs\\.map/);
});

test("category pages publish CollectionPage structured data and category Open Graph metadata", () => {
  assert.match(server, /"@type": "CollectionPage"/);
  assert.match(server, /application\\/ld\\+json/);
  assert.match(server, /og:title/);
  assert.match(server, /og:description/);
});
