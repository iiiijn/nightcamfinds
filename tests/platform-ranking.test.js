const test = require("node:test");
const assert = require("node:assert/strict");
const { rankRoomsByPreferredPlatform } = require("../src/services/platform-ranking.cjs");

const rooms = [
  { username: "cb-high", platform: "chaturbate", viewerCount: 100, isNew: false },
  { username: "bonga-low", platform: "bongacams", viewerCount: 10, isNew: false },
  { username: "cb-low", platform: "chaturbate", viewerCount: 20, isNew: true },
  { username: "bonga-high", platform: "bongacams", viewerCount: 80, isNew: true }
];

test("approved preference ranks that platform first while keeping both platforms available", () => {
  const result = rankRoomsByPreferredPlatform(rooms, "bongacams", "recommended");
  assert.deepEqual(result.map(room => room.username), ["bonga-high", "bonga-low", "cb-high", "cb-low"]);
  assert.equal(result.length, rooms.length);
  assert.deepEqual(new Set(result.map(room => room.platform)), new Set(["chaturbate", "bongacams"]));
});

test("missing or unsupported preference preserves ordinary recommended ordering", () => {
  assert.deepEqual(rankRoomsByPreferredPlatform(rooms, null).map(room => room.username), ["cb-high", "bonga-high", "cb-low", "bonga-low"]);
  assert.deepEqual(rankRoomsByPreferredPlatform(rooms, "unsupported").map(room => room.username), ["cb-high", "bonga-high", "cb-low", "bonga-low"]);
});

test("newest sort is not overridden by a country platform preference", () => {
  const result = rankRoomsByPreferredPlatform(rooms, "bongacams", "newest");
  assert.deepEqual(result.map(room => room.username), ["cb-low", "bonga-high", "cb-high", "bonga-low"]);
});
