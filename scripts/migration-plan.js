const PRODUCTION_BRANCH = "main";

const PRODUCTION_MIGRATIONS = [
  { version: "005_bongacash_daily_reconciliation", file: "005_bongacash_daily_reconciliation.sql" },
  { version: "006_traffic_quality_engagement", file: "006_traffic_quality_engagement.sql" }
];

const STAGING_MIGRATIONS = [
  { version: "004_country_platform_routing", file: "004_country_platform_routing.sql" },
  { version: "005_bongacash_daily_reconciliation", file: "005_bongacash_daily_reconciliation.sql" },
  { version: "006_traffic_quality_engagement", file: "006_traffic_quality_engagement.sql" }
];

function getMigrationPlan(branch) {
  return branch === PRODUCTION_BRANCH
    ? PRODUCTION_MIGRATIONS
    : STAGING_MIGRATIONS;
}

module.exports = { getMigrationPlan };
