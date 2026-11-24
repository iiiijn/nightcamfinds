import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");

test("recent room clicks expose expandable attribution investigation details", () => {
  assert.match(dashboard, /<th>Investigation<\/th>/);
  assert.match(dashboard, /<summary>Details<\/summary>/);
  for (const field of ["x.medium", "x.campaign", "x.content", "x.device", "x.landingPath||x.landingPage"]) {
    assert.ok(dashboard.includes(field), "missing click detail field: " + field);
  }
});

test("recent click details distinguish missing values from known values", () => {
  assert.match(dashboard, /function recentClickValue\(value\)/);
  assert.match(dashboard, /Not recorded/);
  assert.match(dashboard, /function recentClickTimestamp\(value\)/);
  assert.match(dashboard, /Invalid timestamp/);
});

test("recent click details preserve safe HTML escaping", () => {
  assert.match(dashboard, /function recentClickValue\(value\).*?esc\(String\(value\)\)/);
  assert.match(dashboard, /recentClickValue\(x\.campaign\)/);
});
