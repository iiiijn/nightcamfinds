"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderRoomCards, renderHeroCopy, plainText } = require("../src/services/room-page-renderer.cjs");

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

test("hero copy is interpolated into server HTML without template placeholders", () => {
  const template = '<p id="kicker">Independent discovery</p><h1 id="page-title">Discover live cams right now</h1><p id="page-intro">Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.</p><title>NightCamFinds — Live cam directory</title><meta name="description" content="Browse live rooms by country from Chaturbate and BongaCams. NightCamFinds does not stream video.">';
  const html = renderHeroCopy(template, ["Country directory", "Live cams in Canada", "Browse public rooms in Canada.", "Canada live cams — NightCamFinds"]);
  assert.match(html, /id="kicker">Country directory/);
  assert.match(html, /id="page-title">Live cams in Canada/);
  assert.match(html, /id="page-intro">Browse public rooms in Canada\./);
  assert.match(html, /<title>Canada live cams — NightCamFinds<\/title>/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test("object-valued BongaCams subjects become readable text, never object coercion", () => {
  const html = renderRoomCards([{ ...rooms[1], roomSubject: { description: "Friendly chat", nested: { title: "ignored" } } }]);
  assert.match(html, /Friendly chat/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test("unknown object descriptions safely fall back to an empty value", () => {
  assert.equal(plainText({ unexpected: { payload: "raw" } }), "");
  assert.equal(plainText(["English", { name: "German" }]), "English, German");
});

test("hero renderer replaces literal template placeholders even when the template defaults change", () => {
  const template = '<p id="kicker">${copy[0]}</p><h1 id="page-title">${copy[1]}</h1><p id="page-intro">${copy[2]}</p><title>${copy[3]}</title><meta name="description" content="${copy[2]}">';
  const html = renderHeroCopy(template, ["Country directory", "Live cams in Ireland", "Browse public rooms in Ireland.", "Ireland live cams — NightCamFinds"]);
  assert.match(html, /id="kicker">Country directory/);
  assert.match(html, /id="page-title">Live cams in Ireland/);
  assert.match(html, /id="page-intro">Browse public rooms in Ireland\./);
  assert.match(html, /<title>Ireland live cams — NightCamFinds<\/title>/);
  assert.doesNotMatch(html, /\$\{copy\[/);
});

test("BongaCams object-valued card fields render readable values without object coercion", () => {
  const html = renderRoomCards([{
    ...rooms[1],
    displayName: { username: "bonga_bob" },
    roomSubject: { description: "Friendly chat" },
    countryName: { name: "United Kingdom" }
  }]);
  assert.match(html, /bonga_bob/);
  assert.match(html, /Friendly chat/);
  assert.match(html, /United Kingdom/);
  assert.doesNotMatch(html, /\[object Object\]/);
});
