"use strict";

function normalizeConversion(input = {}) {
  const clean = (v, fallback = "", max = 255) => String(v ?? "").trim().slice(0, max) || fallback;
  const numeric = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v); return Number.isFinite(n) ? n : null;
  };
  const transactionId = clean(input.transaction_id || input.transactionId);
  if (!transactionId) { const e = new Error("transaction_id is required"); e.statusCode = 400; throw e; }
  const rawType = clean(input.type || input.conversion_type || input.conversionType, "unknown", 100);
  const payout = numeric(input.payout); const amount = numeric(input.amount);
  const knownRevshare = rawType === "revshare_purchase";
  const isAdjustment = rawType === "revshare_payout-adjustment";
  const broadcasterReferral = /broadcaster|broadcaster-referral/i.test(rawType);
  const affiliateReferral = /affiliate|referral-income/i.test(rawType);
  return {
    platform: clean(input.platform, "chaturbate", 30).toLowerCase(),
    clickId: clean(input.click_id || input.clickId, "", 128) || null,
    transactionId, conversionType: rawType, payout: payout ?? 0, currency: clean(input.currency, "USD", 16).toUpperCase(),
    amount, country: clean(input.country, "UNKNOWN", 16).toUpperCase(),
    eventTimestamp: clean(input.timestamp || input.event_timestamp || input.eventTimestamp, "", 100) || null,
    track: clean(input.track, "", 255), source: clean(input.source, "", 255),
    programId: clean(input.program_id || input.programId, "", 255), userId: clean(input.user_id || input.userId, "", 255),
    revenueClass: knownRevshare ? "revshare" : isAdjustment ? "revshare_adjustment" : broadcasterReferral ? "broadcaster_referral" : affiliateReferral ? "affiliate_referral" : "other",
    rawPayload: input
  };
}

async function ensureRevenueSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS affiliate_conversions (
      id BIGSERIAL PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), platform VARCHAR(30) NOT NULL,
      click_id VARCHAR(128), transaction_id VARCHAR(255) NOT NULL, conversion_type VARCHAR(100) NOT NULL DEFAULT 'unknown',
      payout NUMERIC(18,6) NOT NULL DEFAULT 0, currency VARCHAR(16) NOT NULL DEFAULT 'USD', amount NUMERIC(18,6),
      country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', event_timestamp VARCHAR(100), track VARCHAR(255), source VARCHAR(255),
      program_id VARCHAR(255), user_id VARCHAR(255), revenue_class VARCHAR(40) NOT NULL DEFAULT 'other',
      matched_click BOOLEAN NOT NULL DEFAULT FALSE, raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(platform, transaction_id))`);
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_conversions_click_id_idx ON affiliate_conversions(click_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_conversions_received_at_idx ON affiliate_conversions(received_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_conversions_revenue_class_idx ON affiliate_conversions(revenue_class)");
}

async function saveConversion(pool, input) {
  const c = normalizeConversion(input); await ensureRevenueSchema(pool);
  const match = c.clickId ? await pool.query("SELECT 1 FROM affiliate_clicks WHERE click_id=$1 LIMIT 1", [c.clickId]).catch(() => ({ rows: [] })) : { rows: [] };
  const matched = match.rows.length > 0;
  const result = await pool.query(`INSERT INTO affiliate_conversions
    (platform,click_id,transaction_id,conversion_type,payout,currency,amount,country,event_timestamp,track,source,program_id,user_id,revenue_class,matched_click,raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
    ON CONFLICT(platform,transaction_id) DO NOTHING RETURNING id`,
    [c.platform,c.clickId,c.transactionId,c.conversionType,c.payout,c.currency,c.amount,c.country,c.eventTimestamp,c.track,c.source,c.programId,c.userId,c.revenueClass,matched,JSON.stringify(c.rawPayload)]);
  return { ok: true, duplicate: result.rowCount === 0, matched, revenueClass: c.revenueClass };
}

async function revenueSummary(pool, filters = {}) {
  await ensureRevenueSchema(pool); const params = []; const clauses = [];
  const add = (value, sql) => { params.push(value); clauses.push(sql.replace("?", "$" + params.length)); };
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) add(filters.from, "received_at >= ?::date");
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) add(filters.to, "received_at < (?::date + INTERVAL '1 day')");
  if (filters.platform && ["chaturbate","bongacams"].includes(filters.platform)) add(filters.platform, "platform = ?");
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const summary = (await pool.query(`SELECT COUNT(*)::int AS events, COUNT(*) FILTER (WHERE matched_click)::int AS matched_events,
    COUNT(*) FILTER (WHERE revenue_class='revshare')::int AS revshare_events,
    COUNT(*) FILTER (WHERE revenue_class='broadcaster_referral')::int AS broadcaster_referral_events,
    COUNT(*) FILTER (WHERE revenue_class='affiliate_referral')::int AS affiliate_referral_events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class='revshare'),0)::numeric AS revshare_revenue,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class='broadcaster_referral'),0)::numeric AS broadcaster_referral_revenue,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class='affiliate_referral'),0)::numeric AS affiliate_referral_revenue,
    COALESCE(SUM(payout),0)::numeric AS total_revenue FROM affiliate_conversions ${where}`, params)).rows[0] || {};
  const byCountry = (await pool.query(`SELECT country, COUNT(*)::int AS events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class='revshare'),0)::numeric AS revshare_revenue
    FROM affiliate_conversions ${where} GROUP BY country
    ORDER BY SUM(payout) FILTER (WHERE revenue_class='revshare') DESC NULLS LAST LIMIT 50`, params)).rows;
  const bySource = (await pool.query(`SELECT COALESCE(NULLIF(source,''),'unknown') AS source, COUNT(*)::int AS events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class='revshare'),0)::numeric AS revshare_revenue
    FROM affiliate_conversions ${where} GROUP BY source
    ORDER BY SUM(payout) FILTER (WHERE revenue_class='revshare') DESC NULLS LAST LIMIT 50`, params)).rows;
  return { events:Number(summary.events || 0), matchedEvents:Number(summary.matched_events || 0),
    unmatchedEvents:Number(summary.events || 0)-Number(summary.matched_events || 0), revshareEvents:Number(summary.revshare_events || 0),
    broadcasterReferralEvents:Number(summary.broadcaster_referral_events || 0), affiliateReferralEvents:Number(summary.affiliate_referral_events || 0),
    revshareRevenue:Number(summary.revshare_revenue || 0), broadcasterReferralRevenue:Number(summary.broadcaster_referral_revenue || 0),
    affiliateReferralRevenue:Number(summary.affiliate_referral_revenue || 0), totalRevenue:Number(summary.total_revenue || 0),
    byCountry:byCountry.map(r=>({country:r.country,events:Number(r.events),revshareRevenue:Number(r.revshare_revenue)})),
    bySource:bySource.map(r=>({source:r.source,events:Number(r.events),revshareRevenue:Number(r.revshare_revenue)})) };
}

module.exports = { normalizeConversion, ensureRevenueSchema, saveConversion, revenueSummary };