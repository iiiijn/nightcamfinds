"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

test("room discovery rejects non-success API responses instead of showing a false empty state", () => {
  assert.match(app, /if \(!response\.ok\) throw new Error\("Room feed request failed \(" \+ response\.status \+ "\)\."/);
  assert.match(app, /Room feed returned an invalid response/);
});

test("background refresh failures are visible instead of silently ignored", () => {
  assert.match(app, /load\(\)\.catch\(\(\) => \{\s*notice\.hidden = false;\s*notice\.textContent = "Could not refresh rooms\. Please try again\."/);
});
