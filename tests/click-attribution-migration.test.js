const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../sql/003_click_attribution_columns.sql"),
  "utf8"
);

test("legacy click attribution migration safely skips when the retired clicks table is absent", () => {
  assert.match(migration, /to_regclass\('public\.clicks'\) IS NOT NULL/i);
  assert.match(migration, /ALTER TABLE public\.clicks ADD COLUMN IF NOT EXISTS traffic_medium/i);
  assert.match(migration, /ALTER TABLE public\.clicks ADD COLUMN IF NOT EXISTS traffic_campaign/i);
  assert.doesNotMatch(migration, /^ALTER TABLE clicks\b/im);
});

test("current affiliate click ledger keeps its canonical medium and campaign fields", () => {
  const currentSchema = fs.readFileSync(
    path.join(__dirname, "../sql/004_country_platform_routing.sql"),
    "utf8"
  );
  assert.match(currentSchema, /CREATE TABLE IF NOT EXISTS affiliate_clicks/i);
  assert.match(currentSchema, /\bmedium VARCHAR\(80\)/i);
  assert.match(currentSchema, /\bcampaign VARCHAR\(80\)/i);
});
