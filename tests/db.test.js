import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../src/db/connect.js";

test("migrations persist core records and can roll back auth tables", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-"));
  const db = await openDatabase({ provider: "pglite", dataDir: dir, sqlDir: path.resolve("sql") });
  const { repo } = db;
  const routingSchema = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('country_platform_settings','routing_evidence_reviews','affiliate_clicks') ORDER BY table_name"
  );
  assert.deepEqual(routingSchema.rows.map((row) => row.table_name), [
    "affiliate_clicks", "country_platform_settings", "routing_evidence_reviews"
  ]);
  const attributionColumns = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliate_clicks'"
  );
  const attributionNames = new Set(attributionColumns.rows.map((row) => row.column_name));
  for (const column of ["page_type", "card_position", "referrer", "utm_source", "utm_campaign", "landing_path", "is_bot"]) {
    assert.ok(attributionNames.has(column), `expected attribution column: ${column}`);
  }
  await db.query(
    "INSERT INTO country_platform_settings (country_code, preferred_platform, status, hypothesis) VALUES ('DE', 'bongacams', 'hypothesis', 'Unverified assumption')"
  );
  const [setting] = (await db.query("SELECT country_code, preferred_platform, status FROM country_platform_settings WHERE country_code='DE'")).rows;
  assert.deepEqual(setting, { country_code: "DE", preferred_platform: "bongacams", status: "hypothesis" });
  await repo.upsertProvider({ id: "chaturbate", name: "Chaturbate", status: "VERIFIED", campaign: "C6yxN", enabled: true });
  await repo.saveCampaign({ id: "c1", providerId: "chaturbate", name: "cb", program: "REQUIRES_CONFIRMATION", externalCampaign: "C6yxN", status: "CONFIGURED" });
  await repo.saveLink({ id: "l1", providerId: "chaturbate", campaign: "C6yxN", program: "REQUIRES_CONFIRMATION", destinationType: "room", status: "Unverified", verificationStatus: "REQUIRES_VERIFICATION" });
  await repo.upsertRoom({ id: "chaturbate:ada", provider: "chaturbate", externalUsername: "ada", displayName: "ada", isLive: true, isHd: false, isNew: false, freshness: "FRESH", tags: [], languages: [] });
  await repo.insertClick({ clickId: "click1", roomId: "chaturbate:ada", provider: "chaturbate", campaign: "C6yxN" });
  await repo.insertPostback({ id: "p1", provider: "chaturbate", payload: { transaction_id: "t1" }, status: "accepted", clickId: "click1" });
  await repo.insertConversion({ id: "v1", provider: "chaturbate", clickId: "click1", transactionId: "t1", amount: 1, currency: "USD", state: "Confirmed" });
  await repo.saveConfig({ id: "cfg1", key: "runtime", value: { ok: true }, author: "owner" });
  await repo.audit({ id: "a1", actor: "owner", action: "test", detail: { ok: true } });
  assert.equal((await repo.providers()).length, 1);
  assert.equal((await repo.campaigns()).length, 1);
  assert.equal((await repo.links()).length, 1);
  assert.equal((await repo.rooms()).length, 1);
  assert.equal((await repo.clicks()).length, 1);
  assert.equal((await repo.conversions()).length, 1);
  assert.equal((await repo.postbacks()).length, 1);
  assert.equal((await repo.configs("runtime")).length, 1);
  assert.equal((await repo.audits()).length, 1);
  await db.close();
});
