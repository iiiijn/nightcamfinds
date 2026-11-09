const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const start = fs.readFileSync(path.join(__dirname, "../start.js"), "utf8");
const helper = fs.readFileSync(path.join(__dirname, "../src/services/chaturbate-revshare.cjs"), "utf8");
const { removePostbackSecrets } = require("../src/services/chaturbate-revshare.cjs");

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

test("postback authentication secrets are removed before conversion persistence", () => {
  const safe = removePostbackSecrets({
    click_id: "ncf_test",
    transaction_id: "tx-1",
    secret: "do-not-store",
    Secret: "also-do-not-store",
    payout: "1.25"
  });
  assert.deepEqual(safe, {
    click_id: "ncf_test",
    transaction_id: "tx-1",
    payout: "1.25"
  });
  assert.ok(!start.includes("        await saveConversion(removePostbackSecrets(params))"));
  assert.ok(start.includes("const saved = await saveConversion(removePostbackSecrets(params))"));
  assert.ok(start.includes("matchedClick: saved.matchedClick"));
  assert.ok(start.includes("duplicate: !saved.inserted"));
});

test("Chaturbate currency is not silently assumed to be USD", () => {
  assert.ok(helper.includes("currency,"));
  assert.ok(!helper.includes('currency: currency || "USD"'));
});

test("conversion persistence records whether a click matched and ignores duplicate transaction IDs", () => {
  assert.ok(start.includes("SELECT EXISTS(SELECT 1 FROM cb_clicks WHERE click_id = $1::varchar(128)) AS matched"));
  assert.ok(start.includes("ON CONFLICT (transaction_id) DO NOTHING"));
  assert.ok(start.includes("RETURNING id"));
  assert.ok(start.includes("return { matchedClick, inserted: inserted.rowCount === 1 }"));
});

test("dashboard verified revenue includes only matched supported Chaturbate event types", () => {
  assert.ok(start.includes("WHERE matched_click IS TRUE"));
  assert.ok(start.includes("tokens_signup-referral"));
  assert.ok(start.includes("ppr_signup-referral"));
  assert.ok(start.includes("revshare_broadcaster-referral"));
  assert.ok(start.includes("revshare_webmaster-commission"));
  assert.ok(start.includes("revshare_payout-adjustment"));
  assert.ok(start.includes("AND cc.matched_click IS TRUE"));
});

test("dashboard keeps matched Chaturbate earnings separated by currency", () => {
  const dashboard = fs.readFileSync(path.join(__dirname, "../public/dashboard.html"), "utf8");
  assert.ok(start.includes("GROUP BY 1"));
  assert.ok(start.includes("earningsByCurrency"));
  assert.ok(start.includes("const cbUsdEarnings = Number(earningsByCurrency.USD?.earnings || 0)"));
  assert.ok(dashboard.includes("currencyBreakdown(j.earningsByCurrency)"));
  assert.ok(dashboard.includes("Matched payout by currency"));
});
