const crypto = require("crypto");

function clean(value, fallback = "", max = 255) {
  const v = String(value ?? "").trim().slice(0, max);
  return v || fallback;
}

function number(value) {
  const n = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function first(params, names, fallback = "") {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

function normalizeType(value) {
  const v = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (/(purchase|sale|deposit|revshare|ftd)/.test(v)) return "purchase";
  if (/(signup|registration|register|lead)/.test(v)) return "registration";
  if (/(refund|chargeback|reversal)/.test(v)) return "refund";
  return v || "unknown";
}

function verifySecret(req, params) {
  const expected = process.env.BONGACASH_POSTBACK_SECRET || "";
  if (!expected) return false;
  const supplied = first(params, ["key", "token", "secret", "k", "hash"]);
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ensureTable(pool) {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS bonga_conversions (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      click_id VARCHAR(255),
      transaction_id VARCHAR(255),
      conversion_type VARCHAR(40) NOT NULL DEFAULT 'unknown',
      payout NUMERIC(18,6) NOT NULL DEFAULT 0,
      amount NUMERIC(18,6) NOT NULL DEFAULT 0,
      currency VARCHAR(16),
      country VARCHAR(16),
      track VARCHAR(255),
      source VARCHAR(255),
      campaign_id VARCHAR(255),
      user_id VARCHAR(255),
      event_timestamp VARCHAR(100),
      status VARCHAR(40),
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(transaction_id)
    )
  `).then(() => pool.query("CREATE INDEX IF NOT EXISTS bonga_conversions_received_at_idx ON bonga_conversions(received_at)"));
}

async function save(pool, params) {
  await ensureTable(pool);
  const clickId = first(params, ["click_id", "clickid", "subid", "sub_id", "sid", "s1", "ref", "track_id"]);
  const transactionId = first(params, ["transaction_id", "transactionid", "txid", "tid", "action_id", "id"], `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`);
  const type = normalizeType(first(params, ["type", "event", "event_type", "conversion_type", "action", "status"]));
  const payout = number(first(params, ["payout", "commission", "earnings", "revenue", "profit"]));
  const amount = number(first(params, ["amount", "purchase_amount", "sale_amount", "spend"]));
  const currency = clean(first(params, ["currency", "currency_code"], "USD"), "USD", 16);
  const country = clean(first(params, ["country", "country_code", "geo"], "UNKNOWN"), "UNKNOWN", 16).toUpperCase();
  const track = clean(first(params, ["track", "tracking", "placement", "subid2"]), "", 255);
  const source = clean(first(params, ["source", "traffic_source", "utm_source", "subid1"]), "", 255);
  const campaign = clean(first(params, ["campaign", "campaign_id", "subid3"]), "", 255);
  const userId = clean(first(params, ["user_id", "userid", "member_id", "customer_id"]), "", 255);
  const timestamp = clean(first(params, ["timestamp", "event_timestamp", "date", "datetime"]), "", 100);
  const status = clean(first(params, ["status", "state"]), "", 40);

  await pool.query(`
    INSERT INTO bonga_conversions
      (click_id,transaction_id,conversion_type,payout,amount,currency,country,track,source,campaign_id,user_id,event_timestamp,status,raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
    ON CONFLICT (transaction_id) DO UPDATE SET
      payout = EXCLUDED.payout,
      amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      conversion_type = EXCLUDED.conversion_type,
      country = EXCLUDED.country,
      track = EXCLUDED.track,
      source = EXCLUDED.source,
      campaign_id = EXCLUDED.campaign_id,
      user_id = EXCLUDED.user_id,
      event_timestamp = EXCLUDED.event_timestamp,
      status = EXCLUDED.status,
      raw_payload = EXCLUDED.raw_payload
  `, [clickId, transactionId, type, payout, amount, currency, country, track, source, campaign, userId, timestamp, status, JSON.stringify(Object.fromEntries(params.entries()))]);
  return { ok: true, type, transactionId };
}

async function stats(pool, from, to) {
  await ensureTable(pool);
  const params = [];
  const where = [];
  if (from) { params.push(`${from}T00:00:00.000Z`); where.push(`received_at >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); where.push(`received_at <= $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const row = (await pool.query(`SELECT
    COUNT(*) FILTER (WHERE conversion_type='registration')::int AS registrations,
    COUNT(*) FILTER (WHERE conversion_type='purchase')::int AS purchases,
    COALESCE(SUM(payout) FILTER (WHERE conversion_type='purchase'),0)::numeric AS earnings,
    COALESCE(SUM(amount) FILTER (WHERE conversion_type='purchase'),0)::numeric AS spend
    FROM bonga_conversions ${clause}`, params)).rows[0];
  const byCountry = await pool.query(`SELECT COALESCE(NULLIF(country,''),'UNKNOWN') AS name, COUNT(*)::int AS conversions, COALESCE(SUM(payout),0)::numeric AS earnings FROM bonga_conversions ${clause} GROUP BY 1 ORDER BY earnings DESC, conversions DESC`, params);
  const bySource = await pool.query(`SELECT COALESCE(NULLIF(source,''),'direct') AS name, COUNT(*)::int AS conversions, COALESCE(SUM(payout),0)::numeric AS earnings FROM bonga_conversions ${clause} GROUP BY 1 ORDER BY earnings DESC, conversions DESC`, params);
  return {
    registrations: Number(row?.registrations || 0),
    purchases: Number(row?.purchases || 0),
    earnings: Number(row?.earnings || 0),
    spend: Number(row?.spend || 0),
    byCountry: byCountry.rows.map(r => ({name:r.name, conversions:Number(r.conversions), earnings:Number(r.earnings)})),
    bySource: bySource.rows.map(r => ({name:r.name, conversions:Number(r.conversions), earnings:Number(r.earnings)}))
  };
}

module.exports = { ensureTable, save, stats, verifySecret };
