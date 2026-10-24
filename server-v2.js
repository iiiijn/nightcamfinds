const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { FeedCache } = require("./providers/feed-cache");
const chaturbate = require("./providers/chaturbate");
const bongacams = require("./providers/bongacams");

let Pool = null;
try { ({ Pool } = require("pg")); } catch (_) {}
const pgPool = Pool && process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, max: 5 }) : null;

const PORT = Number(process.env.PORT || 8787);
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const STATS = path.join(DATA_DIR, "clicks.json");
const ORIGIN = String(process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const CB_CAMPAIGN = process.env.CB_CAMPAIGN || process.env.CHATURBATE_WM || "C6yxN";
const CB_LIMIT = Math.max(1, Math.min(500, Number(process.env.CHATURBATE_LIMIT || 100)));
const BONGA_CAMPAIGN = process.env.BONGACAMS_CAMPAIGN || process.env.BONGACASH_CAMPAIGN || "840970";
const BONGA_LIMIT = Math.max(10, Math.min(500, Number(process.env.BONGACAMS_LIMIT || 100)));
const BONGA_ENABLED = process.env.BONGACAMS_ENABLED !== "false";
const STATS_KEY = process.env.STATS_KEY || "";
const CONTACT = process.env.CONTACT_EMAIL || "";
const CACHE = new FeedCache({ ttlMs: 15000, staleMs: 120000 });

const MARKETS = [
  ["us", "US", "United States"], ["gb", "GB", "United Kingdom"], ["ca", "CA", "Canada"],
  ["au", "AU", "Australia"], ["de", "DE", "Germany"], ["fr", "FR", "France"], ["nl", "NL", "Netherlands"],
  ["ie", "IE", "Ireland"], ["nz", "NZ", "New Zealand"], ["se", "SE", "Sweden"], ["no", "NO", "Norway"],
  ["dk", "DK", "Denmark"], ["fi", "FI", "Finland"], ["ch", "CH", "Switzerland"], ["at", "AT", "Austria"],
  ["be", "BE", "Belgium"], ["jp", "JP", "Japan"], ["sg", "SG", "Singapore"]
];
const NAMES = Object.fromEntries(MARKETS.map(([, iso, name]) => [iso, name]));

function cleanLabel(value, fallback = "unknown", max = 80) {
  const v = String(value || "").trim().replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max);
  return v || fallback;
}

function visitorIp(req) {
  const values = [req.headers["cf-connecting-ip"], req.headers["x-real-ip"], String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()];
  for (const value of values) {
    const ip = String(value || "").trim();
    if (/^[0-9a-f:.]+$/i.test(ip) && ip !== "::1" && ip !== "127.0.0.1") return ip;
  }
  return "request_ip";
}

function visitorCountry(req) {
  for (const key of ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code"]) {
    const iso = String(req.headers[key] || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso;
  }
  return "UNKNOWN";
}

function device(req) { return /mobile|android|iphone|ipad/i.test(String(req.headers["user-agent"] || "")) ? "mobile" : "desktop"; }
function pageOrigin(req) { return ORIGIN || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`; }
function send(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Cache-Control": "no-store" });
  res.end(body);
}


async function ensureAffiliateSchema() {
  if (!pgPool) return;
  await pgPool.query(\`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id BIGSERIAL PRIMARY KEY, click_id VARCHAR(128) UNIQUE, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    platform VARCHAR(30) NOT NULL, country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    device VARCHAR(32) NOT NULL DEFAULT 'unknown', source VARCHAR(80) NOT NULL DEFAULT 'direct',
    medium VARCHAR(80) NOT NULL DEFAULT 'unknown', campaign VARCHAR(120) NOT NULL DEFAULT 'unknown',
    content VARCHAR(120) NOT NULL DEFAULT '', landing_path VARCHAR(255) NOT NULL DEFAULT '/',
    category VARCHAR(80) NOT NULL DEFAULT 'all', placement VARCHAR(120) NOT NULL DEFAULT 'unknown',
    room_id VARCHAR(255))\`);
  await pgPool.query(\`CREATE TABLE IF NOT EXISTS affiliate_conversions (
    id BIGSERIAL PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), platform VARCHAR(30) NOT NULL,
    click_id VARCHAR(128), transaction_id VARCHAR(255) NOT NULL, conversion_type VARCHAR(100) NOT NULL DEFAULT 'unknown',
    payout NUMERIC(18,6) NOT NULL DEFAULT 0, currency VARCHAR(16) NOT NULL DEFAULT 'USD', amount NUMERIC(18,6),
    country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', event_timestamp TIMESTAMPTZ, matched_click BOOLEAN NOT NULL DEFAULT FALSE,
    revenue_class VARCHAR(40) NOT NULL DEFAULT 'other', track VARCHAR(120), source VARCHAR(120),
    program_id VARCHAR(120), user_id VARCHAR(120), raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(platform,transaction_id))\`);
  for (const sql of [
    "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS revenue_class VARCHAR(40) NOT NULL DEFAULT 'other'",
    "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS track VARCHAR(120)",
    "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS source VARCHAR(120)",
    "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS program_id VARCHAR(120)",
    "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS user_id VARCHAR(120)",
    "CREATE INDEX IF NOT EXISTS affiliate_conversions_click_id_idx ON affiliate_conversions(click_id)",
    "CREATE INDEX IF NOT EXISTS affiliate_conversions_received_at_idx ON affiliate_conversions(received_at)"
  ]) await pgPool.query(sql);
}
function normalizePostback(q) {
  const read = k => String(q.get(k) || "").trim();
  const tx = read("transaction_id");
  if (!tx) { const e = new Error("transaction_id is required"); e.statusCode=400; throw e; }
  const type = read("type") || "unknown";
  const amount = read("amount") === "" ? null : Number(read("amount"));
  const payout = read("payout") === "" ? 0 : Number(read("payout"));
  if (!Number.isFinite(payout) || (amount !== null && !Number.isFinite(amount))) {
    const e = new Error("Invalid payout or amount"); e.statusCode=400; throw e;
  }
  const revshare = type === "revshare_purchase" || type === "revshare_payout-adjustment";
  const adjustment = type === "revshare_payout-adjustment";
  const broadcaster = type === "revshare_signup-referral";
  const affiliate = /affiliate|referral-income/i.test(type);
  const ts=read("timestamp"), parsed=ts?new Date(ts):null;
  return {
    platform:"chaturbate", clickId:read("click_id")||null, transactionId:tx, conversionType:type,
    payout,currency:read("currency")||"USD",amount,country:(read("country")||"UNKNOWN").toUpperCase(),
    eventTimestamp:parsed&&!Number.isNaN(parsed.getTime())?parsed.toISOString():null,
    track:read("track"),source:read("source"),programId:read("program_id"),userId:read("user_id"),
    revenueClass:adjustment?"revshare_adjustment":revshare?"revshare":broadcaster?"broadcaster_referral":affiliate?"affiliate_referral":"other",
    rawPayload:Object.fromEntries(q.entries())
  };
}
async function savePostback(q) {
  if (!pgPool) throw new Error("Database is not configured");
  await ensureAffiliateSchema();
  const c=normalizePostback(q);
  const match=c.clickId ? await pgPool.query("SELECT 1 FROM affiliate_clicks WHERE click_id=$1 LIMIT 1",[c.clickId]).catch(()=>({rows:[]})) : {rows:[]};
  const result=await pgPool.query(\`INSERT INTO affiliate_conversions
    (platform,click_id,transaction_id,conversion_type,payout,currency,amount,country,event_timestamp,matched_click,revenue_class,track,source,program_id,user_id,raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
    ON CONFLICT(platform,transaction_id) DO NOTHING RETURNING id\`,
    [c.platform,c.clickId,c.transactionId,c.conversionType,c.payout,c.currency,c.amount,c.country,c.eventTimestamp,match.rows.length>0,c.revenueClass,c.track,c.source,c.programId,c.userId,JSON.stringify(c.rawPayload)]);
  return {ok:true,inserted:result.rowCount>0,duplicate:result.rowCount===0,matched:match.rows.length>0,revenueClass:c.revenueClass};
}
async function revenueStats(url) {
  if (!pgPool) throw new Error("Database is not configured");
  await ensureAffiliateSchema();
  const from=url.searchParams.get("from"),to=url.searchParams.get("to"),platform=url.searchParams.get("platform");
  const eparams=[],efilters=[];
  const add=(params,filters,v,sql)=>{params.push(v);filters.push(sql.replace("?", "$"+params.length));};
  if(from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add(eparams,efilters,from,"received_at >= ?::date");
  if(to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add(eparams,efilters,to,"received_at < (?::date + INTERVAL '1 day')");
  if(["chaturbate","bongacams"].includes(platform)) add(eparams,efilters,platform,"platform = ?");
  const ew=efilters.length?"WHERE "+efilters.join(" AND "):"";
  const summary=(await pgPool.query(\`SELECT COUNT(*)::int events,
    COUNT(*) FILTER (WHERE matched_click)::int matched,
    COUNT(*) FILTER (WHERE revenue_class='revshare')::int revshare_events,
    COUNT(*) FILTER (WHERE revenue_class='broadcaster_referral')::int broadcaster_events,
    COUNT(*) FILTER (WHERE revenue_class='affiliate_referral')::int affiliate_events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revshare_revenue,
    COALESCE(SUM(payout),0)::numeric total_revenue
    FROM affiliate_conversions \${ew}\`,eparams)).rows[0]||{};
  const byCountry=(await pgPool.query(\`SELECT country,COUNT(*)::int events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revshare_revenue
    FROM affiliate_conversions \${ew} GROUP BY country
    ORDER BY SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')) DESC NULLS LAST LIMIT 50\`,eparams)).rows;
  const bySource=(await pgPool.query(\`SELECT COALESCE(NULLIF(source,''),'unknown') source,COUNT(*)::int events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revshare_revenue
    FROM affiliate_conversions \${ew} GROUP BY source
    ORDER BY SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')) DESC NULLS LAST LIMIT 50\`,eparams)).rows;
  const cparams=[],cfilters=[];
  if(from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add(cparams,cfilters,from,"clicked_at >= ?::date");
  if(to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add(cparams,cfilters,to,"clicked_at < (?::date + INTERVAL '1 day')");
  if(["chaturbate","bongacams"].includes(platform)) add(cparams,cfilters,platform,"platform = ?");
  const cw=cfilters.length?"WHERE "+cfilters.join(" AND "):"";
  const clicks=Number((await pgPool.query(\`SELECT COUNT(*)::int n FROM affiliate_clicks \${cw}\`,cparams)).rows[0]?.n||0);
  const revshareRevenue=Number(summary.revshare_revenue||0);
  return {clicks,events:Number(summary.events||0),matchedEvents:Number(summary.matched||0),unmatchedEvents:Number(summary.events||0)-Number(summary.matched||0),
    revshareEvents:Number(summary.revshare_events||0),broadcasterReferralEvents:Number(summary.broadcaster_events||0),
    affiliateReferralEvents:Number(summary.affiliate_events||0),revshareRevenue,totalRevenue:Number(summary.total_revenue||0),
    revshareEpc:clicks?revshareRevenue/clicks:0,
    byCountry:byCountry.map(r=>({country:r.country,events:Number(r.events),revshareRevenue:Number(r.revshare_revenue)})),
    bySource:bySource.map(r=>({source:r.source,events:Number(r.events),revshareRevenue:Number(r.revshare_revenue)}))};
}
function readStats() { try { return JSON.parse(fs.readFileSync(STATS, "utf8")); } catch { return { total: 0, countries: {}, byCountryCategory: {}, byCountrySource: {}, byPlatform: {}, updatedAt: null }; } }
function writeStats(stats) { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = `${STATS}.tmp`; fs.writeFileSync(tmp, JSON.stringify(stats, null, 2)); fs.renameSync(tmp, STATS); }

async function ensureClickTable() {
  if (!pgPool) return;
  await pgPool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (id BIGSERIAL PRIMARY KEY, click_id VARCHAR(128) UNIQUE, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), platform VARCHAR(30) NOT NULL, country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', device VARCHAR(32) NOT NULL DEFAULT 'unknown', source VARCHAR(80) NOT NULL DEFAULT 'direct', medium VARCHAR(80) NOT NULL DEFAULT 'unknown', campaign VARCHAR(120) NOT NULL DEFAULT 'unknown', content VARCHAR(120) NOT NULL DEFAULT '', landing_path VARCHAR(255) NOT NULL DEFAULT '/', category VARCHAR(80) NOT NULL DEFAULT 'all', placement VARCHAR(120) NOT NULL DEFAULT 'unknown', room_id VARCHAR(255))`);
}

async function recordClick(data) {
  if (pgPool) {
    try { await ensureClickTable(); await pgPool.query(`INSERT INTO affiliate_clicks (click_id,platform,country,device,source,medium,campaign,content,landing_path,category,placement,room_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (click_id) DO NOTHING`, [data.clickId,data.platform,data.country,data.device,data.source,data.medium,data.campaign,data.content,data.landingPath,data.category,data.placement,data.roomId]); return; } catch (err) { console.error("click DB write failed:", err.message); }
  }
  const s = readStats();
  s.total = (s.total || 0) + 1;
  s.countries[data.country] = (s.countries[data.country] || 0) + 1;
  const cc = `${data.country}:${data.category}`; s.byCountryCategory[cc] = (s.byCountryCategory[cc] || 0) + 1;
  const cs = `${data.country}:${data.source}`; s.byCountrySource[cs] = (s.byCountrySource[cs] || 0) + 1;
  s.byPlatform[data.platform] = (s.byPlatform[data.platform] || 0) + 1;
  s.updatedAt = new Date().toISOString(); writeStats(s);
}

async function statsFromDb() {
  if (!pgPool) return null;
  try {
    await ensureClickTable();
    const q = async sql => (await pgPool.query(sql)).rows;
    const countries = {}; for (const r of await q("SELECT country,COUNT(*)::int count FROM affiliate_clicks GROUP BY country ORDER BY count DESC")) countries[r.country] = r.count;
    const byCountryCategory = {}; for (const r of await q("SELECT country,category,COUNT(*)::int count FROM affiliate_clicks GROUP BY country,category ORDER BY count DESC")) byCountryCategory[`${r.country}:${r.category}`] = r.count;
    const byCountrySource = {}; for (const r of await q("SELECT country,source,COUNT(*)::int count FROM affiliate_clicks GROUP BY country,source ORDER BY count DESC")) byCountrySource[`${r.country}:${r.source}`] = r.count;
    const byPlatform = {}; for (const r of await q("SELECT platform,COUNT(*)::int count FROM affiliate_clicks GROUP BY platform ORDER BY count DESC")) byPlatform[r.platform] = r.count;
    const total = Number((await q("SELECT COUNT(*)::int count FROM affiliate_clicks"))[0]?.count || 0);
    return { total, countries, byCountryCategory, byCountrySource, byPlatform, updatedAt: new Date().toISOString(), persistent: true };
  } catch (err) { console.error("stats DB read failed:", err.message); return null; }
}

async function loadRooms(req) {
  const ip = visitorIp(req);
  const country = visitorCountry(req);
  const key = country !== "UNKNOWN" ? `country:${country}` : `ip:${ip}`;
  const result = await CACHE.get(key, async () => {
    const jobs = [chaturbate.fetchRooms({ campaign: CB_CAMPAIGN, clientIp: ip, limit: CB_LIMIT })];
    if (BONGA_ENABLED) jobs.push(bongacams.fetchRooms({ campaign: BONGA_CAMPAIGN, limit: BONGA_LIMIT }));
    const results = await Promise.allSettled(jobs);
    const rooms = [];
    const notices = [];
    if (results[0].status === "fulfilled") rooms.push(...results[0].value.rooms); else notices.push("Chaturbate feed unavailable");
    if (BONGA_ENABLED) { if (results[1].status === "fulfilled") rooms.push(...results[1].value.rooms); else notices.push("BongaCams feed unavailable"); }
    if (!rooms.length && notices.length) throw new Error(notices.join(" · "));
    return rooms;
  });
  return { rooms: result.rooms, notice: result.error ? "Live feed temporarily using the last successful update." : "", stale: result.stale };
}

function legal(title, body) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/styles.css"></head><body><main class="wrap legal"><h1>${title}</h1>${body}<p><a href="/">Back to rooms</a></p></main></body></html>`; }

const pages = {
  "/about": legal("About NightCamFinds", `<p>NightCamFinds is an independent 18+ directory of public rooms from partner cam platforms. Video plays on the partner platform after you click through.</p><p>Room titles, thumbnails and viewer counts come from affiliate feeds and may change quickly.</p>`),
  "/affiliate-disclosure": legal("Affiliate disclosure", `<p>NightCamFinds participates in affiliate programs including Chaturbate and BongaCams. Tracked registrations or purchases may generate a commission for NightCamFinds.</p>`),
  "/privacy": legal("Privacy policy", `<p>NightCamFinds stores aggregate affiliate click analytics such as country, traffic source, category, device and platform. Clicking a room sends you to the partner platform, which has its own privacy policy and cookies.</p>`),
  "/terms": legal("Terms", `<p>You must be at least 18, or the age of majority where you live, whichever is higher. Do not use this directory where adult material is illegal.</p>`),
  "/contact": legal("Contact", CONTACT ? `<p>Operator email: <a href="mailto:${CONTACT}">${CONTACT}</a></p>` : `<p>Contact information is not configured yet.</p>`)
};

function sitemap(origin) {
  const paths = ["/", "/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/", "/broadcast", "/about", "/affiliate-disclosure", "/privacy", "/terms", "/contact", ...MARKETS.map(([slug]) => `/country/${slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`;
}

function trackedDestination(room, clickId, source, campaign, medium) {
  const fallback = room.platform === "bongacams" ? `https://bongacams4.com/track?c=${encodeURIComponent(BONGA_CAMPAIGN)}` : `https://chaturbate.com/in/?wm=${encodeURIComponent(CB_CAMPAIGN)}`;
  try {
    const u = new URL(room.href || fallback);
    u.searchParams.set("click_id", clickId);
    u.searchParams.set("source", source);
    u.searchParams.set("campaign", campaign);
    u.searchParams.set("medium", medium);
    return u.toString();
  } catch { return fallback; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  try {
    if (pathname === "/health") return send(res, 200, JSON.stringify({ ok: true, version: "2", providers: { chaturbate: true, bongacams: BONGA_ENABLED } }), "application/json");
    if (pathname === "/robots.txt") return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /bgo/\nDisallow: /api/\nSitemap: ${pageOrigin(req)}/sitemap.xml\n`, "text/plain");
    if (pathname === "/sitemap.xml") return send(res, 200, sitemap(pageOrigin(req)), "application/xml");
    if (pages[pathname]) return send(res, 200, pages[pathname]);

    if (pathname === "/api/rooms") {
      const feed = await loadRooms(req);
      const category = url.searchParams.get("category") || "all";
      const country = String(url.searchParams.get("country") || "").toUpperCase();
      const platform = String(url.searchParams.get("platform") || "").toLowerCase();
      const q = String(url.searchParams.get("q") || "").toLowerCase();
      const sort = url.searchParams.get("sort") || "recommended";
      let list = feed.rooms.slice();
      if (["female","male","trans","couples"].includes(category)) list = list.filter(r => r.gender === category);
      if (category === "hd") list = list.filter(r => r.isHd);
      if (category === "new") list = list.filter(r => r.isNew);
      if (country) list = list.filter(r => r.country === country);
      if (["chaturbate","bongacams"].includes(platform)) list = list.filter(r => r.platform === platform);
      if (q) list = list.filter(r => `${r.displayName} ${r.roomSubject} ${r.country} ${r.platformName}`.toLowerCase().includes(q));
      list.sort((a,b) => sort === "newest" ? Number(b.isNew)-Number(a.isNew) || b.viewerCount-a.viewerCount : b.viewerCount-a.viewerCount);
      const countries = [...new Set(feed.rooms.map(r => r.country).filter(Boolean))].sort();
      const platforms = [...new Set(feed.rooms.map(r => r.platform).filter(Boolean))].sort();
      return send(res, 200, JSON.stringify({ rooms: list.slice(0, 60), countries, platforms, notice: feed.notice }), "application/json");
    }


    if (pathname === "/cb/postback" && req.method === "GET") {
      if (!pgPool) return send(res,503,JSON.stringify({error:"Database is not configured"}),"application/json");
      try {
        const result=await savePostback(url.searchParams);
        return send(res,200,JSON.stringify(result),"application/json");
      } catch(err) {
        const status=Number(err.statusCode)||500;
        console.error("Chaturbate postback rejected:",err.message);
        return send(res,status,JSON.stringify({error:status===400?err.message:"Postback could not be saved"}),"application/json");
      }
    }
    if (pathname === "/api/revenue") {
      if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res,404,"Not found","text/plain");
      try { return send(res,200,JSON.stringify(await revenueStats(url)),"application/json"); }
      catch(err) { console.error("Revenue dashboard query failed:",err.message); return send(res,503,JSON.stringify({error:"Revenue data unavailable"}),"application/json"); }
    }


    if (pathname === "/cb/postback" && req.method === "GET") {
      if (!pgPool) return send(res,503,JSON.stringify({error:"Database is not configured"}),"application/json");
      try { return send(res,200,JSON.stringify(await savePostback(url.searchParams)),"application/json"); }
      catch(err) { const status=Number(err.statusCode)||500; console.error("Chaturbate postback failed:",err.message); return send(res,status,JSON.stringify({error:status===400?err.message:"Postback could not be saved"}),"application/json"); }
    }
    if (pathname === "/api/revenue") {
      if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res,404,"Not found","text/plain");
      try { return send(res,200,JSON.stringify(await revenueStats(url))); }
      catch(err) { console.error("Revenue query failed:",err.message); return send(res,503,JSON.stringify({error:"Revenue data unavailable"}),"application/json"); }
    }

    if (pathname === "/cb/postback" && req.method === "GET") {
      if (!pgPool) return send(res,503,JSON.stringify({error:"Database is not configured"}),"application/json");
      try { return send(res,200,JSON.stringify(await savePostback(url.searchParams)),"application/json"); }
      catch(err) { const status=Number(err.statusCode)||500; console.error("Postback failed:",err.message); return send(res,status,JSON.stringify({error:status===400?err.message:"Postback could not be saved"}),"application/json"); }
    }
    if (pathname === "/api/revenue") {
      if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res,404,"Not found","text/plain");
      try { return send(res,200,JSON.stringify(await revenueStats(url))); }
      catch(err) { console.error("Revenue query failed:",err.message); return send(res,503,JSON.stringify({error:"Revenue data unavailable"}),"application/json"); }
    }

    if (pathname === "/api/stats") {
      if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res, 404, "Not found", "text/plain");
      return send(res, 200, JSON.stringify((await statsFromDb()) || readStats()), "application/json");
    }

    if (pathname === "/visits") {
      if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res, 404, "Not found", "text/plain");
      const s = (await statsFromDb()) || readStats();
      return send(res, 200, `<html><head><meta name="robots" content="noindex"></head><body><h1>NightCamFinds affiliate clicks</h1><p>Total clicks: <strong>${s.total || 0}</strong></p><pre>${JSON.stringify(s, null, 2)}</pre></body></html>`);
    }

    if (pathname.startsWith("/go/") || pathname.startsWith("/bgo/")) {
      const platform = pathname.startsWith("/bgo/") ? "bongacams" : "chaturbate";
      const username = decodeURIComponent(pathname.slice(platform === "bongacams" ? 5 : 4)).split(":").pop();
      const feed = await loadRooms(req);
      const room = feed.rooms.find(r => r.platform === platform && r.username === username);
      const clickId = `ncf_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
      const source = cleanLabel(url.searchParams.get("utm_source") || url.searchParams.get("source"), "direct", 80);
      const medium = cleanLabel(url.searchParams.get("utm_medium") || url.searchParams.get("medium"), "unknown", 80);
      const campaign = cleanLabel(url.searchParams.get("utm_campaign") || url.searchParams.get("campaign"), "organic", 120);
      const content = cleanLabel(url.searchParams.get("utm_content") || url.searchParams.get("content"), "", 120);
      const category = cleanLabel(url.searchParams.get("cat"), "all", 80);
      const placement = cleanLabel(url.searchParams.get("src"), `${platform}-card`, 120);
      await recordClick({ clickId, platform, country: visitorCountry(req), device: device(req), source, medium, campaign, content, landingPath: req.headers.referer || "/", category, placement, roomId: room?.id || `${platform}:${username}` });
      const target = trackedDestination(room || { platform, href: "" }, clickId, source, campaign, medium);
      res.writeHead(302, { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      return res.end();
    }

    const file = pathname === "/" || pathname.endsWith("/") ? "/index.html" : pathname;
    const safe = path.normalize(file).replace(/^([.][.][/\\])+/, "");
    const full = path.join(PUBLIC, safe);
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, "Not found", "text/plain");
    const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".svg":"image/svg+xml" };
    return send(res, 200, fs.readFileSync(full), types[path.extname(full)] || "application/octet-stream");
  } catch (err) {
    console.error("request failed", pathname, err);
    return send(res, 503, JSON.stringify({ error: "Service temporarily unavailable" }), "application/json");
  }
});

server.listen(PORT, () => console.log(`NightCamFinds V2 listening on ${PORT}`));
