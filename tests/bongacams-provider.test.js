const test = require("node:test");
const assert = require("node:assert/strict");
const { buildUrl, normalizeRoom } = require("../providers/bongacams");

test("BongaCams URL includes campaign and JSON API parameters", () => {
  const url = buildUrl({ campaign: "840970", limit: 50 });
  assert.equal(url.searchParams.get("c"), "840970");
  assert.equal(url.searchParams.get("type"), "api");
  assert.equal(url.searchParams.get("api_type"), "json");
  assert.equal(url.searchParams.get("limit"), "50");
});

test("BongaCams room is normalized to the shared room shape", () => {
  const room = normalizeRoom({
    username: "demo_model",
    display_name: "Demo Model",
    gender: "female",
    country: "US",
    members_count: 123,
    hd: true,
    room_url: "https://bongacams.com/demo_model"
  });
  assert.equal(room.id, "bongacams:demo_model");
  assert.equal(room.platform, "bongacams");
  assert.equal(room.gender, "female");
  assert.equal(room.country, "US");
  assert.equal(room.viewerCount, 123);
  assert.equal(room.isHd, true);
  assert.equal(room.href, "https://bongacams.com/demo_model");
});
