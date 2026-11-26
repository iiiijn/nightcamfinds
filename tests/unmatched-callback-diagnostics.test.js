import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { buildUnmatchedCallbackDiagnosticsQuery, toSafeDiagnosticRows } = require("../src/services/unmatched-callback-diagnostics.cjs");

test("builds a parameterized, bounded unmatched callback query", () => {
  const query = buildUnmatchedCallbackDiagnosticsQuery({ from: "2026-11-01", to: "2026-11-27", limit: 500 });
  assert.deepEqual(query.params, ["2026-11-01T00:00:00.000Z", "2026-11-27T23:59:59.999Z", 100]);
  assert.equal(query.limit, 100);
  assert.match(query.text, /cb_conversions/);
  assert.match(query.text, /cb_clicks/);
  assert.match(query.text, /affiliate_clicks/);
  assert.match(query.text, /matches_chaturbate_ledger/);
  assert.match(query.text, /matches_affiliate_ledger/);
  assert.match(query.text, /LIMIT \$3/);
  assert.ok(!query.text.includes("2026-11-01"));
});

test("supports all-time queries with a safe default limit", () => {
  const query = buildUnmatchedCallbackDiagnosticsQuery();
  assert.deepEqual(query.params, [50]);
  assert.equal(query.limit, 50);
  assert.match(query.text, /LIMIT \$1/);
});

test("returns safe metadata only and never exposes click or transaction identifiers", () => {
  const rows = toSafeDiagnosticRows([{
    received_at: "2026-11-25T14:00:00.000Z",
    conversion_type: "revshare_purchase",
    country: "us",
    currency: "usd",
    eligible: true,
    has_click_id: true,
    matches_chaturbate_ledger: false,
    matches_affiliate_ledger: false,
    stored_as_matched: false,
    click_id: "PRIVATE_CLICK_ID",
    transaction_id: "PRIVATE_TRANSACTION_ID"
  }]);
  assert.deepEqual(rows[0], {
    receivedAt: "2026-11-25T14:00:00.000Z",
    eventType: "revshare_purchase",
    country: "US",
    currency: "USD",
    callbackClass: "eligible",
    hasClickId: true,
    matchesChaturbateLedger: false,
    matchesAffiliateLedger: false,
    storedAsMatched: false
  });
  const serialized = JSON.stringify(rows);
  assert.ok(!serialized.includes("PRIVATE_CLICK_ID"));
  assert.ok(!serialized.includes("PRIVATE_TRANSACTION_ID"));
});

test("production route protects diagnostics and permits GET only", () => {
  const route = fs.readFileSync(new URL("../route.js", import.meta.url), "utf8");
  const start = route.indexOf('incoming.pathname === "/api/unmatched-chaturbate-callbacks"');
  const end = route.indexOf('incoming.pathname === "/api/affiliate-conversion-health"', start);
  const block = route.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /validDashboardSession\(req\)/);
  assert.match(block, /req.method !== "GET"/);
  assert.match(block, /buildUnmatchedCallbackDiagnosticsQuery/);
  assert.match(block, /toSafeDiagnosticRows/);
  assert.match(block, /Click IDs, transaction IDs, raw callback payloads, secrets and payout values are never returned/);
});

test("revenue dashboard requests and renders unmatched callback diagnostics", () => {
  const html = fs.readFileSync(new URL("../public/revenue.html", import.meta.url), "utf8");
  assert.match(html, /id="unmatchedCallbackDiagnostics"/);
  assert.match(html, /\/api\/unmatched-chaturbate-callbacks\?/);
  assert.match(html, /Chaturbate unmatched callback diagnostics/);
  assert.match(html, /Matches Chaturbate ledger/);
  assert.match(html, /Matches affiliate ledger/);
});
