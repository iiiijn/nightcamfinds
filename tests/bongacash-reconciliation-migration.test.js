const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../sql/005_bongacash_daily_reconciliation.sql"), "utf8");
const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
const startup = fs.readFileSync(path.join(__dirname, "../scripts/run-production-migrations.js"), "utf8");

test("BongaCash reconciliation migration matches the API table contract", () => {
  const match = migration.match(/CREATE TABLE IF NOT EXISTS bongacash_daily_reconciliation\s*\(([\s\S]*?)\n\);/i);
  assert.ok(match, "Migration must create the daily reconciliation table");
  for (const column of ["report_date", "registrations", "purchases", "earnings", "notes", "updated_by", "updated_at"]) {
    assert.match(match[1], new RegExp("\\b" + column + "\\b"));
  }
  assert.match(route, /INSERT INTO bongacash_daily_reconciliation/i);
  assert.match(route, /FROM bongacash_daily_reconciliation/i);
});

test("BongaCash reconciliation schema stays outside automatic production migrations", () => {
  assert.match(migration, /intentionally not wired into automatic production startup/i);
  assert.doesNotMatch(startup, /005_bongacash_daily_reconciliation/i);
  assert.match(route, /schema is not installed\. Production migration 005 requires separate approval/i);
  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS bongacash_daily_reconciliation/i);
});
