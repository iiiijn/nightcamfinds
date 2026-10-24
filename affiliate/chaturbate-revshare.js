"use strict";
const crypto = require("crypto");

const REVSHARE_TYPES = new Set(["revshare_purchase", "revshare_payout-adjustment", "revshare_signup-referral"]);
function clean(value, max = 255) { return String(value ?? "").trim().slice(0, max); }
function parseAmount(value, name) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) { const e = new Error("Invalid " + name); e.statusCode = 400; throw e; }
  return n;
}
function buildTransactionId(params) {
  const supplied = clean(params.get("transaction_id"));
  if (supplied) return supplied;
  const raw = ["type","click_id","user_id","timestamp","amount","payout"].map(k => clean(params.get(k),120)).join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}
function normalize(params) {
  const type = clean(params.get("type"),100) || "unknown";
  const clickId = clean(params.get("click_id"),128) || null;
  const timestampRaw = clean(params.get("timestamp"),80);
  const parsedTimestamp = timestampRaw ? new Date(timestampRaw) : null;
  return { platform:"chaturbate", clickId, transactionId:buildTransactionId(params), conversionType:type,
    payout:parseAmount(params.get("payout"),"payout"), amount:parseAmount(params.get("amount"),"amount"),
    currency:clean(params.get("currency"),16).toUpperCase() || "USD", country:clean(params.get("country"),16).toUpperCase() || "UNKNOWN",
    eventTimestamp:parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime()) ? parsedTimestamp.toISOString() : null,
    track:clean(params.get("track"),120), source:clean(params.get("source"),120), programId:clean(params.get("program_id"),120), userId:clean(params.get("user_id"),120) };
}
async function ensureTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_conversions (
    id BIGSERIAL PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), platform VARCHAR(30) NOT NULL,
    click_id VARCHAR(128), transaction_id VARCHAR(255) NOT NULL, conversion_type VARCHAR(100) NOT NULL DEFAULT 'unknown',
    payout NUMERIC(18,6) NOT NULL DEFAULT 0, currency VARCHAR(16) NOT NULL DEFAULT 'USD', amount NUMERIC(18,6),
    country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', event_timestamp TIMESTAMPTZ, matched_click BOOLEAN NOT NULL DEFAULT FALSE,
    revenue_class VARCHAR(40) NOT NULL DEFAULT 'other', track VARCHAR(120), source VARCHAR(120), medium VARCHAR(80), campaign VARCHAR(120),
    program_id VARCHAR(120), user_id VARCHAR(120), raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(platform,transaction_id))`);
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS revenue_class VARCHAR(40) NOT NULL DEFAULT 'other'");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS track VARCHAR(120)");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS source VARCHAR(120)");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS medium VARCHAR(80)");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS campaign VARCHAR(120)");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS program_id VARCHAR(120)");
  await pool.query("ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS user_id VARCHAR(120)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_conversions_click_idx ON affiliate_conversions(click_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_conversions_received_idx ON affiliate_conversions(received_at)");
}
function revenueClass(type) {
  if (type === "revshare_purchase") return "revshare";
  if (type === "revshare_signup-referral") return "broadcaster_referral";
  if (type === "revshare_payout-adjustment") return "revshare_adjustment";
  return "other";
}
async function record(pool, c, rawPayload) {
  await ensureTables(pool);
  let matchedClick = false;
  if (c.clickId) { const m = await pool.query("SELECT 1 FROM affiliate_clicks WHERE click_id=$1 LIMIT 1",[c.clickId]).catch(()=>({rows:[]})); matchedClick = m.rows.length>0; }
  const result = await pool.query(`INSERT INTO affiliate_conversions
    (platform,click_id,transaction_id,conversion_type,payout,currency,amount,country,event_timestamp,matched_click,revenue_class,track,source,program_id,user_id,raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
    ON CONFLICT(platform,transaction_id) DO NOTHING RETURNING id`,
    [c.platform,c.clickId,c.transactionId,c.conversionType,c.payout,c.currency,c.amount,c.country,c.eventTimestamp,matchedClick,revenueClass(c.conversionType),c.track,c.source,c.programId,c.userId,JSON.stringify(rawPayload)]);
  return { inserted:result.rowCount>0, duplicate:result.rowCount===0, matchedClick, transactionId:c.transactionId, revenueClass:revenueClass(c.conversionType) };
}
async function handle(pool, params) { const c=normalize(params); return record(pool,c,Object.fromEntries(params.entries())); }
module.exports = { REVSHARE_TYPES, normalize, ensureTables, handle, revenueClass };