const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildUrl,
  normalizeRoom,
  DEFAULT_API_BASE
} = require("../providers/chaturbate");

test("builds the Chaturbate Users Online v2 URL with the documented parameters", () => {
  const url = buildUrl({
    campaign: "C6yxN",
    clientIp: "203.0.113.10",
    limit: 100,
    offset: 20,
    gender: "f",
    region: "northamerica",
    tag: "verified"
  });

  assert.equal(url.origin + url.pathname, DEFAULT_API_BASE);
  assert.equal(url.searchParams.get("wm"), "C6yxN");
  assert.equal(url.searchParams.get("client_ip"), "203.0.113.10");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("offset"), "20");
  assert.equal(url.searchParams.get("gender"), "f");
  assert.equal(url.searchParams.get("region"), "northamerica");
  assert.equal(url.searchParams.get("tag"), "verified");
});

test("normalizes the documented Chaturbate room fields", () => {
  const room = normalizeRoom({
    username: "ExampleModel",
    display_name: "Example Model",
    gender: "f",
    country: "us",
    num_users: 1234,
    is_hd: true,
    is_new: true,
    image_url_360x270: "https://example.com/image.jpg",
    room_subject: "Hello world",
    spoken_languages: "English",
    chat_room_url_revshare: "https://chaturbate.com/ExampleModel/"
  });

  assert.deepEqual(room, {
    id: "chaturbate:ExampleModel",
    platform: "chaturbate",
    platformName: "Chaturbate",
    username: "ExampleModel",
    displayName: "Example Model",
    gender: "female",
    country: "US",
    countryName: "US",
    location: "",
    viewerCount: 1234,
    isHd: true,
    isNew: true,
    image: "https://example.com/image.jpg",
    roomSubject: "Hello world",
    languages: "English",
    href: "https://chaturbate.com/ExampleModel/"
  });
});
