"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderRoomCards } = require("../src/services/room-page-renderer.cjs");

const room = (platform, gender, username) => ({
  id: platform + ":" + username,
  platform,
  gender,
  username,
  displayName: username,
  viewerCount: 25,
  isLive: true,
  href: platform === "bongacams" ? "https://bongacams.com/" + username : "https://chaturbate.com/" + username,
  image: "https://images.example/" + username + ".jpg",
  roomSubject: "Friendly live chat"
});

test("homepage discovery keeps all four categories and both partner platforms represented", () => {
  const rooms = ["female", "male", "trans", "couples"].flatMap((gender) => [
    room("chaturbate", gender, "cb-" + gender),
    room("bongacams", gender, "bonga-" + gender)
  ]);
  const html = renderRoomCards(rooms, { home: true, pagePath: "/" });
  for (const category of ["Top female", "Top male", "Top trans", "Top couples"]) {
    assert.ok(html.includes(category));
  }
  assert.ok(html.includes("Open live room on Chaturbate"));
  assert.ok(html.includes("Open live room on BongaCams"));
});

test("room cards provide a descriptive accessible action and preserve tracked redirects", () => {
  const html = renderRoomCards([room("chaturbate", "female", "alice")], { category: "female", pagePath: "/female/" });
  assert.ok(html.includes('aria-label="Open alice live room on Chaturbate"'));
  assert.ok(html.includes('href="/go/chaturbate%3Aalice?'));
  assert.ok(html.includes("Open live room on Chaturbate"));
  assert.ok(html.includes("Friendly live chat"));
});
