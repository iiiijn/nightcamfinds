const test = require("node:test");
const assert = require("node:assert/strict");
const { isSameOriginRequest } = require("../src/services/country-settings-origin.cjs");

test("accepts a matching same-origin request", () => {
  assert.equal(isSameOriginRequest({
    origin: "https://nightcamfinds.com",
    host: "nightcamfinds.com",
    "sec-fetch-site": "same-origin"
  }), true);
});

test("rejects a missing Origin header", () => {
  assert.equal(isSameOriginRequest({ host: "nightcamfinds.com" }), false);
});

test("rejects mismatched and invalid origins", () => {
  assert.equal(isSameOriginRequest({ origin: "https://evil.example", host: "nightcamfinds.com" }), false);
  assert.equal(isSameOriginRequest({ origin: "not-a-url", host: "nightcamfinds.com" }), false);
});

test("rejects cross-site fetches even when the host matches", () => {
  assert.equal(isSameOriginRequest({
    origin: "https://nightcamfinds.com",
    host: "nightcamfinds.com",
    "sec-fetch-site": "cross-site"
  }), false);
});
