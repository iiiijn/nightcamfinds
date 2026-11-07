const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const bongacash = require("./bongacash");
const { isSameOriginRequest } = require("./src/services/country-settings-origin.cjs");
const { validateCountryPlatformPayload } = require("./src/services/country-settings-validation.cjs");
const { isValidIsoDate, validateDailyEntry } = require("./src/services/bongacash-reconciliation.cjs");
const { classifyUserAgent, normalizeEvent, nairobiWeekBounds, createEngagementRateLimiter } = require("./src/services/traffic-quality.cjs");
const clickOrigins = require("./src/services/click-origins.cjs");
const campaignPerformance = require("./src/services/campaign-performance.cjs");
const conversionRevenue = require("./src/services/conversion-revenue.cjs");
const providerHealth = require("./src/services/provider-attribution-health.cjs");
const trafficRevenuePerformance = require("./src/services/traffic-revenue-performance.cjs");
const { cleanRoomTitle, filterDisplayableRooms } = require("./src/services/room-quality.cjs");
const allowEngagement = createEngagementRateLimiter();

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
  const rawGender = String(room.gender || room.sex || "").trim().toLowerCase();
  const gender = /^(?:trans|transgender|t)$/.test(rawGender) ? "trans"
    : /^(?:male|man|men|m)$/.test(rawGender) ? "male"
    : /^(?:female|woman|women|f)$/.test(rawGender) ? "female"
    : /^(?:couple|couples|c)$/.test(rawGender) ? "couples" : "";
  const country = String(room.homecountry || room.country || room.country_code || "").toUpperCase().match(/^[A-Z]{2}$/)?.[0] || "";
  const viewers = Number(room.members_count ?? room.num_users ?? room.viewers ?? room.viewer_count ?? 0) || 0;
  const topic = cleanRoomTitle(text(room.chat_topic || room.room_subject || room.topic || (Array.isArray(room.tags) ? room.tags.join(", ") : room.tags)));
  const href = room.chat_url || room.direct_chat_url || room.room_url || room.url || "";
  return { id: `bongacams:${username}`, platform: "bongacams", platformName: "BongaCams", username, displayName: cleanRoomTitle(text(room.display_name || room.name || username)) || username, gender, country, countryName: country, location: text(room.hometown || room.location || room.homecountry), viewerCount: viewers, isHd: Boolean(room.hd_cam || room.hd || /\bhd\b/i.test(topic)), isNew: Boolean(room.is_new || room.new), image: imageFrom(room), roomSubject: topic, languages: text(room.primary_language || room.language || room.languages), href };
}

async function bongaRooms() {
  const api = process.env.BONGACAMS_API_BASE || "https://bngprm.com/promo.php";
  const query = new URLSearchParams({ c: BONGA_CAMPAIGN, type: "api", api_v: "1", limit: "10", api_type: "json" });
  const data = await getJson(`${api}?${query.toString()}`);
  const rows = Array.isArray(data) ? data : (data.results || data.rooms || data.data || data.models || []);
  const normalized = rows.map(normalizeBonga).filter(Boolean);
  const rooms = filterDisplayableRooms(normalized);
  console.log(`BongaCams API returned ${rooms.length} validated rooms`);
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
    bongacashTrackingVerified: false,
    platforms: { chaturbate: cbClicks, bongacams: bongaClicks },
    sources,
    countries: combinedCountries,
    placements,
    devices
  };
}

http.createServer = function routeDashboard(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");

    if (incoming.pathname === "/api/engage") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
      if (!isSameOriginRequest(req.headers)) return sendJson(res, 403, { error: "Origin check failed." });
      if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) return sendJson(res, 415, { error: "Use application/json." });
      if (!pool) return sendJson(res, 503, { error: "Traffic engagement storage is not configured." });
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 2500) return sendJson(res, 413, { error: "Request too large." }); }
      let payload;
      try { payload = JSON.parse(body || "{}"); } catch { return sendJson(res, 400, { error: "Invalid JSON." }); }
      const validation = normalizeEvent(payload);
      if (validation.error) return sendJson(res, 400, { error: validation.error });
      const event = validation.value;
      if (!allowEngagement(event.visitId)) return sendJson(res, 429, { error: "Engagement event rate limit reached." });
      const cleanLabel = (value, fallback, max) => String(value || "").trim().replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max) || fallback;
      const country = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || req.headers["cloudfront-viewer-country"] || "UNKNOWN").toUpperCase().match(/^[A-Z]{2}$/)?.[0] || "UNKNOWN";
      const trafficClass = classifyUserAgent(req.headers["user-agent"]);
      const landingPath = String(payload.landingPath || event.pagePath).trim();
      const safeLandingPath = landingPath.startsWith("/") && !landingPath.startsWith("//") && landingPath.length <= 255 && !/[\\r\\n]/.test(landingPath) ? landingPath : event.pagePath;
      try {
        const visit = await pool.query(
          `INSERT INTO traffic_visits (visit_id,country,platform,source,medium,campaign,content,placement,landing_path,traffic_class,last_seen_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT (visit_id) DO UPDATE SET
             traffic_class = CASE
               WHEN traffic_visits.traffic_class = 'known_bot' OR EXCLUDED.traffic_class = 'known_bot' THEN 'known_bot'
               WHEN traffic_visits.traffic_class = 'suspected_bot' OR EXCLUDED.traffic_class = 'suspected_bot' THEN 'suspected_bot'
               ELSE 'unverified'
             END,
             last_seen_at=NOW()
           RETURNING traffic_class`,
          [event.visitId,country,cleanLabel(payload.platform,"unknown",30),cleanLabel(payload.source,"direct",40),cleanLabel(payload.medium,"unknown",80),cleanLabel(payload.campaign,"unknown",80),cleanLabel(payload.content,"",120),cleanLabel(payload.placement,"unknown",80),safeLandingPath,trafficClass]
        );
        const effectiveTrafficClass = visit.rows[0]?.traffic_class || trafficClass;
        const saved = await pool.query(
          `INSERT INTO traffic_engagement_events (visit_id,event_type,page_path)
           SELECT $1,$2,$3 WHERE $4 = 'unverified'
           ON CONFLICT (visit_id,event_type,page_path) DO NOTHING RETURNING event_id`,
          [event.visitId,event.eventType,event.pagePath,effectiveTrafficClass]
        );
        return sendJson(res, 202, { accepted: true, eligibleForEngagementMetrics: effectiveTrafficClass === "unverified", duplicate: saved.rowCount === 0, trafficClass: effectiveTrafficClass });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Traffic quality database migration 006 is not installed. No production migration has been applied." });
        console.error("Traffic engagement failed:", err.message);
        return sendJson(res, 500, { error: "Could not record engagement." });
      }
    }
    if (incoming.pathname === "/api/traffic-quality-analytics") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const bounds = nairobiWeekBounds();
      try {
        const visits = await pool.query(
          `SELECT traffic_class, COUNT(*)::int AS visits
           FROM traffic_visits WHERE first_seen_at >= $1 AND first_seen_at < $2
           GROUP BY traffic_class`, [bounds.from, bounds.toExclusive]
        );
        const engagement = await pool.query(
          `SELECT COUNT(DISTINCT e.visit_id)::int AS engaged_visits,
                  COUNT(*)::int AS events
           FROM traffic_engagement_events e
           JOIN traffic_visits v ON v.visit_id=e.visit_id
           WHERE e.occurred_at >= $1 AND e.occurred_at < $2
             AND v.traffic_class='unverified'`, [bounds.from, bounds.toExclusive]
        );
        const clickQuality = await pool.query(
          `SELECT CASE
                    WHEN v.traffic_class IN ('known_bot','suspected_bot','unverified') THEN v.traffic_class
                    ELSE 'unclassified'
                  END AS traffic_class,
                  CASE
                    WHEN c.visit_id IS NULL THEN 'missing_visit_id'
                    WHEN v.visit_id IS NULL THEN 'missing_visit_record'
                    ELSE 'linked'
                  END AS linkage_status,
                  COUNT(*)::int AS clicks
           FROM affiliate_clicks c
           LEFT JOIN traffic_visits v ON v.visit_id=c.visit_id
           WHERE c.clicked_at >= $1 AND c.clicked_at < $2
           GROUP BY 1, 2`, [bounds.from, bounds.toExclusive]
        );
        const clickCounts = {};
        const unlinkedClickCounts = { missingVisitId: 0, missingVisitRecord: 0 };
        for (const row of clickQuality.rows) {
          clickCounts[row.traffic_class] = (clickCounts[row.traffic_class] || 0) + Number(row.clicks || 0);
          if (row.linkage_status === 'missing_visit_id') unlinkedClickCounts.missingVisitId += Number(row.clicks || 0);
          if (row.linkage_status === 'missing_visit_record') unlinkedClickCounts.missingVisitRecord += Number(row.clicks || 0);
        }
        const counts = Object.fromEntries(visits.rows.map(row => [row.traffic_class, Number(row.visits || 0)]));
        return sendJson(res, 200, {
          timezone: "Africa/Nairobi", from: bounds.from, toExclusive: bounds.toExclusive,
          knownBots: counts.known_bot || 0, suspectedBots: counts.suspected_bot || 0,
          unverifiedBrowserVisits: counts.unverified || 0,
          unverifiedEngagedVisits: Number(engagement.rows[0]?.engaged_visits || 0),
          engagementEvents: Number(engagement.rows[0]?.events || 0),
          trackedAffiliateRedirects: Object.values(clickCounts).reduce((sum, value) => sum + value, 0),
          knownBotAffiliateClicks: clickCounts.known_bot || 0,
          suspectedBotAffiliateClicks: clickCounts.suspected_bot || 0,
          unverifiedAffiliateClicks: clickCounts.unverified || 0,
          unclassifiedAffiliateClicks: clickCounts.unclassified || 0,
          clicksWithoutVisitId: unlinkedClickCounts.missingVisitId,
          clicksWithMissingVisitRecord: unlinkedClickCounts.missingVisitRecord,
          note: "These are tracked affiliate redirects, not verified human clicks. Known and suspected automation are separated. Unverified browser traffic is not proof of human visitors. Unclassified redirects are clicks without a usable visit record. Most missing-visit-ID clicks may be legacy records from before visit tracking was introduced; they cannot be retrospectively classified. A missing visit record with an ID indicates a linkage issue that should be investigated."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Traffic quality database migration 006 is not installed. No production migration has been applied." });
        console.error("Traffic quality analytics failed:", err.message);
        return sendJson(res, 500, { error: "Could not load traffic quality analytics." });
      }
    }
    if (incoming.pathname === "/api/provider-attribution-health") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const queries = providerHealth.buildQueries(Object.fromEntries(incoming.searchParams.entries()));
      if (queries.error) return sendJson(res, 400, { error: queries.error });
      try {
        const [callbacks, clicks] = await Promise.all([
          pool.query(queries.callbacks.text, queries.callbacks.params),
          pool.query(queries.clicks.text, queries.clicks.params)
        ]);
        const c = callbacks.rows[0] || {};
        const byPlatform = { chaturbate: 0, bongacams: 0, other: 0 };
        for (const row of clicks.rows) {
          const platform = String(row.platform || "").toLowerCase();
          const count = Number(row.clicks || 0);
          if (platform === "chaturbate") byPlatform.chaturbate += count;
          else if (platform === "bongacams") byPlatform.bongacams += count;
          else byPlatform.other += count;
        }
        return sendJson(res, 200, {
          callbacks: {
            total: Number(c.total || 0), real: Number(c.real || 0), test: Number(c.test || 0),
            matched: Number(c.matched || 0), missingClickId: Number(c.missing_click_id || 0),
            clickIdNotFound: Number(c.click_id_not_found || 0)
          },
          clicks: byPlatform,
          filters: queries.filters,
          timezone: "UTC",
          notes: {
            chaturbate: "Callback counts describe received postback rows, not verified cash received. Duplicate transaction IDs are prevented by the existing unique constraint.",
            bongacash: "BongaCash clicks are recorded redirects only. No automatic conversion postback is configured; use the separate manual reconciliation report."
          }
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Attribution health requires the existing affiliate click and Chaturbate conversion tables." });
        console.error("Provider attribution health failed:", err.message);
        return sendJson(res, 500, { error: "Could not load provider attribution health." });
      }
    }
    if (incoming.pathname === "/api/campaign-performance") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const query = campaignPerformance.buildQuery(Object.fromEntries(incoming.searchParams.entries()));
      if (query.error) return sendJson(res, 400, { error: query.error });
      try {
        const result = await pool.query(query.text, query.params);
        return sendJson(res, 200, {
          rows: result.rows.map(row => ({
            country: row.country,
            platform: row.platform,
            source: row.source,
            campaign: row.campaign,
            clicks: Number(row.clicks || 0)
          })),
          filters: query.filters,
          truncated: result.rows.length === 2000,
          timezone: "UTC",
          note: "Recorded affiliate redirects grouped by country, platform, source and campaign. These are not verified human visitors or confirmed conversions."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Campaign performance report requires the existing affiliate click attribution columns." });
        console.error("Campaign performance analytics failed:", err.message);
        return sendJson(res, 500, { error: "Could not load campaign performance." });
      }
    }
    if (incoming.pathname === "/api/traffic-revenue-performance") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const query = trafficRevenuePerformance.buildQuery(Object.fromEntries(incoming.searchParams.entries()));
      if (query.error) return sendJson(res, 400, { error: query.error });
      try {
        const clicks = await pool.query(query.text, query.params.clicks);
        return sendJson(res, 200, {
          rows: clicks.rows.map(row => ({
            country: row.country,
            platform: row.platform,
            source: row.source,
            campaign: row.campaign,
            clicks: Number(row.clicks || 0),
            matchedConversions: Number(row.matched_conversions || 0),
            conversionRate: Number(row.clicks || 0) > 0 ? Number(row.matched_conversions || 0) / Number(row.clicks) : 0,
            reportedPayoutsByCurrency: row.reported_payouts_by_currency || {}
          })),
          filters: query.filters,
          truncated: clicks.rows.length === 2000,
          timezone: "UTC",
          note: "Clicks are recorded redirects. Only non-test Chaturbate postback events with a stored matched click ID are attributed to campaign groups. Unmatched events remain in the separate conversion and provider-health reports. BongaCams conversions and earnings are not assigned to campaigns because BongaCash is manually reconciled and does not provide an automatic postback in this setup. Payouts remain separated by currency and are provider-reported, not verified cash received."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Traffic-to-revenue report requires the existing affiliate click and Chaturbate conversion attribution tables." });
        console.error("Traffic-to-revenue performance failed:", err.message);
        return sendJson(res, 500, { error: "Could not load traffic-to-revenue performance." });
      }
    }
    if (incoming.pathname === "/api/conversion-revenue") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const query = conversionRevenue.buildQuery(Object.fromEntries(incoming.searchParams.entries()));
      if (query.error) return sendJson(res, 400, { error: query.error });
      try {
        const result = await pool.query(query.text, query.params);
        return sendJson(res, 200, {
          rows: result.rows.map(row => ({
            country: row.country,
            platform: row.platform,
            source: row.source,
            campaign: row.campaign,
            conversionType: row.conversion_type,
            currency: row.currency,
            matchStatus: row.match_status,
            isTest: Boolean(row.is_test),
            conversions: Number(row.conversions || 0),
            matchedConversions: Number(row.matched_conversions || 0),
            unmatchedConversions: Number(row.unmatched_conversions || 0),
            reportedPayout: String(row.reported_payout || "0")
          })),
          filters: query.filters,
          truncated: result.rows.length === 2000,
          timezone: "UTC",
          note: "Chaturbate postback events only. Payouts remain separated by currency. Matched means the stored postback was linked to a tracked click ID. BongaCash manual daily reconciliation is displayed separately and is not included in this event report."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Conversion report requires the existing Chaturbate postback tables and click attribution schema." });
        console.error("Conversion revenue report failed:", err.message);
        return sendJson(res, 500, { error: "Could not load conversion and revenue report." });
      }
    }
    if (incoming.pathname === "/api/click-origins") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const parsed = clickOrigins.parseFilters(incoming.searchParams);
      if (parsed.error) return sendJson(res, 400, { error: parsed.error });
      try {
        const query = clickOrigins.buildQuery(parsed.value);
        const result = await pool.query(query.text, query.params);
        return sendJson(res, 200, {
          rows: result.rows.map(row => ({
            date: String(row.date).slice(0, 10),
            country: row.country,
            platform: row.platform,
            category: row.category,
            source: row.source,
            medium: row.medium,
            campaign: row.campaign,
            content: row.content,
            placement: row.placement,
            landingPath: row.landing_path,
            device: row.device,
            clicks: Number(row.clicks || 0)
          })),
          filters: parsed.value,
          truncated: result.rows.length === 2000,
          timezone: "UTC",
          note: "These are recorded affiliate redirects, not verified human visitors or confirmed conversions. Unknown and direct sources are shown as recorded; source attribution may be absent or inaccurate for older clicks."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Click origins report requires the existing affiliate click attribution columns." });
        console.error("Click origins analytics failed:", err.message);
        return sendJson(res, 500, { error: "Could not load click origins report." });
      }
    }
    if (incoming.pathname === "/api/recent-room-clicks") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      const platform = String(incoming.searchParams.get("platform") || "ALL").trim().toLowerCase();
      if (!["all", "chaturbate", "bongacams"].includes(platform)) return sendJson(res, 400, { error: "Platform must be ALL, chaturbate or bongacams." });
      const rawLimit = incoming.searchParams.get("limit");
      const limit = rawLimit === null ? 50 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return sendJson(res, 400, { error: "Limit must be a whole number from 1 to 100." });
      const params = [];
      const platformClause = platform === "all" ? "" : (params.push(platform), " AND LOWER(platform) = $" + params.length);
      params.push(limit);
      try {
        const result = await pool.query(
          "SELECT clicked_at, country, category, LOWER(platform) AS platform, source, campaign, placement, content, landing_path, click_id FROM affiliate_clicks WHERE LOWER(content) LIKE 'room-%'" + platformClause + " ORDER BY clicked_at DESC, id DESC LIMIT $" + params.length,
          params
        );
        return sendJson(res, 200, {
          rows: result.rows.map(row => ({
            clickedAt: row.clicked_at,
            country: row.country,
            category: row.category,
            platform: row.platform,
            source: row.source,
            campaign: row.campaign,
            placement: row.placement,
            room: String(row.content || "").replace(/^room-/i, ""),
            landingPath: row.landing_path || null,
            clickId: row.click_id || null
          })),
          limit,
          timezone: "UTC",
          note: "Recent room-level affiliate redirects only. These are recorded clicks, not verified human visitors or confirmed conversions. No IP address or raw user-agent data is exposed."
        });
      } catch (err) {
        if (err.code === "42P01" || err.code === "42703") return sendJson(res, 503, { error: "Recent room clicks require the current affiliate click attribution schema." });
        console.error("Recent room click report failed:", err.message);
        return sendJson(res, 500, { error: "Could not load recent room clicks." });
      }
    }
    if (incoming.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        databaseConfigured: Boolean(databaseUrl),
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
      return sendJson(res, 410, { error: "BongaCash postbacks are not supported. Use manual affiliate-report reconciliation." });
    }
    if (incoming.pathname === "/api/country-platform-settings") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
      if (req.method === "POST") {
        if (!isSameOriginRequest(req.headers)) return sendJson(res, 403, { error: "Origin check failed." });
        if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) return sendJson(res, 415, { error: "Use application/json." });
      }
      let payload;
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) { body += chunk; if (body.length > 12000) return sendJson(res, 413, { error: "Request too large." }); }
        try { payload = JSON.parse(body || "{}"); } catch { return sendJson(res, 400, { error: "Invalid JSON." }); }
        const validation = validateCountryPlatformPayload(payload);
        if (validation.error) return sendJson(res, 400, { error: validation.error });
      }
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      try {
        if (req.method === "GET") {
          const result = await pool.query("SELECT country_code, preferred_platform, status, hypothesis, approved_at, updated_at FROM country_platform_settings WHERE country_code = ANY($1::char(2)[]) ORDER BY country_code", [["US","GB","CA","AU","DE","FR","NL"]]);
          const byCountry = Object.fromEntries(result.rows.map(row => [String(row.country_code).trim(), row]));
          return sendJson(res, 200, { settings: ["US","GB","CA","AU","DE","FR","NL"].map(country => byCountry[country] || { country_code: country, preferred_platform: null, status: "hypothesis", hypothesis: "", approved_at: null, notConfigured: true }) });
        }
        const { country, platform, action, hypothesis, status } = payload ? validateCountryPlatformPayload(payload).value : {};
        const approvedAt = action === "approve" ? new Date() : null;
        const saved = await pool.query(
          `INSERT INTO country_platform_settings (country_code, preferred_platform, status, hypothesis, approved_at, updated_by, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())
           ON CONFLICT (country_code) DO UPDATE SET preferred_platform=EXCLUDED.preferred_platform,status=EXCLUDED.status,
             hypothesis=EXCLUDED.hypothesis,approved_at=EXCLUDED.approved_at,updated_by=EXCLUDED.updated_by,updated_at=NOW()
           RETURNING country_code,preferred_platform,status,hypothesis,approved_at,updated_at`,
          [country, platform, status, hypothesis, approvedAt, ADMIN_USER]
        );
        return sendJson(res, 200, { setting: saved.rows[0] });
      } catch (err) {
        if (err.code === "42P01") return sendJson(res, 503, { error: "Country settings schema is not installed. Production migration has not been applied." });
        console.error("Country platform settings failed:", err.message);
        return sendJson(res, 500, { error: "Could not process country settings." });
      }
    }
    if (incoming.pathname === "/api/bongacash-reconciliation") {
      if (!validDashboardSession(req)) return sendJson(res, 401, { error: "Unauthorized" });
      if (!pool) return sendJson(res, 503, { error: "Database is not configured." });
      if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
      if (req.method === "POST") {
        if (!isSameOriginRequest(req.headers)) return sendJson(res, 403, { error: "Origin check failed." });
        if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) return sendJson(res, 415, { error: "Use application/json." });
      }
      try {
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) { body += chunk; if (body.length > 4000) return sendJson(res, 413, { error: "Request too large." }); }
          let payload;
          try { payload = JSON.parse(body || "{}"); } catch { return sendJson(res, 400, { error: "Invalid JSON." }); }
          const validation = validateDailyEntry(payload);
          if (validation.error) return sendJson(res, 400, { error: validation.error });
          const { date: reportDate, registrations, purchases, earnings, notes } = validation.value;
          const saved = await pool.query(
            `INSERT INTO bongacash_daily_reconciliation
              (report_date, registrations, purchases, earnings, notes, updated_by, updated_at)
             VALUES ($1::date, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (report_date) DO UPDATE SET
               registrations=EXCLUDED.registrations, purchases=EXCLUDED.purchases,
               earnings=EXCLUDED.earnings, notes=EXCLUDED.notes,
               updated_by=EXCLUDED.updated_by, updated_at=NOW()
             RETURNING report_date, registrations, purchases, earnings, notes, updated_at`,
            [reportDate, registrations, purchases, earnings, notes, ADMIN_USER]
          );
          return sendJson(res, 200, { saved: saved.rows[0] });
        }
        const from = incoming.searchParams.get("from");
        const to = incoming.searchParams.get("to");
        if ((from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) return sendJson(res, 400, { error: "Invalid date range." });
        if (from && to && from > to) return sendJson(res, 400, { error: "Start date must be on or before end date." });
        const clauses = [], params = [];
        if (from) { params.push(from); clauses.push(`report_date >= $${params.length}::date`); }
        if (to) { params.push(to); clauses.push(`report_date <= $${params.length}::date`); }
        const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
        const totals = await pool.query(
          `SELECT COALESCE(SUM(registrations),0)::int AS registrations,
                  COALESCE(SUM(purchases),0)::int AS purchases,
                  COALESCE(SUM(earnings),0)::numeric AS earnings,
                  COUNT(*)::int AS days_reported
           FROM bongacash_daily_reconciliation ${where}`, params
        );
        const entries = await pool.query(
          `SELECT report_date, registrations, purchases, earnings, notes, updated_at
           FROM bongacash_daily_reconciliation ${where}
           ORDER BY report_date DESC LIMIT 90`, params
        );
        return sendJson(res, 200, { totals: totals.rows[0], entries: entries.rows });
      } catch (err) {
        if (err.code === "42P01") return sendJson(res, 503, { error: "BongaCash reconciliation schema is not installed. Production migration 005 has not been applied." });
        console.error("BongaCash reconciliation failed:", err.message);
        return sendJson(res, 500, { error: "Could not process BongaCash reconciliation." });
      }
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
