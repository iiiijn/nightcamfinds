import path from "node:path";
import { createRepository, migrate } from "./repository.js";

export async function openDatabase({ provider, databaseUrl, dataDir, sqlDir }) {
  if (provider === "json") {
    throw new Error("JSON store is not a database provider. Set DATABASE_PROVIDER=postgres or pglite.");
  }
  if (provider === "postgres") {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for postgres");
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const db = {
      async query(text, params) {
        return pool.query(text, params);
      }
    };
    await migrate(db, sqlDir);
    return { repo: createRepository(db), kind: "postgres", query: db.query, async close() { await pool.end(); } };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(path.join(dataDir, "pglite"));
  const db = {
    async query(text, params) {
      return pg.query(text, params);
    }
  };
  await migrate(db, sqlDir);
  return { repo: createRepository(db), kind: "pglite", query: db.query, async close() { await pg.close(); } };
}
