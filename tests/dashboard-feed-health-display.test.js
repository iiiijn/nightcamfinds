"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("room coverage renders textual feed health without numeric coercion", () => {
  const dashboard = fs.readFileSync(path.join(__dirname, "../public/dashboard.html"), "utf8");
  assert.match(dashboard, /const healthStatusStat=\(label,value\)=>'<div class="stat"><small>'\+esc\(label\)\+'<\\/small><strong>'\+esc\(value\|\|'unknown'\)\+'<\\/strong><\\/div>';/);
  assert.match(dashboard, /healthStatusStat\('Overall feed health',health\.feedHealth\)/);
  assert.match(dashboard, /stat\('Indexable countries',health\.indexableCountries\)/);
  assert.doesNotMatch(dashboard, /stat\('Overall feed health',health\.feedHealth\)/);
});
