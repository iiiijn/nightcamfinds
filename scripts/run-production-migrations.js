const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log("DATABASE_URL not configured; skipping production migrations");
  process.exit(0);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 2
});

const migrations = [
  { version: "003_click_attribution_columns", file: "003_click_attribution_columns.sql" },
  { version: "004_country_platform_routing", file: "004_country_platform_routing.sql" },
  { version: "005_bongacash_daily_reconciliation", file: "005_bongacash_daily_reconciliation.sql" }
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Serialize startup migration checks across overlapping Render instances.
    await client.query("SELECT pg_advisory_lock(741920260)");

    for (const migration of migrations) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [migration.version]
      );
      if (existing.rowCount) {
        console.log(`Production migration ${migration.version} already applied`);
        continue;
      }

      const sql = fs.readFileSync(
        path.join(__dirname, "..", "sql", migration.file),
        "utf8"
      );

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration.version]
        );
        await client.query("COMMIT");
        console.log(`Production migration ${migration.version} applied`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } catch (err) {
    console.error("Production migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(741920260)"); } catch {}
    client.release();
    await pool.end();
  }
})();
