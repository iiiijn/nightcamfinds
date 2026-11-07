"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isDisplayableRoom, filterDisplayableRooms } = require("../src/services/room-quality.cjs");

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

test("filters invalid entries and deduplicates rooms by stable room id", () => {
  const rooms = filterDisplayableRooms([
    { normalized: valid, rawText: "safe title" },
    { normalized: { ...valid, displayName: "" }, rawText: "safe title" },
    { normalized: { ...valid, displayName: "Duplicate display name" }, rawText: "safe title" },
    { normalized: valid, rawText: "underage keyword" }
  ]);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].id, valid.id);
});
