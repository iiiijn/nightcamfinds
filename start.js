const http = require("http");
const crypto = require("crypto");
const { COUNTRIES, PLATFORMS, resolveCountryPreference } = require("./src/country-routing.cjs");

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
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(transaction_id)
    )
  `);
  await pool.query("ALTER TABLE cb_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("ALTER TABLE cb_conversions ALTER COLUMN country TYPE VARCHAR(16)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT FALSE");
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
function makeClickId() { return `ncf_${Date.now().toString(36)}_${crypto.randomBytes(9).toString("hex")}`; }

async function saveClick(click) {
  if (!pool) return;
  try {
    await ensurePostbackTables();
    await pool.query(
      `INSERT INTO affiliate_clicks (click_id,country,category,source,campaign,placement,platform,medium,content,device)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement, click.platform, click.medium, click.content, click.device]
    );
    if (click.platform === "chaturbate") {
      await pool.query(
        `INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING`,
        [click.clickId, click.country, click.category, click.source, click.campaign, click.placement]
      );
    }
    // Add richer attribution when the Phase 1 migration has been explicitly applied.
    // Missing table is tolerated so older production schemas keep working.
    try {
      await pool.query(
        `INSERT INTO click_attribution_events
          (click_id,country,page_type,category,platform,card_position,device,referrer_host,utm_source,utm_medium,utm_campaign,utm_content,sub_id,is_bot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (click_id) DO NOTHING`,
        [click.clickId, click.country === "UNKNOWN" ? "UN" : click.country, click.pageType, click.category, click.platform,
          click.cardPosition, click.device, click.referrerHost, click.source, click.medium, click.campaign, click.content, click.subId, click.isBot]
      );
    } catch (eventErr) {
      if (!/click_attribution_events/.test(String(eventErr.message || ""))) throw eventErr;
    }
  } catch (err) {
    console.error("Affiliate click tracking failed:", err.message);
  }
}

async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  await ensurePostbackTables();
  const clickId = clean(params.click_id, "", 128);
  const transactionId = clean(params.transaction_id, "", 255);
  const matchedResult = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM cb_clicks WHERE click_id = $1::varchar(128)) AS matched",
    [clickId]
  );
  const matchedClick = Boolean(matchedResult.rows[0]?.matched);
  const payout = Number.parseFloat(params.payout);
  const amount = Number.parseFloat(params.amount);
  await pool.query(
    `INSERT INTO cb_conversions
     (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,raw_payload,matched_click)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      clickId, transactionId, clean(params.type, "unknown", 100),
      Number.isFinite(payout) ? payout : 0, clean(params.currency, "", 16),
      Number.isFinite(amount) ? amount : null, clean(params.country, "UNKNOWN", 16).toUpperCase(),
      clean(params.track, "", 255), clean(params.source, "", 255), clean(params.campaign_id, "", 255),
      clean(params.program_id, "", 255), clean(params.user_id, "", 255), clean(params.timestamp, "", 100),
      JSON.stringify(params), matchedClick
    ]
  );
}

async function dashboardStats(incoming) {
  if (!pool) throw new Error("Database is not configured");
  await ensurePostbackTables();
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  const from = incoming.searchParams.get("from");
  const to = incoming.searchParams.get("to");
  const conditions = [];
  const params = [];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { params.push(`${from}T00:00:00.000Z`); conditions.push(`clicked_at >= $${params.length}`); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { params.push(`${to}T23:59:59.999Z`); conditions.push(`clicked_at <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const q = async (sql, p = params) => (await pool.query(sql, p)).rows;
  const platformRows = await q(`SELECT platform, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform`);
  const countryRows = await q(`SELECT country, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY country`);
  const total = Number((await q(`SELECT COUNT(*)::int AS n FROM affiliate_clicks ${where}`))[0]?.n || 0);
  const tier1 = ["US","CA","GB","IE","AU","NZ","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE"];
  const tierPlaceholders = tier1.map((_, i) => `$${params.length + i + 1}`).join(",");
  const tierRows = await pool.query(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE platform='bongacams')::int AS bonga FROM affiliate_clicks ${where ? where + " AND" : "WHERE"} UPPER(country) IN (${tierPlaceholders})`, [...params, ...tier1]);
  const sourceRows = await q(`SELECT platform, source, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,source`);
  const placementRows = await q(`SELECT platform, placement, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,placement`);
  const campaignRows = await q(`SELECT platform, campaign, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY platform,campaign`);
  const deviceRows = await q(`SELECT device, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY device`);
  const mediums = await q(`SELECT medium, COUNT(*)::int AS n FROM affiliate_clicks ${where} GROUP BY medium`);
  const earningsRows = await pool.query(`SELECT COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_payout-adjustment')),0)::numeric AS earnings FROM cb_conversions`);
  const bongacash = await pool.query(`SELECT COUNT(*) FILTER (WHERE conversion_type='registration')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type='purchase'),0)::numeric AS earnings FROM bonga_conversions`).catch(() => ({rows:[{}]}));
  const platforms = Object.fromEntries(platformRows.map(r => [r.platform || "unknown", Number(r.n)]));
  const sources = Object.fromEntries(sourceRows.map(r => [`${r.platform}:${r.source}`, Number(r.n)]));
  const placements = Object.fromEntries(placementRows.map(r => [`${r.platform}:${r.placement}`, Number(r.n)]));
  const campaigns = Object.fromEntries(campaignRows.map(r => [`${r.platform}:${r.campaign}`, Number(r.n)]));
  const devices = Object.fromEntries(deviceRows.map(r => [r.device || "unknown", Number(r.n)]));
  const countries = Object.fromEntries(countryRows.map(r => [r.country || "UNKNOWN", Number(r.n)]));
  const mediumStats = Object.fromEntries(mediums.map(r => [r.medium || "unknown", Number(r.n)]));
  const countSince = async days => Number((await pool.query("SELECT COUNT(*)::int AS n FROM affiliate_clicks WHERE clicked_at >= NOW() - ($1::int * INTERVAL '1 day')", [days])).rows[0]?.n || 0);
  const cbClicks = platforms.chaturbate || 0;
  const bcClicks = platforms.bongacams || 0;
  const cbTier = Number(tierRows.rows[0]?.n || 0) - Number(tierRows.rows[0]?.bonga || 0);
  return {
    persistent: true, totalClicks: total, chaturbateClicks: cbClicks, bongacamsClicks: bcClicks,
    tier1Clicks: Number(tierRows.rows[0]?.n || 0), bongaTier1Clicks: Number(tierRows.rows[0]?.bonga || 0),
    today: await countSince(1), week: await countSince(7), month: await countSince(30),
    registrations: Number(earningsRows.rows[0]?.registrations || 0), purchases: Number(earningsRows.rows[0]?.purchases || 0),
    earnings: Number(earningsRows.rows[0]?.earnings || 0), bongacamsRegistrations: Number(bongacash.rows[0]?.registrations || 0),
    bongacamsPurchases: Number(bongacash.rows[0]?.purchases || 0), bongacamsEarnings: Number(bongacash.rows[0]?.earnings || 0),
    bongacashConnected: Boolean(String(process.env.BONGACASH_POSTBACK_SECRET || "").trim()),
    platforms, countries, sources, placements, campaigns, devices, mediums
  };
}

function parseAttribution(incoming, req, platform) {
  const p = incoming.searchParams;
  const medium = cleanLabel(p.get("utm_medium") || p.get("medium"), "unknown", 80);
  const content = cleanLabel(p.get("utm_content") || p.get("content"), "", 120);
  const source = cleanLabel(p.get("utm_source") || p.get("source"), "direct", 40);
  const campaign = cleanLabel(p.get("utm_campaign") || p.get("campaign"), "organic", 80);
  const placement = cleanLabel(p.get("src"), platform === "bongacams" ? "bc-card" : "cb-card", 80);
  const category = cleanLabel(p.get("cat"), "unknown", 40);
  const cardPositionRaw = Number.parseInt(p.get("position") || p.get("card_position") || "", 10);
  let referrerHost = "";
  try { referrerHost = req.headers.referer ? new URL(req.headers.referer).hostname.slice(0, 255) : ""; } catch {}
  const pagePath = String(p.get("page") || req.headers.referer || incoming.pathname);
  const pageType = /country/i.test(pagePath) ? "country" : /female|male|trans|couples/i.test(pagePath) ? "category" : /popular|new|hd|live/i.test(pagePath) ? "listing" : "home_or_other";
  const subId = cleanLabel(p.get("subid") || p.get("sub_id") || p.get("utm_id"), "", 128);
  const ua = String(req.headers["user-agent"] || "");
  const isBot = /bot|crawler|spider|slurp|headless|facebookexternalhit|preview/i.test(ua);
  return {
    clickId: makeClickId(), country: country(req), category, source, medium, campaign, placement, content,
    device: device(req), platform, pageType, referrerHost,
    cardPosition: Number.isInteger(cardPositionRaw) && cardPositionRaw > 0 && cardPositionRaw <= 1000 ? cardPositionRaw : null,
    subId, isBot
  };
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
    if (incoming.pathname === "/api/country-routing" && req.method === "GET") {
      try {
        if (!pool) return json(res, 200, { settings: {}, fallback: true });
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1 LIMIT 1", ["country_platform_routing"]);
        const stored = result.rows[0]?.value || {};
        const approved = {};
        for (const countryCode of COUNTRIES) {
          const resolved = resolveCountryPreference(countryCode, stored);
          if (resolved.preferredPlatform) approved[countryCode] = resolved;
        }
        return json(res, 200, { settings: approved, fallback: Object.keys(approved).length === 0 });
      } catch (err) {
        console.error("Country routing read failed:", err.message);
        return json(res, 200, { settings: {}, fallback: true });
      }
    }
    if (incoming.pathname === "/api/country-routing" && req.method === "POST") {
      if (!validSession(req)) return json(res, 401, { error: "Authentication required." });
      if (!pool) return json(res, 503, { error: "Database is not configured." });
      let body;
      try { body = JSON.parse(await readBody(req) || "{}"); }
      catch { return json(res, 400, { error: "Invalid JSON." }); }
      const countryCode = String(body.country || "").trim().toUpperCase();
      const platform = String(body.preferredPlatform || "").trim().toLowerCase();
      const status = String(body.status || "hypothesis").trim().toLowerCase();
      const hypothesis = String(body.hypothesis || "").replace(/[\\u0000-\\u001f\\u007f]/g, "").trim().slice(0, 500);
      if (!COUNTRIES.includes(countryCode) || !PLATFORMS.includes(platform) || !["hypothesis", "unassigned"].includes(status)) {
        return json(res, 400, { error: "Invalid country routing setting. Live approval is intentionally not available through this endpoint." });
      }
      try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1 LIMIT 1", ["country_platform_routing"]);
        const stored = result.rows[0]?.value || {};
        stored[countryCode] = { preferredPlatform: status === "hypothesis" ? platform : null, status, hypothesis, approvedAt: null, updatedAt: new Date().toISOString() };
        await pool.query(
          "INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
          ["country_platform_routing", JSON.stringify(stored)]
        );
        return json(res, 200, { saved: true, country: countryCode, status, livePreferenceChanged: false });
      } catch (err) {
        console.error("Country routing write failed:", err.message);
        return json(res, 500, { error: "Could not save country routing hypothesis." });
      }
    }
    if(authHandled !== false) return;
    if(["/api/dashboard-stats","/api/revshare","/api/stats","/api/stats.csv"].includes(incoming.pathname) && !validSession(req)) {
      return json(res,401,{error:"Authentication required."});
    }
    if(incoming.pathname === "/api/dashboard-stats") {
      try{return json(res,200,await dashboardStats(incoming))}catch(err){console.error("Dashboard stats failed:",err.message);return json(res,500,{error:"Could not load dashboard analytics."})}
    }
    if (incoming.pathname === "/api/chaturbate/postback" || incoming.pathname === "/cb/postback") {
      try {
        const params = Object.fromEntries(incoming.searchParams.entries());
        const configuredSecret = String(process.env.CB_POSTBACK_SECRET || "").trim();
        // Chaturbate Dynamic Postbacks do not send a generic `secret` macro.
        // Keep legacy secret support only when Chaturbate actually supplies one.
        if (configuredSecret && params.secret && !safeEqual(params.secret, configuredSecret)) {
          console.warn("Chaturbate postback rejected: invalid optional secret");
          return json(res, 403, { error: "Invalid postback secret." });
        }
        // Chaturbate's URL tester can send literal macro placeholders.
        // A validation probe must never be stored as a real affiliate conversion.
        const macroPlaceholder = value => /^\{[a-z_]+\}$/i.test(String(value || "").trim());
        if (macroPlaceholder(params.click_id) || macroPlaceholder(params.transaction_id) || macroPlaceholder(params.type)) {
          console.log("Chaturbate postback test acknowledged; no conversion recorded");
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          return res.end("OK");
        }
        // Require the identifiers needed for safe attribution and idempotency.
        if (!params.click_id || !params.transaction_id) {
          console.warn("Chaturbate postback rejected: missing click_id or transaction_id");
          return json(res, 400, { error: "Missing click_id or transaction_id." });
        }
        await saveConversion(params);
        console.log("Chaturbate postback conversion recorded", JSON.stringify({ type: params.type || "", clickIdPresent: true, transactionIdPresent: true }));
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        return res.end("OK");
      } catch (err) {
        console.error("Chaturbate postback rejected:", err.message);
        return json(res, 400, { error: "Postback event rejected." });
      }
    }
    const originalWriteHead = res.writeHead.bind(res);
    const path = incoming.pathname;
    const platform = path.startsWith("/bgo/") ? "bongacams" : path.startsWith("/go/") ? "chaturbate" : "";
    if(platform) {
      const click = parseAttribution(incoming,req,platform);
      await saveClick(click);
      res.writeHead = function(statusCode,headers,...rest) {
        if(headers && headers.Location) {
          try {
            const target = new URL(headers.Location);
            target.searchParams.set("click_id",click.clickId);
            if(click.source!=="direct" && !target.searchParams.get("source")) target.searchParams.set("source",click.source);
            target.searchParams.set("track",click.placement);
            headers = {...headers,Location:target.toString()};
          } catch {}
        }
        return originalWriteHead(statusCode,headers,...rest);
      };
    }
    return handler(req,res);
  });
};
require("./server.js");
