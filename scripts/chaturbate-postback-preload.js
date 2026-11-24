const http = require("node:http");
const { Pool } = require("pg");
const crypto = require("node:crypto");

const originalCreateServer = http.createServer;
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5
}) : null;

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => { body += chunk; if (body.length > 1000000) req.destroy(); });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        if ((req.headers["content-type"] || "").includes("application/json")) return resolve(JSON.parse(body));
        return resolve(Object.fromEntries(new URLSearchParams(body).entries()));
      } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function clean(value, max = 1024) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function money(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function eventFrom(raw) {
  const clickId = clean(raw.click_id || raw.clickid || raw.subid || raw.sub_id || raw.sid, 128);
  const transactionId = clean(raw.transaction_id || raw.transactionid || raw.txid || raw.tid, 255);
  const payout = money(raw.payout);
  const amount = money(raw.amount);

  // Chaturbate's "Test this URL" probe can omit conversion-only fields.
  // Treat an incomplete probe as a connectivity test and never write revenue.
  if (!transactionId || payout == null) {
    return { ok: true, probe: true, event: { clickId, type: clean(raw.type || "test", 80).toLowerCase(), transactionId, payout } };
  }

  let type = clean(raw.type, 80).toLowerCase();
  const aliases = {
    signup: "revshare_signup-referral",
    purchase: "revshare_purchase",
    "revshare_signup": "revshare_signup-referral",
    "revshare_purchase": "revshare_purchase"
  };
  type = aliases[type] || type;
  const allowed = new Set([
    "tokens_signup-referral",
    "tokens_broadcaster-referral",
    "ppr_signup-referral",
    "ppr_broadcaster-referral",
    "revshare_signup-referral",
    "revshare_broadcaster-referral",
    "revshare_purchase",
    "revshare_webmaster-commission",
    "revshare_payout-adjustment"
  ]);

  if (!clickId) return { ok: false, status: 400, reason: "missing_click_id" };
  if (!allowed.has(type)) return { ok: false, status: 400, reason: "unsupported_event_type" };

  const currency = clean(raw.currency || "USD", 8).toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(currency)) return { ok: false, status: 400, reason: "invalid_currency" };
  return {
    ok: true,
    event: {
      clickId,
      transactionId,
      type,
      payout,
      amount,
      currency,
      token: clean(raw.token, 80),
      country: clean(raw.country || "UNKNOWN", 16).toUpperCase(),
      track: clean(raw.track, 255),
      source: clean(raw.source, 255),
      campaignId: clean(raw.campaign_id, 255),
      programId: clean(raw.program_id, 255),
      programName: clean(raw.program_name, 255),
      userId: clean(raw.user_id, 255),
      timestamp: clean(raw.timestamp || raw.date, 80),
      device: clean(raw.device, 80),
      language: clean(raw.language, 80),
      referral: clean(raw.referral, 2048),
      attempt: clean(raw.attempt, 32),
      region: clean(raw.region, 255)
    }
  };
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

async function ensureTables() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS cb_conversions (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    click_id VARCHAR(128) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    conversion_type VARCHAR(80) NOT NULL,
    payout NUMERIC(14,6) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    amount NUMERIC(14,6),
    token VARCHAR(80),
    country VARCHAR(16) DEFAULT 'UNKNOWN',
    track VARCHAR(255),
    source VARCHAR(255),
    campaign_id VARCHAR(255),
    program_id VARCHAR(255),
    program_name VARCHAR(255),
    user_id VARCHAR(255),
    conversion_timestamp VARCHAR(80),
    device VARCHAR(80),
    language VARCHAR(80),
    referral TEXT,
    attempt VARCHAR(32),
    region VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_received_at_idx ON cb_conversions(received_at)");
}

async function clickExists(clickId) {
  if (!pool) return false;
  const r = await pool.query(
    "SELECT 1 FROM cb_clicks WHERE click_id = $1 UNION ALL SELECT 1 FROM affiliate_clicks WHERE click_id = $1 AND platform = 'chaturbate' LIMIT 1",
    [clickId]
  );
  return r.rows.length > 0;
}

async function handlePostback(req, res, raw) {
  if (process.env.CB_POSTBACK_SECRET) {
    const supplied = clean(raw.token || raw.validation || raw.validation_token, 255);
    const expected = String(process.env.CB_POSTBACK_SECRET);
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return send(res, 403, { ok: false, reason: "validation_failed" });
    }
  }

  const parsed = eventFrom(raw);
  if (!parsed.ok) return send(res, parsed.status, parsed);
  if (parsed.probe) return send(res, 200, { ok: true, state: "test" });
  if (!pool) return send(res, 503, { ok: false, reason: "database_unavailable" });

  await ensureTables();
  const e = parsed.event;
  const duplicate = await pool.query("SELECT id FROM cb_conversions WHERE transaction_id = $1 LIMIT 1", [e.transactionId]);
  if (duplicate.rows.length) return send(res, 200, { ok: true, state: "duplicate", transaction_id: e.transactionId });

  const matched = await clickExists(e.clickId);
  if (!matched) {
    return send(res, 200, { ok: true, state: "unmatched", click_id: e.clickId });
  }

  await pool.query(`INSERT INTO cb_conversions
    (click_id, transaction_id, conversion_type, payout, currency, amount, token, country, track, source, campaign_id, program_id, program_name, user_id, conversion_timestamp, device, language, referral, attempt, region, payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)`, [
      e.clickId, e.transactionId, e.type, e.payout, e.currency, e.amount, e.token || null, e.country || "UNKNOWN",
      e.track || null, e.source || null, e.campaignId || null, e.programId || null, e.programName || null, e.userId || null,
      e.timestamp || null, e.device || null, e.language || null, e.referral || null, e.attempt || null, e.region || null,
      JSON.stringify(raw)
    ]);

  return send(res, 200, { ok: true, state: "confirmed", click_id: e.clickId, transaction_id: e.transactionId, payout: e.payout });
}

http.createServer = function patchedCreateServer(listener) {
  const wrapped = async (req, res) => {
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || "localhost"}`); } catch { return listener(req, res); }
    if (url.pathname === "/api/chaturbate/postback" && (req.method === "GET" || req.method === "POST")) {
      const body = req.method === "POST" ? await parseBody(req) : {};
      const raw = { ...Object.fromEntries(url.searchParams.entries()), ...body };
      try { return await handlePostback(req, res, raw); }
      catch (err) { console.error("Chaturbate postback failed:", err); return send(res, 500, { ok: false, reason: "postback_processing_failed" }); }
    }
    return listener(req, res);
  };
  return originalCreateServer(wrapped);
};

process.on("exit", () => { if (pool) pool.end().catch(() => {}); });
