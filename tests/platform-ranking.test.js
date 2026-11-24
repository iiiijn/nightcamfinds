const test = require("node:test");
const assert = require("node:assert/strict");
const { roomQualityScore, rankRoomsByPreferredPlatform } = require("../src/services/platform-ranking.cjs");

const rooms = [
  { username: "cb-high", platform: "chaturbate", viewerCount: 100, isNew: false, isLive: true, image: "https://img.example/cb.jpg", roomSubject: "Friendly chat", gender: "female", freshness: "FRESH" },
  { username: "bonga-low", platform: "bongacams", viewerCount: 10, isNew: false, isLive: true, image: "https://img.example/bonga.jpg", roomSubject: "Music and chat", gender: "female", freshness: "FRESH" },
  { username: "cb-low", platform: "chaturbate", viewerCount: 20, isNew: true, isLive: true, image: "", roomSubject: "", gender: "female" },
  { username: "bonga-high", platform: "bongacams", viewerCount: 80, isNew: true, isLive: true, image: "https://img.example/bonga2.jpg", roomSubject: "Let's talk", gender: "female", freshness: "FRESH" }
];

test("recommended ranking combines activity with usable room information", () => {
  const result = rankRoomsByPreferredPlatform(rooms);
  assert.equal(result[0].username, "bonga-high");
  assert.equal(result.length, rooms.length);
  assert.deepEqual(new Set(result.map(room => room.platform)), new Set(["chaturbate", "bongacams"]));
});

test("quality score rewards live, complete and fresh room information", () => {
  const complete = roomQualityScore(rooms[0]);
  const sparse = roomQualityScore(rooms[2]);
  assert.ok(complete > sparse);
  assert.equal(roomQualityScore(null), 0);
});

test("country platform preference is a small tie-breaker, not a platform-wide override", () => {
  const tied = [
    { platform: "chaturbate", viewerCount: 30, isLive: true },
    { platform: "bongacams", viewerCount: 30, isLive: true }
  ];
  assert.equal(rankRoomsByPreferredPlatform(tied, "bongacams")[0].platform, "bongacams");
  const strongerOtherPlatform = [
    { platform: "bongacams", viewerCount: 10, isLive: true },
    { platform: "chaturbate", viewerCount: 100, isLive: true, image: "https://img.example/a.jpg", roomSubject: "Friendly chat", gender: "female", freshness: "FRESH" }
  ];
  assert.equal(rankRoomsByPreferredPlatform(strongerOtherPlatform, "bongacams")[0].platform, "chaturbate");
});

test("missing or unsupported preference keeps quality-based ranking", () => {
  assert.deepEqual(
    rankRoomsByPreferredPlatform(rooms, null).map(room => room.username),
    rankRoomsByPreferredPlatform(rooms, "unsupported").map(room => room.username)
  );
});

test("newest and viewers sorts remain explicit and deterministic", () => {
  assert.deepEqual(rankRoomsByPreferredPlatform(rooms, "bongacams", "newest").map(room => room.username), ["bonga-high", "cb-low", "cb-high", "bonga-low"]);
  assert.deepEqual(rankRoomsByPreferredPlatform(rooms, null, "viewers").map(room => room.username), ["cb-high", "bonga-high", "cb-low", "bonga-low"]);
});
