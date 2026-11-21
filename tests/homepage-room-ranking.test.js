"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTopRoomsByProviderCategory } = require("../src/services/homepage-room-ranking.cjs");

const room = (platform, gender, username, viewerCount, extra = {}) => ({
  platform, gender, username, viewerCount, isLive: true, freshness: "FRESH",
  image: "https://images.example/" + username + ".jpg",
  roomSubject: "A useful room description", ...extra
});

test("homepage provider sections use quality-aware ranking rather than viewer count alone", () => {
  const rooms = [
    room("chaturbate", "female", "high-viewers-sparse", 5000, { image: "", roomSubject: "" }),
    room("chaturbate", "female", "quality-room", 300, { isHd: true }),
    room("bongacams", "female", "bonga-high", 800),
    room("bongacams", "female", "bonga-low", 20)
  ];
  const result = buildTopRoomsByProviderCategory(rooms);
  assert.equal(result.chaturbate.female[0].username, "quality-room");
  assert.equal(result.bongacams.female[0].username, "bonga-high");
  assert.ok(result.chaturbate.female.every(item => item.platform === "chaturbate"));
  assert.ok(result.bongacams.female.every(item => item.platform === "bongacams"));
});

test("homepage ranking retains all four categories and caps each provider section", () => {
  const categories = ["female", "male", "trans", "couples"];
  const rooms = categories.flatMap(gender => Array.from({length: 10}, (_, index) =>
    room("chaturbate", gender, gender + "-" + index, index + 1)
  ));
  const result = buildTopRoomsByProviderCategory(rooms);
  for (const category of categories) {
    assert.equal(result.chaturbate[category].length, 8);
    assert.equal(result.bongacams[category].length, 0);
  }
});

test("missing feed data returns safe empty provider categories", () => {
  const result = buildTopRoomsByProviderCategory(null);
  for (const provider of ["chaturbate", "bongacams"]) {
    for (const category of ["female", "male", "trans", "couples"]) {
      assert.deepEqual(result[provider][category], []);
    }
  }
});
