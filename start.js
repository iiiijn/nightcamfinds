const http = require("http");
const crypto = require("crypto");
const { normalizeChaturbatePostback, removePostbackSecrets, hasUnresolvedChaturbateMacros } = require("./src/services/chaturbate-revshare.cjs");
const dashboardReporting = require("./src/services/dashboard-reporting.cjs");

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
const POSTBACK_SECRET = process.env.CB_POSTBACK_SECRET || "";
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
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
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
  return safeEqual(signature, expected) && username === ADMIN_USER && Number.isFinite(issued) &&
    Date.now() - issued <= SESSION_TTL && Date.now() >= issued - 60000;
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
      event_time VARCHAR(32),
      device VARCHAR(32),
      language VARCHAR(32),
      token VARCHAR(80),
      program_name VARCHAR(255),
      referral TEXT,
      attempt VARCHAR(32),
      region VARCHAR(255),
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(transaction_id)
    )
  `);
  await pool.query("ALTER TABLE cb_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("ALTER TABLE cb_conversions ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS event_time VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS device VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS language VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS token VARCHAR(80)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS program_name VARCHAR(255)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS referral TEXT");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS attempt VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS region VARCHAR(255)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id)");
}

function clean(value, fallback = "unknown", max = 255) {
  return String(value || "").trim().slice(0, max) || fallback;
}
function cleanLabel(value, fallback = "unknown", max = 80) {
  const v = String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max);
  return v || fallback;
}
function country(req) {
  for (const value of [req.headers["cf-ipcountry"], req.headers["x-vercel-ip-country"], req.headers["cloudfront-viewer-country"], req.headers["x-country-code"]]) {
    const iso = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso;
  }
  return "UNKNOWN";
}
function device(req) {
  const ua = String(req.headers["user-agent"] || "");
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}
async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  await ensurePostbackTables();
  const clickId = clean(params.click_id, "", 128);
  const transactionId = clean(params.transaction_id, "", 255);
  const matchedResult = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM cb_clicks WHERE click_id = $1::varchar(128) UNION ALL SELECT 1 FROM affiliate_clicks WHERE click_id = $1::varchar(128) AND platform = 'chaturbate') AS matched",
    [clickId]
  );
  const matchedClick = Boolean(matchedResult.rows[0]?.matched);
  const payout = Number.parseFloat(params.payout);
  const amount = Number.parseFloat(params.amount);
  const inserted = await pool.query(
    `INSERT INTO cb_conversions
     (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,program_name,user_id,event_timestamp,event_time,device,language,token,referral,attempt,region,raw_payload,matched_click)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23)
     ON CONFLICT (transaction_id) DO NOTHING
     RETURNING id`,
    [
      clickId, transactionId, clean(params.type, "unknown", 100),
      Number.isFinite(payout) ? payout : 0, clean(params.currency, "", 16),
      Number.isFinite(amount) ? amount : null, clean(params.country, "UNKNOWN", 16).toUpperCase(),
      clean(params.track, "", 255), clean(params.source, "", 255), clean(params.campaign_id, "", 255),
      clean(params.program_id, "", 255), clean(params.program_name, "", 255), clean(params.user_id, "", 255),
      clean(params.timestamp, "", 100), clean(params.time, "", 32), clean(params.device, "", 32), clean(params.language, "", 32),
      clean(params.token, "", 80), clean(params.referral, "", 2048), clean(params.attempt, "", 32),
      clean(params.region, "", 255), JSON.stringify(params), matchedClick
    ]
  );
  return { matchedClick, inserted: inserted.rowCount === 1 };
}

async function dashboardStats(incoming) {
  if (!pool) throw new Error("Database is not configured");
  await ensurePostbackTables();
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  const parsedRange = dashboardReporting.parseUtcDateRange(incoming.searchParams.get("from"), incoming.searchParams.get("to"));
  if (parsedRange.error) return { error: parsedRange.error };
  const dateRange = parsedRange.value;
  const clickDateFilter = dashboardReporting.buildTimestampFilter("clicked_at", dateRange);
  const params = clickDateFilter.params;
  const where = clickDateFilter.sql ? `WHERE ${clickDateFilter.sql}` : "";
  const conversionDateFilter = dashboardReporting.buildTimestampFilter("received_at", dateRange);
  const conversionWhere = conversionDateFilter.sql ? `AND ${conversionDateFilter.sql}` : "";
  const q = async (sql, p = params) => (await pool.query(sql, p)).rows;
  const platformRows = await q(`SELECT platform, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform`);
  const countryRows = await q(`SELECT country, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY country`);
  const total = Number((await q(`SELECT COUNT(*)::int AS n FROM affiliate_clicks ${where}`))[0]?.n || 0);
  const tier1 = ["US","GB","CA","AU","DE","FR","NL","IE","NZ","SE","NO","DK","FI","CH","AT","BE","JP","SG"];
  const tierPlaceholders = tier1.map((_, i) => `$${params.length + i + 1}`).join(",");
  const tierRows = await pool.query(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE platform='bongacams')::int AS bonga FROM affiliate_clicks ${where ? where + " AND" : "WHERE"} UPPER(country) IN (${tierPlaceholders})`, [...params, ...tier1]);
  const sourceRows = await q(`SELECT platform, source, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,source`);
  const placementRows = await q(`SELECT platform, placement, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,placement`);
  const campaignRows = await q(`SELECT platform, campaign, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,campaign`);
  const deviceRows = await q(`SELECT device, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY device`);
  const mediums = await q(`SELECT medium, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY medium`);
  const earningsRows = await pool.query(`SELECT
    COALESCE(NULLIF(UPPER(currency), ''), 'UNSPECIFIED') AS currency,
    COUNT(*) FILTER (WHERE conversion_type IN ('tokens_signup-referral','ppr_signup-referral','revshare_signup-referral'))::int AS registrations,
    COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases,
    COUNT(*)::int AS credited_events,
    COALESCE(SUM(payout),0)::numeric AS earnings
    FROM cb_conversions
    WHERE matched_click IS TRUE
      AND conversion_type IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')
    ${conversionWhere}
    GROUP BY 1`, conversionDateFilter.params);
  const earningsByCurrency = Object.fromEntries(earningsRows.rows.map(row => [row.currency, {
    registrations: Number(row.registrations || 0),
    purchases: Number(row.purchases || 0),
    creditedEvents: Number(row.credited_events || 0),
    earnings: Number(row.earnings || 0)
  }]));
  const cbRegistrations = Object.values(earningsByCurrency).reduce((sum, row) => sum + row.registrations, 0);
  const cbPurchases = Object.values(earningsByCurrency).reduce((sum, row) => sum + row.purchases, 0);
  // The legacy dashboard money cards are USD-denominated. Never add payouts
  // from different currencies into one number; expose the full breakdown too.
  const cbUsdEarnings = Number(earningsByCurrency.USD?.earnings || 0);
  const bongacash = await pool.query(`SELECT COUNT(*) FILTER (WHERE conversion_type='registration')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type='purchase'),0)::numeric AS earnings FROM bonga_conversions WHERE 1=1 ${conversionWhere}`, conversionDateFilter.params).catch(() => ({rows:[{}]}));
  let clickQuality = { knownBots: null, suspectedBots: null, notFlaggedAsBot: null, unclassified: null, available: false };
  try {
    const quality = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE is_bot IS TRUE)::int AS known_bots,
      COUNT(*) FILTER (WHERE bot_reason = 'suspected_automation_user_agent')::int AS suspected_bots,
      COUNT(*) FILTER (WHERE is_bot IS FALSE AND bot_reason IS DISTINCT FROM 'suspected_automation_user_agent')::int AS not_flagged_as_bot,
      COUNT(*) FILTER (WHERE is_bot IS NULL)::int AS unclassified
      FROM affiliate_clicks ${where}`, params);
    const row = quality.rows[0] || {};
    clickQuality = { knownBots: Number(row.known_bots || 0), suspectedBots: Number(row.suspected_bots || 0), notFlaggedAsBot: Number(row.not_flagged_as_bot || 0), unclassified: Number(row.unclassified || 0), available: true };
  } catch (qualityError) {
    if (!['42703', '42P01'].includes(qualityError.code)) throw qualityError;
  }
  const platforms = Object.fromEntries(platformRows.map(r => [r.platform || "unknown", Number(r.n)]));
  const sources = Object.fromEntries(sourceRows.map(r => [`${r.platform}:${r.source}`, Number(r.n)]));
  const placements = Object.fromEntries(placementRows.map(r => [`${r.platform}:${r.placement}`, Number(r.n)]));
  const campaigns = Object.fromEntries(campaignRows.map(r => [`${r.platform}:${r.campaign}`, Number(r.n)]));
  const devices = Object.fromEntries(deviceRows.map(r => [r.device || "unknown", Number(r.n)]));
  const countries = Object.fromEntries(countryRows.map(r => [r.country || "UNKNOWN", Number(r.n)]));
  const mediumStats = Object.fromEntries(mediums.map(r => [r.medium || "unknown", Number(r.n)]));
  // Country/platform detail is derived from stored click IDs. Conversion counts
  // are reported only where a conversion can be matched to a tracked click.
  // BongaCams per-country conversion attribution remains unavailable unless its
  // postback data includes a reliable matching click ID.
  let countryPlatformMetrics = [];
  let countryPlatformMetricsAvailable = false;
  try {
    const metricRows = await pool.query(
      `SELECT UPPER(ac.country) AS country, LOWER(ac.platform) AS platform,
        COUNT(DISTINCT ac.id)::int AS clicks,
        COUNT(DISTINCT ac.id) FILTER (WHERE ac.engaged_at IS NOT NULL)::int AS engaged_clicks,
        COUNT(DISTINCT cc.id) FILTER (WHERE cc.conversion_type IN ('tokens_signup-referral','ppr_signup-referral','revshare_signup-referral'))::int AS verified_signups,
        COUNT(DISTINCT cc.id) FILTER (WHERE cc.conversion_type='revshare_purchase')::int AS verified_payers,
        COALESCE(SUM(cc.payout) FILTER (WHERE cc.matched_click IS TRUE AND cc.conversion_type IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')),0)::numeric AS revenue
       FROM affiliate_clicks ac
       LEFT JOIN cb_conversions cc ON cc.click_id = ac.click_id AND ac.platform = 'chaturbate' AND cc.matched_click IS TRUE
       ${where}
       GROUP BY UPPER(ac.country), LOWER(ac.platform)
       ORDER BY UPPER(ac.country), LOWER(ac.platform)`,
      params
    );
    countryPlatformMetrics = metricRows.rows.map(row => {
      const clicks = Number(row.clicks || 0);
      const engagedClicks = Number(row.engaged_clicks || 0);
      const verifiedSignups = Number(row.verified_signups || 0);
      const verifiedPayers = Number(row.verified_payers || 0);
      const revenue = Number(row.revenue || 0);
      const conversionAvailable = row.platform === "chaturbate";
      return {
        country: row.country || "UNKNOWN", platform: row.platform || "unknown",
        clicks,
        engagedClicks: conversionAvailable ? engagedClicks : null,
        verifiedSignups: conversionAvailable ? verifiedSignups : null,
        verifiedPayers: conversionAvailable ? verifiedPayers : null,
        revenue: conversionAvailable ? revenue : null,
        epc: conversionAvailable && clicks > 0 ? revenue / clicks : null,
        conversionAttribution: conversionAvailable ? "matched_click_ids" : "unavailable",
        evidenceEligible: conversionAvailable && clicks >= 100 && engagedClicks >= 20 && verifiedSignups >= 5
      };
    });
    countryPlatformMetricsAvailable = true;
  } catch (metricError) {
    // The additive attribution migration is not applied automatically to production.
    // Fall back to a truthful click-only report using the legacy columns.
    const metricRows = await pool.query(
      `SELECT UPPER(country) AS country, LOWER(platform) AS platform, COUNT(*)::int AS clicks
       FROM affiliate_clicks ${where}
       GROUP BY UPPER(country), LOWER(platform)
       ORDER BY UPPER(country), LOWER(platform)`,
      params
    );
    countryPlatformMetrics = metricRows.rows.map(row => ({
      country: row.country || "UNKNOWN", platform: row.platform || "unknown",
      clicks: Number(row.clicks || 0), engagedClicks: null, verifiedSignups: null,
      verifiedPayers: null, revenue: null, epc: null, evidenceEligible: false,
      conversionAttribution: "unavailable_until_schema_and_postbacks_are_verified"
    }));
  }
  const countSince = async days => Number((await pool.query("SELECT COUNT(*)::int AS n FROM affiliate_clicks WHERE clicked_at >= NOW() - ($1::int * INTERVAL '1 day')", [days])).rows[0]?.n || 0);
  const cbClicks = platforms.chaturbate || 0;
  const bcClicks = platforms.bongacams || 0;
  const cbTier = Number(tierRows.rows[0]?.n || 0) - Number(tierRows.rows[0]?.bonga || 0);
  return {
    persistent: true, totalClicks: total, chaturbateClicks: cbClicks, bongacamsClicks: bcClicks,
    clickQuality, dateBasis: "UTC", dateRange: { from: dateRange.from, toExclusive: dateRange.toExclusive },
    tier1Clicks: Number(tierRows.rows[0]?.n || 0), bongaTier1Clicks: Number(tierRows.rows[0]?.bonga || 0),
    today: await countSince(1), week: await countSince(7), month: await countSince(30),
    registrations: cbRegistrations, purchases: cbPurchases, earnings: cbUsdEarnings, earningsByCurrency, bongacamsRegistrations: Number(bongacash.rows[0]?.registrations || 0),
    bongacamsPurchases: Number(bongacash.rows[0]?.purchases || 0), bongacamsEarnings: Number(bongacash.rows[0]?.earnings || 0),
    bongacashConnected: Boolean(String(process.env.BONGACASH_POSTBACK_SECRET || "").trim()),
    platforms, countries, sources, placements, campaigns, devices, mediums,
    countryPlatformMetrics, countryPlatformMetricsAvailable
  };
}

const dailyCountryAnalytics = require("./src/services/daily-country-analytics.cjs");

async function getDailyCountryAnalytics(incoming) {
  if (!pool) throw new Error("Database is not configured");
  const parsed = dailyCountryAnalytics.parseFilters(incoming.searchParams);
  if (parsed.error) return { error: parsed.error };
  const built = dailyCountryAnalytics.buildQuery(parsed.value);
  let result;
  let engagementAvailable = true;
  try {
    result = await pool.query(built.text, built.params);
  } catch (err) {
    if (err.code !== "42703") throw err;
    engagementAvailable = false;
    const fallback = dailyCountryAnalytics.buildQuery(parsed.value, { includeEngagement: false });
    result = await pool.query(fallback.text, fallback.params);
  }
  return {
    timezone: "UTC",
    tier1Countries: dailyCountryAnalytics.TIER1_COUNTRIES,
    filters: parsed.value,
    engagementAvailable,
    truncated: result.rows.length === 20000,
    rows: result.rows.map(row => ({
      date: String(row.day).slice(0, 10),
      country: row.country || "UNKNOWN",
      platform: row.platform || "unknown",
      clicks: Number(row.clicks || 0),
      engagedClicks: row.engaged_clicks == null ? null : Number(row.engaged_clicks)
    }))
  };
}

const countryCategoryAnalytics = require("./src/services/country-category-analytics.cjs");

async function getCountryCategoryAnalytics(incoming) {
  if (!pool) throw new Error("Database is not configured");
  const parsed = countryCategoryAnalytics.parseFilters(incoming.searchParams);
  if (parsed.error) return { error: parsed.error };
  const built = countryCategoryAnalytics.buildQuery(parsed.value);
  const result = await pool.query(built.text, built.params);
  return { timezone: "UTC", filters: parsed.value, rows: countryCategoryAnalytics.rankRows(result.rows), truncated: result.rows.length === 2000 };
}

async function handleAuth(req,res,incoming) {
  if (incoming.pathname === "/api/auth/me") return json(res,200,{authenticated:validSession(req),username:validSession(req)?ADMIN_USER:null});
  if (incoming.pathname === "/api/auth/logout") {
    res.writeHead(204,{"Set-Cookie":cookieHeader("",0),"Cache-Control":"no-store"}); return res.end();
  }
  if (incoming.pathname !== "/api/auth/login" || req.method !== "POST") return false;
  const ip=clientAddress(req),now=Date.now(),recent=(loginAttempts.get(ip)||[]).filter(t=>now-t<15*60*1000);
  if(recent.length>=8)return json(res,429,{error:"Too many login attempts. Try again later."},{"Retry-After":"900"});
  recent.push(now);loginAttempts.set(ip,recent);
  let data={};try{data=JSON.parse(await readBody(req)||"{}")}catch{return json(res,400,{error:"Invalid request."})}
  if(!ADMIN_PASSWORD||!SESSION_SECRET)return json(res,503,{error:"Dashboard authentication is not configured on the server."});
  if(!safeEqual(data.username||"",ADMIN_USER)||!safeEqual(data.password||"",ADMIN_PASSWORD))return json(res,401,{error:"Incorrect username or password."});
  loginAttempts.delete(ip);
  return json(res,200,{authenticated:true,username:ADMIN_USER},{"Set-Cookie":cookieHeader(sessionCookie(ADMIN_USER))});
}

http.createServer = function wrappedCreateServer(handler) {
  return originalCreateServer.call(http, async (req,res) => {
    const incoming = new URL(req.url, "http://localhost");
    const authHandled = await handleAuth(req,res,incoming);
    if(authHandled !== false) return;
    if(["/api/dashboard-stats","/api/daily-country-analytics","/api/country-category-analytics","/api/revshare","/api/stats","/api/stats.csv"].includes(incoming.pathname) && !validSession(req)) {
      return json(res,401,{error:"Authentication required."});
    }
    if(incoming.pathname === "/api/country-category-analytics") {
      try {
        const result = await getCountryCategoryAnalytics(incoming);
        if (result.error) return json(res, 400, { error: result.error });
        return json(res, 200, result);
      } catch(err) {
        console.error("Country category analytics failed:", err.message);
        return json(res, 500, { error: "Could not load country category analytics." });
      }
    }
    if(incoming.pathname === "/api/daily-country-analytics") {
      try {
        const result = await getDailyCountryAnalytics(incoming);
        if (result.error) return json(res, 400, { error: result.error });
        return json(res, 200, result);
      } catch(err) {
        console.error("Daily country analytics failed:", err.message);
        return json(res, 500, { error: "Could not load daily country analytics." });
      }
    }
    if(incoming.pathname === "/api/dashboard-stats") {
      try{return json(res,200,await dashboardStats(incoming))}catch(err){console.error("Dashboard stats failed:",err.message);return json(res,500,{error:"Could not load dashboard analytics."})}
    }
    if (incoming.pathname === "/api/chaturbate/postback" || incoming.pathname === "/cb/postback") {
      try {
        if (req.method !== "GET" && req.method !== "POST") {
          return json(res, 405, { error: "Method not allowed." }, { Allow: "GET, POST" });
        }
        const params = Object.fromEntries(incoming.searchParams.entries());
        if (req.method === "POST") {
          const rawBody = await readBody(req);
          const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
          let bodyParams = {};
          if (contentType === "application/x-www-form-urlencoded") {
            bodyParams = Object.fromEntries(new URLSearchParams(rawBody).entries());
          } else if (contentType === "application/json") {
            try {
              bodyParams = JSON.parse(rawBody || "{}");
              if (!bodyParams || typeof bodyParams !== "object" || Array.isArray(bodyParams)) {
                return json(res, 400, { error: "Postback JSON must be an object." });
              }
            } catch {
              return json(res, 400, { error: "Invalid postback JSON." });
            }
          } else {
            return json(res, 415, { error: "Unsupported postback content type." });
          }
          Object.assign(params, bodyParams);
        }
        // A provider test may leave any documented macro unresolved, not only
        // the three fields required by the normalizer. Acknowledge it without
        // persisting a conversion or allowing placeholder revenue into reports.
        if (hasUnresolvedChaturbateMacros(params)) {
          console.log("Chaturbate postback test acknowledged; no conversion recorded");
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          return res.end("OK");
        }
        const normalized = normalizeChaturbatePostback(params);
        if (!normalized.ok) {
          console.warn("Chaturbate postback rejected:", normalized.reason);
          return json(res, 400, { error: "Invalid postback event.", reason: normalized.reason });
        }
        const configuredSecret = String(process.env.CB_POSTBACK_SECRET || "").trim();
        if (!configuredSecret) {
          console.warn("Chaturbate postback rejected: CB_POSTBACK_SECRET is not configured");
          return json(res, 503, { error: "Postback authentication is not configured." });
        }
        const suppliedSecret = String(params.secret || "");
        const callbackShape = {
          hasClickId: Boolean(params.click_id),
          hasTransactionId: Boolean(params.transaction_id),
          hasType: Boolean(params.type),
          hasPayout: Boolean(params.payout),
          hasTokenField: Boolean(params.token || params.validation || params.validation_token)
        };
        if (!suppliedSecret) {
          console.warn("Chaturbate postback rejected: missing secret", JSON.stringify(callbackShape));
          return json(res, 403, { error: "Invalid postback authentication." });
        }
        if (!safeEqual(suppliedSecret, configuredSecret)) {
          console.warn("Chaturbate postback rejected: invalid secret", JSON.stringify(callbackShape));
          return json(res, 403, { error: "Invalid postback authentication." });
        }
        const event = normalized.event;
        Object.assign(params, {
          click_id: event.clickId,
          transaction_id: event.transactionId,
          type: event.type,
          payout: event.payout,
          amount: event.amount,
          currency: event.currency,
          country: event.country,
          track: event.track,
          source: event.source,
          campaign_id: event.campaignId,
          program_id: event.programId,
          program_name: event.programName,
          user_id: event.userId,
          timestamp: event.timestamp,
          time: event.time,
          device: event.device,
          language: event.language,
          token: event.token,
          referral: event.referral,
          attempt: event.attempt,
          region: event.region
        });
        const saved = await saveConversion(removePostbackSecrets(params));
        console.log("Chaturbate postback conversion received", JSON.stringify({
          type: event.type,
          matchedClick: saved.matchedClick,
          duplicate: !saved.inserted
        }));
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        return res.end("OK");
      } catch (err) {
        console.error("Chaturbate postback rejected:", err.message);
        return json(res, 400, { error: "Postback event rejected." });
      }
    }
    // Redirect click recording and click_id generation are owned by server.js.
    // Keeping a second writer here caused duplicate counts and orphaned IDs.
    return handler(req,res);
  });
};
require("./server.js");
