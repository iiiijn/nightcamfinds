const test = require("node:test");
const assert = require("node:assert/strict");
const { getMigrationPlan } = require("../scripts/migration-plan");

test("production startup only runs the approved traffic engagement migration", () => {
  const plan = getMigrationPlan("main");
  assert.deepEqual(plan.map(item => item.version), [
    "006_traffic_quality_engagement"
  ]);
  assert.ok(plan.every(item => !["003_click_attribution_columns", "004_country_platform_routing", "005_bongacash_daily_reconciliation"].includes(item.version)));
});

test("feature branch staging creates the affiliate schema before engagement tables", () => {
  const plan = getMigrationPlan("feat/nightcamfinds-design-revshare");
  assert.deepEqual(plan.map(item => item.version), [
    "004_country_platform_routing",
    "006_traffic_quality_engagement"
  ]);
  assert.ok(plan.every(item => !["003_click_attribution_columns", "005_bongacash_daily_reconciliation"].includes(item.version)));
});

test("staging migration plan is idempotent and contains only known SQL files", () => {
  for (const item of getMigrationPlan("feat/nightcamfinds-design-revshare")) {
    assert.match(item.file, /^\d{3}_[a-z0-9_]+\.sql$/);
  }
});
