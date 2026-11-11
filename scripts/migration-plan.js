const PRODUCTION_BRANCH = "main";

const PRODUCTION_MIGRATIONS = [
  { version: "006_traffic_quality_engagement", file: "006_traffic_quality_engagement.sql" },
  { version: "007_engagement_event_integrity", file: "007_engagement_event_integrity.sql" },
  { version: "008_chaturbate_conversion_metadata", file: "008_chaturbate_conversion_metadata.sql" },
  { version: "009_click_source_evidence", file: "009_click_source_evidence.sql" }
];

const PRODUCTION_RECONCILIATION_MIGRATION = {
  version: "005_bongacash_daily_reconciliation",
  file: "005_bongacash_daily_reconciliation.sql"
};

const STAGING_MIGRATIONS = [
  { version: "004_country_platform_routing", file: "004_country_platform_routing.sql" },
  PRODUCTION_RECONCILIATION_MIGRATION,
  { version: "006_traffic_quality_engagement", file: "006_traffic_quality_engagement.sql" },
  { version: "007_engagement_event_integrity", file: "007_engagement_event_integrity.sql" },
  { version: "008_chaturbate_conversion_metadata", file: "008_chaturbate_conversion_metadata.sql" }
];

function getMigrationPlan(branch, options = {}) {
  if (branch !== PRODUCTION_BRANCH) return STAGING_MIGRATIONS;
  return options.allowProductionReconciliation
    ? [PRODUCTION_RECONCILIATION_MIGRATION, ...PRODUCTION_MIGRATIONS]
    : PRODUCTION_MIGRATIONS;
}

module.exports = { getMigrationPlan };
