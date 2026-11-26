import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { buildAffiliateConversionHealth } = require("../src/services/affiliate-conversion-health.cjs");

test("reports Chaturbate callback authentication and matching separately", () => {
  const result = buildAffiliateConversionHealth({
    postbackSecretConfigured: true,
    callbackCounts: { totalEvents: 10, eligibleEvents: 6, matchedEvents: 4, unmatchedEvents: 2, missingClickId: 1, unsupportedEventTypes: 3, unresolvedMacroEvents: 1 }
  });
  assert.equal(result.chaturbate.authentication, "configured");
  assert.equal(result.chaturbate.callbackLedger, "events_received");
  assert.equal(result.chaturbate.matchingCoverage, 0.6667);
  assert.equal(result.chaturbate.unsupportedEventTypes, 3);
  assert.equal(result.chaturbate.unresolvedMacroEvents, 1);
  assert.match(result.chaturbate.eligibilityRule, /supported Chaturbate event types/);
  assert.equal(result.chaturbate.unmatchedEvents, 2);
  assert.equal(result.chaturbate.missingClickId, 1);
});

test("does not expose secret values and reports missing callback setup", () => {
  const result = buildAffiliateConversionHealth({ postbackSecretConfigured: false });
  assert.equal(result.chaturbate.authentication, "not_configured");
  assert.equal(result.chaturbate.callbackLedger, "no_events_recorded");
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
  assert.equal(result.chaturbate.matchingCoverage, null);
});

test("reports BongaCash as manual reconciliation and identifies missing schema", () => {
  const result = buildAffiliateConversionHealth({
    reconciliation: { schemaReady: false, daysReported: 0, latestReportDate: null }
  });
  assert.equal(result.bongacash.trackingMode, "manual_reconciliation");
  assert.equal(result.bongacash.automaticPostbacks, false);
  assert.equal(result.bongacash.reconciliationStatus, "schema_unavailable");
});

test("reports available BongaCash reconciliation activity without claiming click attribution", () => {
  const result = buildAffiliateConversionHealth({
    reconciliation: { schemaReady: true, daysReported: 4, latestReportDate: "2026-11-26" }
  });
  assert.equal(result.bongacash.reconciliationStatus, "reports_recorded");
  assert.equal(result.bongacash.daysReported, 4);
  assert.equal(result.bongacash.latestReportDate, "2026-11-26");
  assert.match(result.bongacash.revenueRule, /not click-attributed/);
});

test("protected production route exposes read-only conversion health and never returns the secret", () => {
  const route = fs.readFileSync(new URL("../route.js", import.meta.url), "utf8");
  assert.match(route, /incoming\.pathname === "\/api\/affiliate-conversion-health"/);
  assert.match(route, /validDashboardSession\(req\)/);
  assert.match(route, /postbackSecretConfigured: Boolean\(String\(process\.env\.CB_POSTBACK_SECRET/);
  assert.match(route, /unsupported_event_types/);
  assert.match(route, /unresolved_macro_events/);
  assert.match(route, /unsupportedEventTypes: row\.unsupported_event_types/);
  assert.match(route, /bongacash_daily_reconciliation/);
  assert.ok(!route.includes("process.env.CB_POSTBACK_SECRET,"));
});

test("revenue dashboard loads and displays conversion pipeline health", () => {
  const html = fs.readFileSync(new URL("../public/revenue.html", import.meta.url), "utf8");
  assert.match(html, /id="conversionHealth"/);
  assert.match(html, /\/api\/affiliate-conversion-health\?/);
  assert.match(html, /Matching coverage/);
  assert.match(html, /Unsupported event types excluded/);
  assert.match(html, /Unresolved macro\/test callbacks/);
  assert.match(html, /Unsupported event types excluded/);
  assert.match(html, /Unresolved macro\/test callbacks/);
  assert.match(html, /Reconciliation status/);
});
