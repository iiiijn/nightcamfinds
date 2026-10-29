const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const bongacash = require("./bongacash");

const originalCreateServer = http.createServer;
const BONGA_CAMPAIGN = process.env.BONGACAMS_CAMPAIGN || "840970";
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5
}) : null;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.DASHBOARD_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const TIER1 = new Set(["US","CA","GB","IE","AU","NZ","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE"]);

async function ensureAffiliateSchema() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id BIGSERIAL PRIMARY KEY,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    category VARCHAR(40) NOT NULL DEFAULT 'unknown',
    source VARCHAR(40) NOT NULL DEFAULT 'direct',
    campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
    placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
    platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'
  )`);
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
}

// Run safe, additive migrations when the service starts rather than waiting for the first admin login.
ensureAffiliateSchema()
  .then(() => { if (pool) console.log("NightCamFinds affiliate attribution schema ready"); })
  .catch(err => console.error("NightCamFinds affiliate schema migration failed:", err.message));


function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "NightCamFinds/1.0", "Accept": "application/json,text/plain,*/*" } }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Bonga API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error(`Bonga API returned non-JSON: ${body.slice(0, 300)}`)); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error("Bonga API timeout")));
    req.on("error", reject);
  });
}

function text(value) {
  return String(value ?? "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
}

function imageFrom(room) {
  const p = room.profile_images || room.images || {};
  if (typeof p === "string") return p;
  return p.profile_image || p.thumbnail_image_big || p.thumbnail_image_medium || p.thumbnail_image_small || p.thumbnail_image_big_live || p.thumbnail_image_medium_live || room.image_url || room.thumbnail || room.avatar || "";
}

function normalizeBonga(room) {
  const username = text(room.username || room.user_name || room.nickname || room.model || room.id);
  if (!username) return null;
  const rawGender = String(room.gender || room.sex || "female").toLowerCase();
  const gender = rawGender.includes("trans") || rawGender === "t" ? "trans" : rawGender.includes("male") || rawGender === "m" ? "male" : rawGender.includes("couple") || rawGender === "c" ? "couples" : "female";
  const country = String(room.homecountry || room.country || room.country_code || "").toUpperCase().match(/^[A-Z]{2}$/)?.[0] || "";
  const viewers = Number(room.members_count ?? room.num_users ?? room.viewers ?? room.viewer_count ?? 0) || 0;
  const topic = text(room.chat_topic || room.room_subject || room.topic || (Array.isArray(room.tags) ? room.tags.join(", ") : room.tags));
  const href = room.chat_url || room.direct_chat_url || room.room_url || room.url || "";
  return { id: `bongacams:${username}`, platform: "bongacams", platformName: "BongaCams", username, displayName: text(room.display_name || room.name || username) || username, gender, country, countryName: country, location: text(room.hometown || room.location || room.homecountry), viewerCount: viewers, isHd: Boolean(room.hd_cam || room.hd || /\bhd\b/i.test(topic)), isNew: Boolean(room.is_new || room.new), image: imageFrom(room), roomSubject: topic, languages: text(room.primary_language || room.language || room.languages), href };
}

async function bongaRooms() {
  const api = process.env.BONGACAMS_API_BASE || "https://bngprm.com/promo.php";
  const query = new URLSearchParams({ c: BONGA_CAMPAIGN, type: "api", api_v: "1", limit: "10", api_type: "json" });
  const data = await getJson(`${api}?${query.toString()}`);
  const rows = Array.isArray(data) ? data : (data.results || data.rooms || data.data || data.models || []);
  const rooms = rows.map(normalizeBonga).filter(Boolean).filter(r => r.href || r.username);
  console.log(`BongaCams API returned ${rooms.length} rooms`);
  return rooms;
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function validDashboardSession(req) {
  if (!SESSION_SECRET) return false;
  const token = parseCookies(req).ncf_session;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [username, issuedAt, nonce, signature] = parts;
  const payload = `${username}.${issuedAt}.${nonce}`;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const issued = Number(issuedAt);
  return safeEqual(signature, expected) && username === ADMIN_USER && Number.isFinite(issued) && Date.now() - issued <= 12 * 60 * 60 * 1000 && Date.now() >= issued - 60000;
}

function rangeClause(incoming, column = "received_at") {
  const params = [];
  const where = [];
  const from = incoming.searchParams.get("from");
  const to = incoming.searchParams.get("to");
  if (from) { params.push(`${from}T00:00:00.000Z`); where.push(`${column} >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); where.push(`${column} <= $${params.length}`); }
  return { params, where: where.length ? `WHERE ${where.join(" AND ")}` : "" };
}

async function dashboardStats(incoming) {
  if (!pool) throw new Error("Database is not configured");
  // Ensure analytics schema exists in the server that actually handles dashboard requests.
  await pool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id BIGSERIAL PRIMARY KEY,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    category VARCHAR(40) NOT NULL DEFAULT 'unknown',
    source VARCHAR(40) NOT NULL DEFAULT 'direct',
    campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
    placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
    platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'
  )`);
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_click_id_idx ON affiliate_clicks(click_id)");

  const cb = rangeClause(incoming, "clicked_at");
  const conv = rangeClause(incoming, "received_at");
  await bongacash.ensureTable(pool);

  let cbClicks = 0;
  let bongaClicks = 0;
  try {
    const r = await pool.query(`SELECT platform, COUNT(*)::int AS clicks FROM affiliate_clicks ${cb.where} GROUP BY platform`, cb.params);
    for (const row of r.rows) {
      if (String(row.platform).toLowerCase() === "bongacams") bongaClicks = Number(row.clicks || 0);
      if (String(row.platform).toLowerCase() === "chaturbate") cbClicks = Number(row.clicks || 0);
    }
  } catch {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS clicks FROM cb_clicks ${cb.where}`, cb.params);
      cbClicks = Number(r.rows[0]?.clicks || 0);
    } catch {}
  }

  const bonga = await bongacash.stats(pool, incoming.searchParams.get("from"), incoming.searchParams.get("to"));
  let cbRegs = 0, cbPurchases = 0, cbEarnings = 0;
  try {
    const r = await pool.query(`SELECT COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_payout-adjustment')),0)::numeric AS earnings FROM cb_conversions ${conv.where}`, conv.params);
    cbRegs = Number(r.rows[0]?.registrations || 0); cbPurchases = Number(r.rows[0]?.purchases || 0); cbEarnings = Number(r.rows[0]?.earnings || 0);
  } catch {}

  let cbTier1 = 0, bongaTier1 = 0;
  try {
    const r = await pool.query(`SELECT platform, country, COUNT(*)::int AS clicks FROM affiliate_clicks ${cb.where} GROUP BY platform, country`, cb.params);
    for (const row of r.rows) {
      if (!TIER1.has(String(row.country || "").toUpperCase())) continue;
      if (String(row.platform).toLowerCase() === "bongacams") bongaTier1 += Number(row.clicks || 0);
      if (String(row.platform).toLowerCase() === "chaturbate") cbTier1 += Number(row.clicks || 0);
    }
  } catch {}

  const totalClicks = cbClicks + bongaClicks;

  // Country/platform report: click counts use the selected click-date range;
  // conversions use the same selected date range on received_at and are attributed
  // to the originating click country only when the click ID can be matched.
  const countryClickRows = await pool.query(
    `SELECT UPPER(COALESCE(NULLIF(country,''),'UNKNOWN')) AS country,
            LOWER(COALESCE(NULLIF(platform,''),'unknown')) AS platform,
            COUNT(*)::int AS clicks
       FROM affiliate_clicks ${cb.where}
      GROUP BY 1,2`,
    cb.params
  );
  const conversionEvents = [];
  try {
    const rows = await pool.query(
      `SELECT c.conversion_type, c.payout, c.currency, c.country AS reported_country,
              c.user_id,
              COALESCE(NULLIF(cc.country, 'UNKNOWN'), NULLIF(ac.country, 'UNKNOWN')) AS click_country,
              (cc.click_id IS NOT NULL OR ac.click_id IS NOT NULL) AS matched_click
         FROM cb_conversions c
         LEFT JOIN cb_clicks cc ON cc.click_id = c.click_id
         LEFT JOIN affiliate_clicks ac ON ac.click_id = c.click_id AND ac.platform = 'chaturbate'
         ${conv.where}`,
      conv.params
    );
    for (const row of rows.rows) conversionEvents.push({ ...row, platform: "chaturbate" });
  } catch (err) {
    console.warn("Chaturbate country attribution unavailable:", err.message);
  }
  try {
    const rows = await pool.query(
      `SELECT c.conversion_type, c.payout, c.currency, c.country AS reported_country,
              c.user_id,
              COALESCE(NULLIF(bc.country, 'UNKNOWN'), NULLIF(ac.country, 'UNKNOWN')) AS click_country,
              (bc.click_id IS NOT NULL OR ac.click_id IS NOT NULL) AS matched_click
         FROM bonga_conversions c
         LEFT JOIN bonga_clicks bc ON bc.click_id = c.click_id
         LEFT JOIN affiliate_clicks ac ON ac.click_id = c.click_id AND ac.platform = 'bongacams'
         ${conv.where}`,
      conv.params
    );
    for (const row of rows.rows) conversionEvents.push({ ...row, platform: "bongacams" });
  } catch (err) {
    console.warn("BongaCams country attribution unavailable:", err.message);
  }
  const { summarizeCountryPerformance } = require("./src/country-performance.cjs");
  const countryPlatformPerformance = summarizeCountryPerformance(countryClickRows.rows, conversionEvents);

  const now = new Date();
  const iso = d => d.toISOString().slice(0,10);
  const day = new URL(incoming); day.searchParams.set("from", iso(now)); day.searchParams.set("to", iso(now));
  const seven = new URL(incoming); const d7 = new Date(now); d7.setDate(d7.getDate()-6); seven.searchParams.set("from", iso(d7)); seven.searchParams.set("to", iso(now));
  const thirty = new URL(incoming); const d30 = new Date(now); d30.setDate(d30.getDate()-29); thirty.searchParams.set("from", iso(d30)); thirty.searchParams.set("to", iso(now));
  const countClicks = async u => {
    const x = rangeClause(u, "clicked_at");
    try { const r = await pool.query(`SELECT COUNT(*)::int AS clicks FROM affiliate_clicks ${x.where}`, x.params); return Number(r.rows[0]?.clicks || 0); } catch { return 0; }
  };

  const sources = {};
  const countries = {};
  const placements = {};
  const devices = {};
  try {
    const r = await pool.query(`SELECT platform, source, country, placement, device, COUNT(*)::int AS clicks
      FROM affiliate_clicks ${cb.where}
      GROUP BY platform, source, country, placement, device`, cb.params);
    for (const row of r.rows) {
      const platform = String(row.platform || "unknown");
      const source = String(row.source || "direct");
      const country = String(row.country || "UNKNOWN").toUpperCase();
      const placement = String(row.placement || "unknown");
      const device = String(row.device || "unknown");
      const clicks = Number(row.clicks || 0);
      sources[`${platform}:${source}`] = (sources[`${platform}:${source}`] || 0) + clicks;
      countries[country] = (countries[country] || 0) + clicks;
      placements[`${platform}:${placement}`] = (placements[`${platform}:${placement}`] || 0) + clicks;
      devices[device] = (devices[device] || 0) + clicks;
    }
  } catch (err) {
    // Keep dashboard operational if expanded metadata has not been migrated yet.
    try {
      const r = await pool.query(`SELECT platform, source, country, placement, COUNT(*)::int AS clicks
        FROM affiliate_clicks ${cb.where}
        GROUP BY platform, source, country, placement`, cb.params);
      for (const row of r.rows) {
        const platform = String(row.platform || "unknown");
        const source = String(row.source || "direct");
        const country = String(row.country || "UNKNOWN").toUpperCase();
        const placement = String(row.placement || "unknown");
        const clicks = Number(row.clicks || 0);
        sources[`${platform}:${source}`] = (sources[`${platform}:${source}`] || 0) + clicks;
        countries[country] = (countries[country] || 0) + clicks;
        placements[`${platform}:${placement}`] = (placements[`${platform}:${placement}`] || 0) + clicks;
      }
    } catch (inner) { console.error("Attribution aggregation unavailable:", inner.message); }
  }

  const combinedCountries = { ...countries };
  for (const row of bonga.byCountry) combinedCountries[row.name] = (combinedCountries[row.name] || 0) + row.conversions;
  return {
    totalClicks,
    chaturbateClicks: cbClicks,
    bongacamsClicks: bongaClicks,
    tier1Clicks: cbTier1 + bongaTier1,
    bongaTier1Clicks: bongaTier1,
    today: await countClicks(day),
    week: await countClicks(seven),
    month: await countClicks(thirty),
    registrations: cbRegs,
    purchases: cbPurchases,
    earnings: cbEarnings,
    bongacamsRegistrations: bonga.registrations,
    bongacamsPurchases: bonga.purchases,
    bongacamsEarnings: bonga.earnings,
    bongacamsPurchaseSpend: bonga.spend,
    bongacashPostbackConfigured: Boolean(String(process.env.BONGACASH_POSTBACK_SECRET || "").trim()),
    bongacashTrackingVerified: false,
    platforms: { chaturbate: cbClicks, bongacams: bongaClicks },
    countryPlatformPerformance,
    sources,
    countries: combinedCountries,
    placements,
    devices
  };
}

http.createServer = function routeDashboard(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");

    if (incoming.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        databaseConfigured: Boolean(databaseUrl),
        bongaPostbackConfigured: Boolean(String(process.env.BONGACASH_POSTBACK_SECRET || "").trim()),
        timestamp: new Date().toISOString()
      });
    }
    if (incoming.pathname === "/dashboard" || incoming.pathname === "/dashboard/") {
      const html = fs.readFileSync(path.join(__dirname, "public", "dashboard.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      return res.end(html);
    }
    if (incoming.pathname === "/api/bonga-rooms") {
      try { return sendJson(res, 200, { rooms: await bongaRooms(), platform: "bongacams" }); }
      catch (err) { console.error("BongaCams feed error:", err.message); return sendJson(res, 502, { rooms: [], platform: "bongacams", error: err.message }); }
    }
    if (incoming.pathname === "/api/bongacash/postback") {
      const params = new URLSearchParams(incoming.searchParams);
      if (!bongacash.verifySecret(req, params)) return sendJson(res, 403, { error: "Invalid BongaCash postback secret." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      try { return sendJson(res, 200, await bongacash.save(pool, params)); }
      catch (err) { console.error("BongaCash postback failed:", err.message); return sendJson(res, 500, { error: "Could not save BongaCash conversion." }); }
    }
    if (incoming.pathname === "/api/dashboard-stats") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      try { return sendJson(res, 200, await dashboardStats(incoming)); }
      catch (err) { console.error("Dashboard stats failed:", err.message); return sendJson(res, 500, { error: err.message }); }
    }
    const originalWriteHead = res.writeHead.bind(res);
    // NIGHTCAMFINDS_BONGA_REVSHARE_V1: enforce BongaCash campaign on provider track redirects.
    res.writeHead = function affiliateAwareWriteHead(statusCode, headers, ...rest) {
      if (incoming.pathname.startsWith("/bgo/") && headers && headers.Location) {
        try {
          const target = new URL(headers.Location);
          if (target.hostname === "bongacams4.com" && target.pathname === "/track") {
            target.searchParams.set("v", "2");
            target.searchParams.set("c", BONGA_CAMPAIGN);
            headers = { ...headers, Location: target.toString() };
          }
        } catch (_) {}
      }
      return originalWriteHead(statusCode, headers, ...rest);
    };
    return handler(req, res);
  });
};

/* NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6 */
require("./start.js");
