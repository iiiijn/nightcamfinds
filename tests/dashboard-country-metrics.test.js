import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");

test("dashboard exposes a country/platform attribution report", () => {
  assert.match(dashboard, /id="countryPlatformMetrics"/);
  assert.match(dashboard, /id="countryPlatformStatus"/);
  for (const label of ["Country", "Platform", "Engaged", "Signups", "Payers", "Revenue", "EPC"]) {
    assert.ok(dashboard.includes("<th>" + label + "</th>"), `missing report column: ${label}`);
  }
});

test("dashboard distinguishes unavailable conversion data from zero", () => {
  assert.match(dashboard, /Unavailable/);
  assert.match(dashboard, /conversion attribution unavailable until schema and postbacks are verified/i);
  assert.match(dashboard, /Insufficient data/);
});

test("dashboard escapes country and platform labels before rendering", () => {
  assert.match(dashboard, /esc\(m\.country\)/);
  assert.match(dashboard, /esc\(m\.platform\)/);
});
