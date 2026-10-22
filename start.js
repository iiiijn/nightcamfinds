const http = require("http");
const crypto = require("crypto");

const originalCreateServer = http.createServer;
const databaseUrl = process.env.DATABASE_URL;
let pool = null;
try {
  if (databaseUrl) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5
    });
  }
} catch (err) {
  console.warn("Chaturbate postback database unavailable:", err.message);
}

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.DASHBOARD_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const STATS_KEY = process.env.STATS_KEY || "";
const SESSION_TTL = 12 * 60 * 60 * 1000;
const loginAttempts = new Map();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function clientAddress(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(username) {
  const payload = `${username}.${Date.now()}.${crypto.randomBytes(18).toString("hex")}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function validSession(req) {
  if (!SESSION_SECRET) return false;
  const token = parseCookies(req).ncf_session;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [username, issuedAt, nonce, signature] = parts;
  const payload = `${username}.${issuedAt}.${nonce}`;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const issued = Number(issuedAt);
  if (!safeEqual(signature, expected) || username !== ADMIN_USER || !Number.isFinite(issued) || Date.now() - issued > SESSION_TTL || Date.now() < issued - 60000) return false;
  return true;
}

function cookieHeader(value, maxAge = SESSION_TTL / 1000) {
  return `ncf_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(""));
  });
}

async function handleAuth(req, res, incoming) {
  if (incoming.pathname === "/api/auth/me") return json(res, 200, { authenticated: validSession(req), username: validSession(req) ? ADMIN_USER : null });
  if (incoming.pathname === "/api/auth/logout") {
    res.writeHead(204, { "Set-Cookie": cookieHeader("", 0), "Cache-Control": "no-store" });
    return res.end();
  }
  if (incoming.pathname !== "/api/auth/login" || req.method !== "POST") return false;
  const ip = clientAddress(req);
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (recent.length >= 8) return json(res, 429, { error: "Too many login attempts. Try again later." }, { "Retry-After": "900" });
  recent.push(now);
  loginAttempts.set(ip, recent);
  let data = {};
  try { data = JSON.parse(await readBody(req) || "{}"); } catch { return json(res, 400, { error: "Invalid request." }); }
  if (!ADMIN_PASSWORD || !SESSION_SECRET) return json(res, 503, { error: "Dashboard authentication is not configured on the server." });
  if (!safeEqual(data.username || "", ADMIN_USER) || !safeEqual(data.password || "", ADMIN_PASSWORD)) return json(res, 401, { error: "Incorrect username or password." });
  loginAttempts.delete(ip);
  return json(res, 200, { authenticated: true, username: ADMIN_USER }, { "Set-Cookie": cookieHeader(sessionCookie(ADMIN_USER)) });
}

async function ensurePostbackTables() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id BIGSERIAL PRIMARY KEY,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
      category VARCHAR(40) NOT NULL DEFAULT 'unknown',
      source VARCHAR(40) NOT NULL DEFAULT 'direct',
      campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
      placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
      platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'
    )
  `);
  await pool.query("ALTER TABLE affiliate_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_click_id_idx ON affiliate_clicks(click_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_country_idx ON affiliate_clicks(country)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_clicked_at_idx ON affiliate_clicks(clicked_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_platform_idx ON affiliate_clicks(platform)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cb_clicks (
      click_id VARCHAR(128) PRIMARY KEY,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country VARCHAR(16) NOT NULL,
      category VARCHAR(40) NOT NULL,
      source VARCHAR(40) NOT NULL,
      campaign VARCHAR(80) NOT NULL,
      placement VARCHAR(80) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cb_conversions (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      click_id VARCHAR(128),
      transaction_id VARCHAR(255),
      conversion_type VARCHAR(100),
      payout NUMERIC(18,6) DEFAULT 0,
      currency VARCHAR(16),
      amount NUMERIC(18,6),
      country VARCHAR(16),
      track VARCHAR(255),
      source VARCHAR(255),
      campaign_id VARCHAR(255),
      program_id VARCHAR(255),
      user_id VARCHAR(255),
      event_timestamp VARCHAR(100),
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(transaction_id)
    )
  `);
  await pool.query("ALTER TABLE cb_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("ALTER TABLE cb_conversions ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id)");
}

function clean(value, fallback = "unknown", max = 255) {
  const v = String(value || "").trim().slice(0, max);
  return v || fallback;
}

function country(req) {
  for (const value of [req.headers["cf-ipcountry"], req.headers["x-vercel-ip-country"], req.headers["cloudfront-viewer-country"], req.headers["x-country-code"]]) {
    const iso = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso;
  }
  return "UNKNOWN";
}

function makeClickId() {
  return `ncf_${Date.now().toString(36)}_${crypto.randomBytes(9).toString("hex")}`;
}

async function saveClick(click) {
  if (!pool) return;
  try {
    await ensurePostbackTables();
    await pool.query(
      `INSERT INTO affiliate_clicks (click_id,country,category,source,campaign,placement,platform,medium,content,device)
       VALUES ($1,$2,$3,$4,$5,$6,'chaturbate',$7,$8,$9)`,
      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement, click.medium || "unknown", click.content || "", click.device || "unknown"]
    );
    await pool.query(
      `INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING`,
      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement]
    );
  } catch (err) {
    console.error("Affiliate click tracking failed:", err.message);
  }
}

async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  try {
    await ensurePostbackTables();
    const payout = Number.parseFloat(params.payout);
    const amount = Number.parseFloat(params.amount);
    await pool.query(
      `INSERT INTO cb_conversions
       (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [
        clean(params.click_id, "", 128),
        clean(params.transaction_id, "", 255),
        clean(params.type, "unknown", 100),
        Number.isFinite(payout) ? payout : 0,
        clean(params.currency, "", 16),
        Number.isFinite(amount) ? amount : null,
        clean(params.country, "UNKNOWN", 2).toUpperCase(),
        clean(params.track, "", 255),
        clean(params.source, "", 255),
        clean(params.campaign_id, "", 255),
        clean(params.program_id, "", 255),
        clean(params.user_id, "", 255),
        clean(params.timestamp, "", 100),
        JSON.stringify(params)
      ]
    );
  } catch (err) {
    console.error("Chaturbate postback save failed:", err.message);
    throw err;
  }
}

async function revshareStats(incoming) {
  if (!pool) return { persistent: false, clicks: 0, registrations: 0, purchases: 0, earnings: 0, tokenSpend: 0, bySource: [], byCampaign: [], byCountry: [], byTrack: [], recent: [] };
  await ensurePostbackTables();
  const range = incoming.searchParams.get("range") || "all";
  const from = incoming.searchParams.get("from");
  const to = incoming.searchParams.get("to");
  const conditions = [];
  const params = [];
  if (from) { params.push(`${from}T00:00:00.000Z`); conditions.push(`received_at >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); conditions.push(`received_at <= $${params.length}`); }
  if (!from && !to && range !== "all") {
    const days = Math.max(1, Math.min(3650, Number(range) || 7));
    params.push(days);
    conditions.push(`received_at >= NOW() - ($${params.length}::int * INTERVAL '1 day')`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const clickConditions = [];
  const clickParams = [];
  if (from) { clickParams.push(`${from}T00:00:00.000Z`); clickConditions.push(`clicked_at >= $${clickParams.length}`); }
  if (to) { clickParams.push(`${to}T23:59:59.999Z`); clickConditions.push(`clicked_at <= $${clickParams.length}`); }
  if (!from && !to && range !== "all") {
    const days = Math.max(1, Math.min(3650, Number(range) || 7));
    clickParams.push(days);
    clickConditions.push(`clicked_at >= NOW() - ($${clickParams.length}::int * INTERVAL '1 day')`);
  }
  const clickWhere = clickConditions.length ? `WHERE ${clickConditions.join(" AND ")}` : "";
  const revTypes = `conversion_type IN ('revshare_purchase','revshare_payout-adjustment')`;
  const signupType = `conversion_type = 'revshare_signup-referral'`;
  const purchaseType = `conversion_type = 'revshare_purchase'`;
  const sumRows = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE ${signupType})::int AS registrations,
      COUNT(*) FILTER (WHERE ${purchaseType})::int AS purchases,
      COALESCE(SUM(payout) FILTER (WHERE ${revTypes}),0)::numeric AS earnings,
      COALESCE(SUM(amount) FILTER (WHERE ${purchaseType}),0)::numeric AS token_spend
    FROM cb_conversions ${where}`, params);
  const clickRows = await pool.query(`SELECT COUNT(*)::int AS clicks FROM cb_clicks ${clickWhere}`, clickParams);
  const grouped = async (dimension, source = "conversion") => {
    const clickFields = { source: "source", campaign: "campaign", country: "country", track: "placement" };
    const conversionFields = {
      source: "COALESCE(NULLIF(cc.source,''), NULLIF(c.source,''), 'direct')",
      campaign: "COALESCE(NULLIF(cc.campaign,''), NULLIF(c.campaign_id,''), 'unknown')",
      country: "COALESCE(NULLIF(cc.country,''), NULLIF(c.country,''), 'UNKNOWN')",
      track: "COALESCE(NULLIF(cc.placement,''), NULLIF(c.track,''), 'unknown')"
    };
    if (source === "click") {
      const field = clickFields[dimension];
      const rows = await pool.query(`SELECT COALESCE(NULLIF(${field},''),'unknown') AS name, COUNT(*)::int AS clicks FROM cb_clicks ${clickWhere} GROUP BY 1 ORDER BY clicks DESC`, clickParams);
      return rows.rows.map(r => ({ name: r.name, clicks: r.clicks, registrations: 0, purchases: 0, earnings: 0 }));
    }
    const field = conversionFields[dimension];
    const rows = await pool.query(`SELECT ${field} AS name,
        COUNT(*) FILTER (WHERE c.conversion_type = 'revshare_signup-referral')::int AS registrations,
        COUNT(*) FILTER (WHERE c.conversion_type = 'revshare_purchase')::int AS purchases,
        COALESCE(SUM(c.payout) FILTER (WHERE c.conversion_type IN ('revshare_purchase','revshare_payout-adjustment')),0)::numeric AS earnings
      FROM cb_conversions c LEFT JOIN cb_clicks cc ON cc.click_id = c.click_id ${where} GROUP BY 1 ORDER BY earnings DESC, purchases DESC`, params);
    return rows.rows.map(r => ({ name: r.name, clicks: 0, registrations: r.registrations, purchases: r.purchases, earnings: Number(r.earnings) || 0 }));
  };
  const sourceClicks = await grouped("source", "click");
  const sourceConv = await grouped("source", "conversion");
  const campaignClicks = await grouped("campaign", "click");
  const campaignConv = await grouped("campaign", "conversion");
  const countryClicks = await grouped("country", "click");
  const countryConv = await grouped("country", "conversion");
  const trackClicks = await grouped("track", "click");
  const trackConv = await grouped("track", "conversion");
  const merge = (clickRows, convRows) => {
    const map = new Map();
    for (const row of clickRows) map.set(row.name, { ...row });
    for (const row of convRows) {
      const cur = map.get(row.name) || { name: row.name, clicks: 0, registrations: 0, purchases: 0, earnings: 0 };
      cur.registrations += row.registrations; cur.purchases += row.purchases; cur.earnings += row.earnings; map.set(row.name, cur);
    }
    return [...map.values()].sort((a,b) => b.earnings - a.earnings || b.clicks - a.clicks);
  };
  const recent = await pool.query(`SELECT received_at, conversion_type, payout, amount, currency, country, track, source, click_id FROM cb_conversions ${where} ORDER BY received_at DESC LIMIT 100`, params);
  return {
    persistent: true,
    range,
    clicks: Number(clickRows.rows[0]?.clicks || 0),
    registrations: Number(sumRows.rows[0]?.registrations || 0),
    purchases: Number(sumRows.rows[0]?.purchases || 0),
    earnings: Number(sumRows.rows[0]?.earnings || 0),
    tokenSpend: Number(sumRows.rows[0]?.token_spend || 0),
    bySource: merge(sourceClicks, sourceConv),
    byCampaign: merge(campaignClicks, campaignConv),
    byCountry: merge(countryClicks, countryConv),
    byTrack: merge(trackClicks, trackConv),
    recent: recent.rows
  };
}

async function dashboardStats(incoming) {
  if (!pool) return { persistent: false, totalClicks: 0, bongacamsClicks: 0, chaturbateClicks: 0, tier1Clicks: 0, bongaTier1Clicks: 0, today: 0, week: 0, month: 0, platforms: {}, countries: {}, sources: {}, registrations: 0, purchases: 0, earnings: 0 };
  await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (id BIGSERIAL PRIMARY KEY, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), country VARCHAR(16) NOT NULL, category VARCHAR(40) NOT NULL, source VARCHAR(40) NOT NULL, campaign VARCHAR(80) NOT NULL, placement VARCHAR(80) NOT NULL, platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate')`);
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'");
  const from = incoming.searchParams.get("from");
  const to = incoming.searchParams.get("to");
  const conditions = [];
  const params = [];
  if (from) { params.push(`${from}T00:00:00.000Z`); conditions.push(`clicked_at >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); conditions.push(`clicked_at <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const q = async (sql, p = params) => (await pool.query(sql, p)).rows;
  const total = Number((await q(`SELECT COUNT(*)::int AS n FROM affiliate_clicks ${where}`))[0]?.n || 0);
  const platformRows = await q(`SELECT platform, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform ORDER BY n DESC`);
  const countryRows = await q(`SELECT country, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY country ORDER BY n DESC`);
  const sourceRows = await q(`SELECT source, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY source ORDER BY n DESC`);
  const tier1 = ['US','CA','GB','AU','NZ','DE','FR','NL','IE','SE','NO','DK','FI','CH','AT','BE','LU','IS'];
  const tierPlaceholders = tier1.map((_, i) => `$${params.length + i + 1}`).join(",");
  const tierQuery = await pool.query(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE platform='bongacams')::int AS bonga FROM affiliate_clicks ${where ? where + " AND" : "WHERE"} UPPER(country) IN (${tierPlaceholders})`, [...params, ...tier1]);
  const countSince = async interval => Number((await pool.query(`SELECT COUNT(*)::int AS n FROM affiliate_clicks WHERE clicked_at >= NOW() - INTERVAL '${interval}'`)).rows[0]?.n || 0);
  const earningsRows = await pool.query(`SELECT COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_payout-adjustment')),0)::numeric AS earnings FROM cb_conversions`);
  const platforms = Object.fromEntries(platformRows.map(r => [r.platform || 'unknown', Number(r.n)]));
  const countries = Object.fromEntries(countryRows.map(r => [r.country || 'UNKNOWN', Number(r.n)]));
  const sources = Object.fromEntries(sourceRows.map(r => [r.source || 'direct', Number(r.n)]));
  return { persistent: true, totalClicks: total, bongacamsClicks: platforms.bongacams || 0, chaturbateClicks: platforms.chaturbate || 0, tier1Clicks: Number(tierQuery.rows[0]?.n || 0), bongaTier1Clicks: Number(tierQuery.rows[0]?.bonga || 0), today: await countSince('1 day'), week: await countSince('7 days'), month: await countSince('30 days'), platforms, countries, sources, registrations: Number(earningsRows.rows[0]?.registrations || 0), purchases: Number(earningsRows.rows[0]?.purchases || 0), earnings: Number(earningsRows.rows[0]?.earnings || 0) };
}

http.createServer = function wrappedCreateServer(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");
    const authHandled = await handleAuth(req, res, incoming);
    if (authHandled !== false) return;
    if (["/api/stats", "/api/stats.csv", "/api/revshare", "/api/dashboard-stats", "/visits"].includes(incoming.pathname)) {
      if (!validSession(req)) {
        if (incoming.pathname === "/visits") return res.end("Not found");
        return json(res, 401, { error: "Authentication required." });
      }
      if (STATS_KEY && ["/api/stats", "/api/stats.csv", "/visits"].includes(incoming.pathname)) {
        incoming.searchParams.set("key", STATS_KEY);
        req.url = incoming.pathname + "?" + incoming.searchParams.toString();
      }
    }
    if (incoming.pathname === "/api/dashboard-stats") {
      try { return json(res, 200, await dashboardStats(incoming)); }
      catch (err) { console.error("Dashboard stats failed:", err.message); return json(res, 500, { error: "Could not load dashboard analytics." }); }
    }
    if (incoming.pathname === "/api/revshare") {
      try { return json(res, 200, await revshareStats(incoming)); }
      catch (err) { console.error("RevShare stats failed:", err.message); return json(res, 500, { error: "Could not load RevShare analytics." }); }
    }
    if (incoming.pathname === "/cb/postback") {
      try {
        await saveConversion(Object.fromEntries(incoming.searchParams.entries()));
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        return res.end("OK");
      } catch (_) { return json(res, 503, { error: "Postback storage unavailable." }); }
    }
    return handler(req, res);
  });
};

require("./server.js");
