const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../sql/004_country_platform_routing.sql"), "utf8");
const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");

function tableDefinition(tableName) {
  const match = migration.match(new RegExp(
    String.raw`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  ));
  assert.ok(match, `Migration must create ${tableName}`);
  return match[1];
}

function columnsFromDefinition(definition) {
  return new Set(
    definition.split("\n")
      .map(line => line.trim())
      .filter(line => line && !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)\\b/i.test(line))
      .map(line => line.match(/^([a-z_][a-z0-9_]*)\\s+/i)?.[1])
      .filter(Boolean)
  );
}

test("country-platform migration schema matches API query contracts", () => {
  const settingsColumns = columnsFromDefinition(tableDefinition("country_platform_settings"));
  const requiredSettingsColumns = [
    "country_code", "preferred_platform", "status", "hypothesis",
    "approved_at", "updated_by", "updated_at"
  ];
  for (const column of requiredSettingsColumns) {
    assert.ok(settingsColumns.has(column), `country_platform_settings is missing ${column}`);
  }

  const getQuery = route.match(/SELECT country_code, preferred_platform, status, hypothesis, approved_at, updated_at FROM country_platform_settings/i);
  assert.ok(getQuery, "GET country-platform settings query must remain aligned with the migration");

  const insertMatch = route.match(/INSERT INTO country_platform_settings\\s*\\(([^)]+)\\)/i);
  assert.ok(insertMatch, "POST country-platform settings query must insert into country_platform_settings");
  for (const column of insertMatch[1].split(",").map(value => value.trim())) {
    assert.ok(settingsColumns.has(column), `API inserts ${column}, but the migration does not define it`);
  }
});

test("country-platform migration includes attribution columns used for routing evidence", () => {
  const clickColumns = columnsFromDefinition(tableDefinition("affiliate_clicks"));
  const alterMatch = migration.match(/ALTER TABLE affiliate_clicks([\\s\\S]*?);/i);
  assert.ok(alterMatch, "Migration must add attribution columns to affiliate_clicks");
  const addedColumns = [...alterMatch[1].matchAll(/ADD COLUMN IF NOT EXISTS ([a-z_][a-z0-9_]*)/gi)].map(match => match[1]);
  for (const column of addedColumns) clickColumns.add(column);

  for (const column of [
    "page_type", "card_position", "referrer", "utm_source", "utm_medium",
    "utm_campaign", "utm_content", "utm_term", "landing_path", "engaged_at",
    "is_bot", "bot_reason"
  ]) {
    assert.ok(clickColumns.has(column), `affiliate_clicks is missing attribution column ${column}`);
  }

  const evidenceColumns = columnsFromDefinition(tableDefinition("routing_evidence_reviews"));
  for (const column of [
    "country_code", "platform", "window_start", "window_end", "clicks",
    "engaged_clicks", "verified_signups", "verified_payers", "revenue", "epc",
    "reviewed_at", "decision", "created_at"
  ]) {
    assert.ok(evidenceColumns.has(column), `routing_evidence_reviews is missing ${column}`);
  }
});

test("country-platform migration preserves safety constraints and remains opt-in", () => {
  assert.match(migration, /CHECK\\s*\\(status IN \\('hypothesis', 'approved', 'evidence_review'\\)\\)/i);
  assert.match(migration, /CHECK\\s*\\(preferred_platform IS NULL OR preferred_platform IN \\('chaturbate', 'bongacams'\\)\\)/i);
  assert.match(migration, /status <> 'approved' OR \\(preferred_platform IS NOT NULL AND approved_at IS NOT NULL\\)/i);
  assert.match(migration, /CHECK\\s*\\(window_end >= window_start\\)/i);
  assert.match(migration, /affiliate_clicks_country_platform_time_idx/i);
  assert.match(migration, /routing_evidence_country_platform_idx/i);
  assert.match(migration, /intentionally not wired into production startup/i);
});
