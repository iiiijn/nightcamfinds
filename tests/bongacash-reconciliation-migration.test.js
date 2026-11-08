const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../sql/005_bongacash_daily_reconciliation.sql"), "utf8");
const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
const { getMigrationPlan } = require("../scripts/migration-plan");

test("BongaCash reconciliation migration matches the API table contract", () => {
  const match = migration.match(/CREATE TABLE IF NOT EXISTS bongacash_daily_reconciliation\s*\(([\s\S]*?)\n\);/i);
  assert.ok(match, "Migration must create the daily reconciliation table");
  for (const column of ["report_date", "registrations", "purchases", "earnings", "notes", "updated_by", "updated_at"]) {
    assert.match(match[1], new RegExp("\\b" + column + "\\b"));
  }
  assert.match(route, /INSERT INTO bongacash_daily_reconciliation/i);
  assert.match(route, /FROM bongacash_daily_reconciliation/i);
});

test("BongaCash reconciliation migration is registered for approved production startup", () => {
  assert.match(migration, /separate explicit approval/i);
  const productionPlan = getMigrationPlan("main");
  assert.ok(!productionPlan.some(item => item.version === "005_bongacash_daily_reconciliation"));
  const approvedProductionPlan = getMigrationPlan("main", { allowProductionReconciliation: true });
  assert.ok(approvedProductionPlan.some(item =>
    item.version === "005_bongacash_daily_reconciliation" &&
    item.file === "005_bongacash_daily_reconciliation.sql"
  ));
  assert.match(route, /Production migration 005 has not been applied/i);
  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS bongacash_daily_reconciliation/i);
});
