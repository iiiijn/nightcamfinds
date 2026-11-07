const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const start = fs.readFileSync(path.join(__dirname, "../start.js"), "utf8");
const helper = fs.readFileSync(path.join(__dirname, "../src/services/chaturbate-revshare.cjs"), "utf8");

test("Chaturbate postbacks accept GET and POST form or JSON payloads", () => {
  assert.ok(start.includes('req.method !== "GET" && req.method !== "POST"'));
  assert.ok(start.includes("application/x-www-form-urlencoded"));
  assert.ok(start.includes("application/json"));
  assert.ok(start.includes("normalizeChaturbatePostback(params)"));
});

test("real Chaturbate conversion postbacks require a configured shared secret", () => {
  assert.ok(start.includes('if (!configuredSecret)'));
  assert.ok(start.includes('if (!params.secret || !safeEqual(params.secret, configuredSecret))'));
});

test("macro test callbacks are acknowledged without recording conversions", () => {
  assert.ok(start.includes("macroPlaceholder(params.click_id)"));
  assert.ok(start.includes("macroPlaceholder(params.transaction_id)"));
  assert.ok(start.includes("no conversion recorded"));
});

test("normalizer rejects unsupported events and missing transaction data", () => {
  assert.ok(helper.includes("unsupported_event_type"));
  assert.ok(helper.includes("missing_click_id"));
  assert.ok(helper.includes("missing_transaction_id"));
  assert.ok(helper.includes("missing_or_invalid_payout"));
});

test("Chaturbate currency is not silently assumed to be USD", () => {
  assert.ok(helper.includes("currency,"));
  assert.ok(!helper.includes('currency: currency || "USD"'));
});
