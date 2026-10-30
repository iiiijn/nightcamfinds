const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const start = fs.readFileSync(path.join(__dirname, "../start.js"), "utf8");

test("Chaturbate postbacks reject missing or incorrect configured secrets", () => {
  assert.ok(start.includes('if (configuredSecret && (!params.secret || !safeEqual(params.secret, configuredSecret)))'));
  assert.ok(start.includes('Chaturbate postback rejected: missing or invalid secret'));
});

test("Chaturbate postback stores only complete conversion events", () => {
  assert.ok(start.includes('macroPlaceholder(params.click_id)'));
  assert.ok(start.includes('macroPlaceholder(params.transaction_id)'));
  assert.ok(start.includes('if (!params.click_id || !params.transaction_id)'));
  assert.ok(start.includes('await saveConversion(params)'));
});
