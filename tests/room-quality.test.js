"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanRoomTitle, normalizeRoomGender, hasSpamTitle, isDisplayableRoom, filterDisplayableRooms } = require("../src/services/room-quality.cjs");

const valid = {
  id: "chaturbate:alice",
  platform: "chaturbate",
  username: "alice",
  displayName: "Alice",
  roomSubject: "Friendly chat",
  viewerCount: 24,
  href: "https://chaturbate.com/alice/"
};

test("accepts a well-formed live room from a supported partner domain", () => {
  assert.equal(isDisplayableRoom(valid), true);
  assert.equal(isDisplayableRoom({
    ...valid,
    id: "bongacams:bob",
    platform: "bongacams",
    username: "bob",
    href: "https://www.bongacams.com/bob"
  }), true);
});

test("rejects missing identity, invalid viewer counts, and unsupported destinations", () => {
  assert.equal(isDisplayableRoom({ ...valid, username: "", id: "chaturbate:" }), false);
  assert.equal(isDisplayableRoom({ ...valid, viewerCount: -1 }), false);
  assert.equal(isDisplayableRoom({ ...valid, viewerCount: "unknown" }), false);
  assert.equal(isDisplayableRoom({ ...valid, href: "https://example.com/alice" }), false);
  assert.equal(isDisplayableRoom({ ...valid, href: "http://chaturbate.com/alice" }), false);
});

test("rejects youth-related terms in raw feed text even if display cleaning removes them", () => {
  assert.equal(isDisplayableRoom(valid, "teen room"), false);
  assert.equal(isDisplayableRoom(valid, "normal public room"), true);
});

test("cleans room titles without changing ordinary wording", () => {
  assert.equal(cleanRoomTitle("  Friendly
 chat\t tonight  "), "Friendly chat tonight");
  assert.equal(cleanRoomTitle("A playful room for music and conversation"), "A playful room for music and conversation");
});

test("flags links and obvious off-platform promotional spam but keeps normal room titles", () => {
  assert.equal(hasSpamTitle("Visit https://example.com for more"), true);
  assert.equal(hasSpamTitle("Join my Telegram channel"), true);
  assert.equal(hasSpamTitle("A friendly room for music, jokes and conversation"), false);
  assert.equal(isDisplayableRoom({ ...valid, roomSubject: "Join my Telegram channel" }), false);
  assert.equal(isDisplayableRoom({ ...valid, roomSubject: "Visit www.example.com" }), false);
});

test("rejects keyword-stuffed titles with excessive repetition", () => {
  assert.equal(hasSpamTitle("hot hot hot hot hot hot hot hot room"), true);
  assert.equal(hasSpamTitle("Hot chat, music, dancing and friendly conversation"), false);
});

test("accepts only recognized categories when a category is supplied", () => {
  for (const gender of ["female", "male", "trans", "couples"]) {
    assert.equal(isDisplayableRoom({ ...valid, gender }), true);
  }
  assert.equal(isDisplayableRoom({ ...valid, gender: "other" }), false);
  assert.equal(isDisplayableRoom(valid), true);
});

test("filters invalid entries and deduplicates rooms by stable room id", () => {
  const rooms = filterDisplayableRooms([
    { normalized: valid, rawText: "safe title" },
    { normalized: { ...valid, displayName: "" }, rawText: "safe title" },
    { normalized: { ...valid, displayName: "Duplicate display name" }, rawText: "safe title" },
    { normalized: valid, rawText: "underage keyword" },
    { normalized: { ...valid, gender: "unknown" }, rawText: "safe title" }
  ]);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].id, valid.id);
});

test("BongaCams feed uses strict category mapping and the shared room validator", () => {
  const route = require("node:fs").readFileSync(require("node:path").join(__dirname, "../route.js"), "utf8");
  assert.match(route, /filterDisplayableRooms\(normalized\)/);
  assert.ok(route.includes("/^(?:female|woman|women|f)$/"));
  assert.doesNotMatch(route, /rawGender\.includes\("male"\)/);
});

test("normalizes only explicit provider categories and leaves unknown values uncategorized", () => {
  for (const [input, expected] of [
    ["f", "female"], ["Female", "female"], ["woman", "female"], ["weiblich", "female"],
    ["m", "male"], ["Men", "male"],
    ["t", "trans"], ["transgender", "trans"], ["s", "trans"],
    ["c", "couples"], ["couple", "couples"],
    ["paar weiblich + männlich", "couples"], ["paar weiblich + weiblich", "couples"]
  ]) {
    assert.equal(normalizeRoomGender(input), expected, input);
  }
  for (const input of ["", null, undefined, "unknown", "nonbinary", "trans male", "female model"]) {
    assert.equal(normalizeRoomGender(input), "", String(input));
  }
});

test("directory feed normalizers do not silently classify unknown provider genders as female", () => {
  const server = require("node:fs").readFileSync(require("node:path").join(__dirname, "../server.js"), "utf8");
  assert.match(server, /gender:normalizeRoomGender\(room\.gender\)/);
  assert.match(server, /function bongaGender\(value\) \{ return normalizeRoomGender\(value\); \}/);
  assert.doesNotMatch(server, /GENDER\[room\.gender\]\s*\|\|\s*"female"/);
  assert.doesNotMatch(server, /return"female";\s*\}/);
});
