"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function loadFunction(source, name, nextMarker) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, name + " must exist");
  const end = source.indexOf(nextMarker, start);
  assert.notEqual(end, -1, "function boundary must exist");
  return new Function(source.slice(start, end) + "; return " + name + ";")();
}

test("server interleaves BongaCams and Chaturbate before pagination without duplicating rooms", () => {
  const source = read("server.js");
  const balance = loadFunction(source, "balancePlatformRooms", "async function rooms(req)");
  const rooms = [
    { id: "c1", platform: "chaturbate" }, { id: "c2", platform: "chaturbate" },
    { id: "c3", platform: "chaturbate" }, { id: "b1", platform: "bongacams" },
    { id: "b2", platform: "bongacams" }, { id: "other", platform: "other" }
  ];
  const result = balance(rooms);
  assert.deepEqual(result.map(room => room.id), ["b1", "c1", "b2", "c2", "c3", "other"]);
  assert.equal(new Set(result.map(room => room.id)).size, rooms.length);
  assert.match(source, /list=balancePlatformRooms\(list\)/);
  assert.match(source, /if\(!\["chaturbate","bongacams"\]\.includes\(platform\)\)/);
});

test("homepage category rows balance providers and regional rows use balanced ordering", () => {
  const source = read("public/app.js");
  assert.match(source, /balanceCategoryRooms\(\[\.\.\.bonga, \.\.\.chaturbate\]\)\.slice\(0, 8\)/);
  assert.match(source, /balanceCategoryRooms\(rooms\)\.slice\(0, 8\)/);
  assert.match(source, /BongaCams · .*Chaturbate/);
});

test("client balancing fills from the provider with more eligible rooms and preserves unique entries", () => {
  const source = read("public/app.js");
  const balance = loadFunction(source, "balanceCategoryRooms", "function renderRegionalSections");
  const rooms = [
    { id: "c1", platform: "chaturbate" }, { id: "c2", platform: "chaturbate" },
    { id: "b1", platform: "bongacams" }, { id: "c3", platform: "chaturbate" }
  ];
  const result = balance(rooms);
  assert.deepEqual(result.map(room => room.id), ["b1", "c1", "c2", "c3"]);
  assert.equal(new Set(result.map(room => room.id)).size, rooms.length);
});
