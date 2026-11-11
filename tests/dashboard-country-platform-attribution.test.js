import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");

test("dashboard exposes the country/platform attribution report", () => {
  assert.match(dashboard, /id="countryPlatformStatus"/);
  assert.match(dashboard, /id="countryPlatformMetrics"/);
  for (const label of ["Country", "Platform", "Clicks", "Engaged clicks", "Verified signups", "Verified payers", "Revenue", "EPC", "Evidence"]) {
    assert.ok(dashboard.includes("<th>" + label + "</th>"), "missing report column: " + label);
  }
});

test("dashboard uses existing country/platform API fields", () => {
  for (const field of ["countryPlatformMetrics", "countryPlatformMetricsAvailable", "engagedClicks", "verifiedSignups", "verifiedPayers", "evidenceEligible"]) {
    assert.ok(dashboard.includes(field), "missing API field: " + field);
  }
});

test("dashboard does not combine payout currencies in the country/platform report", () => {
  assert.match(dashboard, /currency-separated traffic-to-revenue report/);
  assert.match(dashboard, /See currency report/);
  assert.match(dashboard, /Manual reconciliation only/);
});

test("dashboard escapes country and platform labels before rendering", () => {
  assert.match(dashboard, /esc\(x\.country\|\|'UNKNOWN'\)/);
  assert.match(dashboard, /esc\(x\.platform\|\|'unknown'\)/);
});

test("dashboard distinguishes unavailable metrics from zero", () => {
  assert.match(dashboard, /Not available/);
  assert.match(dashboard, /click-only fallback active/);
  assert.match(dashboard, /Insufficient evidence/);
});
