const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const start = fs.readFileSync(path.join(root, "start.js"), "utf8");
const helper = fs.readFileSync(path.join(root, "src/services/chaturbate-revshare.cjs"), "utf8");
const revenue = fs.readFileSync(path.join(root, "src/services/conversion-revenue.cjs"), "utf8");
const audit = fs.readFileSync(path.join(root, "docs/phase-a1-16-conversion-readiness.md"), "utf8");

test("Chaturbate callback authentication is required before macro handling or persistence", () => {
  const configured = start.indexOf('const configuredSecret = String(process.env.CB_POSTBACK_SECRET || "").trim()');
  const supplied = start.indexOf('if (!suppliedSecret || !safeEqual(suppliedSecret, configuredSecret))');
  const macro = start.indexOf("hasUnresolvedChaturbateMacros(params)");
  const persist = start.indexOf("saveConversion(removePostbackSecrets(params))");
  assert.ok(configured >= 0 && supplied > configured);
  assert.ok(macro > supplied);
  assert.ok(persist > macro);
});

test("Chaturbate callback keeps idempotency and rejects conflicting transaction reuse", () => {
  assert.ok(start.includes("UNIQUE(transaction_id)"));
  assert.ok(start.includes("ON CONFLICT (transaction_id) DO NOTHING"));
  assert.ok(start.includes("Conflicting duplicate Chaturbate transaction ID"));
  assert.ok(start.includes("sameChaturbateTransaction(existing"));
});

test("Chaturbate click matching is platform-scoped in the primary ledger", () => {
  assert.ok(start.includes("FROM affiliate_clicks WHERE click_id = $1::varchar(128) AND platform = 'chaturbate'"));
});

test("verified revenue excludes unmatched events and preserves currency grouping", () => {
  assert.ok(start.includes("WHERE matched_click IS TRUE"));
  assert.ok(revenue.includes("cc.matched_click IS TRUE"));
  assert.ok(revenue.includes("GROUP BY 1,2,3,4,5,6,7,8,9"));
  assert.ok(start.includes("earningsByCurrency"));
  assert.ok(start.includes("earningsByCurrency.USD?.earnings"));
});

test("BongaCash automatic callback remains explicitly unsupported and not connected", () => {
  assert.ok(start.includes("bongacashConnected: false"));
  assert.ok(start.includes('incoming.pathname === "/api/bongacash/postback"'));
  assert.ok(start.includes("410"));
  assert.match(audit, /must remain disabled/i);
  assert.match(audit, /does not document a server-to-server postback endpoint/i);
});

test("readiness audit does not claim provider account settings or real conversions were verified", () => {
  assert.match(audit, /not an inspection of either affiliate account's private settings/i);
  assert.match(audit, /No affiliate redirect was clicked/i);
  assert.match(audit, /no conversion was fabricated/i);
  assert.match(audit, /public documentation cannot verify private account settings/i);
});

test("Chaturbate documentation does not equate Validation Salt with the local shared secret", () => {
  assert.match(audit, /Do not substitute Validation Salt for `CB_POSTBACK_SECRET`/);
  assert.match(audit, /checksum validation remains unimplemented/i);
  assert.ok(helper.includes('const privateFields = new Set(["secret", "checksum", "validation", "validation_token", "validation_salt"])'));
});
