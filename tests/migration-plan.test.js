const test = require("node:test");
const assert = require("node:assert/strict");
const { getMigrationPlan } = require("../scripts/migration-plan");

test("production startup excludes staging-only and unapproved reconciliation migrations", () => {
  const plan = getMigrationPlan("main");
  assert.deepEqual(plan.map(item => item.version), [
    "006_traffic_quality_engagement",
    "007_engagement_event_integrity",
    "008_chaturbate_conversion_metadata",
    "009_click_source_evidence",
    "010_engagement_event_type_capacity"
  ]);
  assert.ok(plan.every(item => !["003_click_attribution_columns", "004_country_platform_routing", "005_bongacash_daily_reconciliation"].includes(item.version)));
});

test("production reconciliation migration requires explicit opt-in", () => {
  const plan = getMigrationPlan("main", { allowProductionReconciliation: true });
  assert.deepEqual(plan.map(item => item.version), [
    "005_bongacash_daily_reconciliation",
    "006_traffic_quality_engagement",
    "007_engagement_event_integrity",
    "008_chaturbate_conversion_metadata",
    "009_click_source_evidence"
  ]);
});

test("feature branch staging creates the affiliate schema before dependent migrations", () => {
  const plan = getMigrationPlan("feat/nightcamfinds-design-revshare");
  assert.deepEqual(plan.map(item => item.version), [
    "004_country_platform_routing",
    "005_bongacash_daily_reconciliation",
    "006_traffic_quality_engagement",
    "007_engagement_event_integrity",
    "008_chaturbate_conversion_metadata",
    "009_click_source_evidence"
  ]);
  assert.ok(plan.every(item => item.version !== "003_click_attribution_columns"));
});

test("migration plan references only known numbered SQL files", () => {
  for (const item of [
    ...getMigrationPlan("main"),
    ...getMigrationPlan("main", { allowProductionReconciliation: true }),
    ...getMigrationPlan("feat/nightcamfinds-design-revshare")
  ]) {
    assert.match(item.file, /^\d{3}_[a-z0-9_]+\.sql$/);
  }
});

test("production migration widens engagement event labels without rebuilding or deleting event rows", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const migration = fs.readFileSync(path.join(__dirname, "../sql/010_engagement_event_type_capacity.sql"), "utf8");
  assert.match(migration, /ALTER TABLE traffic_engagement_events/);
  assert.match(migration, /ALTER COLUMN event_type TYPE VARCHAR\\(48\\)/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
  const plan = getMigrationPlan("main");
  assert.equal(plan.at(-1).version, "010_engagement_event_type_capacity");
});
