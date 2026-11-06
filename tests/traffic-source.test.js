const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyReferrer } = require("../public/traffic-attribution.js");

test("classifies Google country domains as organic search", () => {
  assert.deepEqual(classifyReferrer("https://www.google.co.uk/search?q=nightcamfinds", "nightcamfinds.com"), {
    source: "google", medium: "organic", referrerHost: "google.co.uk"
  });
  assert.equal(classifyReferrer("https://www.google.de/", "nightcamfinds.com").source, "google");
});

test("classifies ChatGPT, X, Reddit and Telegram referrals", () => {
  assert.equal(classifyReferrer("https://chatgpt.com/", "nightcamfinds.com").source, "chatgpt");
  assert.equal(classifyReferrer("https://t.co/abc", "nightcamfinds.com").source, "x");
  assert.equal(classifyReferrer("https://www.reddit.com/r/example", "nightcamfinds.com").source, "reddit");
  assert.equal(classifyReferrer("https://t.me/channel", "nightcamfinds.com").source, "telegram");
});

test("distinguishes direct, same-site and unknown external referrals", () => {
  assert.equal(classifyReferrer("", "nightcamfinds.com").source, "direct");
  assert.equal(classifyReferrer("https://www.nightcamfinds.com/country/us/", "nightcamfinds.com").source, "direct");
  assert.deepEqual(classifyReferrer("https://example.org/article", "nightcamfinds.com"), {
    source: "referral", medium: "referral", referrerHost: "example.org"
  });
});
