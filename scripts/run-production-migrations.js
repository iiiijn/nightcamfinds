const fs = require("fs");
const path = require("path");
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

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const version = "003_click_attribution_columns";
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (existing.rowCount) {
      console.log(`Production migration ${version} already applied`);
      return;
    }

    const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "003_click_attribution_columns.sql"), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await pool.query("COMMIT");
      console.log(`Production migration ${version} applied`);
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("Production migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
