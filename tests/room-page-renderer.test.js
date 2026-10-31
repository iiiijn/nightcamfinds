"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderRoomCards } = require("../src/services/room-page-renderer.cjs");

const rooms = [
  { id: "chaturbate:alice", platform: "chaturbate", gender: "female", username: "alice", displayName: "Alice", viewerCount: 12, country: "US", roomSubject: "Hello", href: "https://chaturbate.com/alice/", image: "https://images.example/alice.jpg", isHd: true, isNew: false },
  { id: "bongacams:bob", platform: "bongacams", gender: "male", username: "bob", displayName: "Bob", viewerCount: 8, country: "GB", roomSubject: "Live now", href: "https://bongacams.com/bob", image: "javascript:alert(1)", isHd: false, isNew: true }
];

test("server room cards use tracked redirects and escape feed content", () => {
  const html = renderRoomCards(rooms, { pagePath: "/female/", category: "female" });
  assert.match(html, /href="\/go\/chaturbate%3Aalice\?/);
  assert.match(html, /href="\/bgo\/bongacams%3Abob\?/);
  assert.match(html, /source=direct/);
  assert.match(html, /campaign=organic/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /rel="sponsored nofollow noopener"/);
});

test("server room cards escape untrusted text", () => {
  const html = renderRoomCards([{ ...rooms[0], displayName: '<img src=x onerror="alert(1)">', roomSubject: "<script>alert(1)</script>" }]);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});

test("home page renders grouped server-side room sections", () => {
  const html = renderRoomCards(rooms, { home: true, pagePath: "/" });
  assert.match(html, /Top female/);
  assert.match(html, /Top male/);
  assert.match(html, /\/go\//);
  assert.match(html, /\/bgo\//);
});

test("empty room lists render a useful empty state", () => {
  assert.match(renderRoomCards([]), /No live rooms are available/);
});
