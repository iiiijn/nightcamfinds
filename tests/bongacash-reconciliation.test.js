import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isValidIsoDate, validateDailyEntry } = require("../src/services/bongacash-reconciliation.cjs");

test("accepts real ISO calendar dates", () => {
  assert.equal(isValidIsoDate("2026-10-30"), true);
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate("30-10-2026"), false);
  assert.equal(isValidIsoDate(""), false);
});

test("validates and normalizes a daily BongaCash report", () => {
  const result = validateDailyEntry({
    date: "2026-10-30",
    registrations: 12,
    purchases: 3,
    earnings: 18.75,
    notes: "BongaCash daily report"
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, {
    date: "2026-10-30",
    registrations: 12,
    purchases: 3,
    earnings: 18.75,
    notes: "BongaCash daily report"
  });
});

test("rejects invalid counts, negative earnings and excessive notes", () => {
  const base = { date: "2026-10-30", registrations: 1, purchases: 0, earnings: 0, notes: "" };
  assert.match(validateDailyEntry({ ...base, registrations: 1.5 }).error, /whole number/);
  assert.match(validateDailyEntry({ ...base, purchases: -1 }).error, /whole number/);
  assert.match(validateDailyEntry({ ...base, earnings: -0.01 }).error, /USD amount/);
  assert.match(validateDailyEntry({ ...base, notes: "x".repeat(501) }).error, /500 characters/);
  assert.match(validateDailyEntry({ ...base, date: "2026-02-30" }).error, /valid reporting date/);
});
