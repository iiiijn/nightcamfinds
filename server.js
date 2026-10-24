const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { countryTier, buildChaturbateUrl } = require("./src/services/chaturbate-revshare.cjs");

let pgPool = null;
try {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5
    });
  }
} catch (err) {
  console.warn("Postgres tracking unavailable:", err.message);
}

const PORT = process.env.PORT || 3000;
const ORIGIN = (process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const CAMPAIGN = process.env.CB_CAMPAIGN || process.env.CHATURBATE_WM || "C6yxN";
const TOUR = process.env.CB_TOUR_GENERAL || process.env.CB_TOUR || "hr8m";
const CATEGORY_TOURS = {
  female: process.env.CB_TOUR_FEMALE || "uhEc",
  male: process.env.CB_TOUR_MALE || "EyCi",
  trans: process.env.CB_TOUR_TRANS || "2MTk",
  couples: process.env.CB_TOUR_COUPLES || "43Qk"
};
const BONGA_CAMPAIGN = process.env.BONGACAMS_CAMPAIGN || process.env.BONGACASH_CAMPAIGN || "840970";
const BONGA_API_BASE = process.env.BONGACAMS_API_BASE || "https://bngprm.com/promo.php";
const BONGA_ENABLED = process.env.BONGACAMS_ENABLED !== "false";
const BONGA_LIMIT = Math.max(10, Math.min(500, Number(process.env.BONGACAMS_LIMIT || 100)));
const CONTACT = process.env.CONTACT_EMAIL || "bunnybelle188@gmail.com";
const PUBLIC = path.join(__dirname, "public");

const MARKETS = [
  ["us", "US", "United States"],
  ["gb", "GB", "United Kingdom"],
  ["ca", "CA", "Canada"],
  ["au", "AU", "Australia"],
  ["de", "DE", "Germany"],
  ["fr", "FR", "France"],
  ["nl", "NL", "Netherlands"],
  ["ie", "IE", "Ireland"],
  ["nz", "NZ", "New Zealand"],
  ["se", "SE", "Sweden"],
  ["no", "NO", "Norway"],
  ["dk", "DK", "Denmark"],
  ["fi", "FI", "Finland"],
  ["ch", "CH", "Switzerland"],
  ["at", "AT", "Austria"],
  ["be", "BE", "Belgium"],
  ["jp", "JP", "Japan"],
  ["sg", "SG", "Singapore"],
  ["br", "BR", "Brazil"],
  ["es", "ES", "Spain"],
  ["it", "IT", "Italy"],
  ["pt", "PT", "Portugal"],
  ["ae", "AE", "United Arab Emirates"],
  ["hk", "HK", "Hong Kong"],
  ["mx", "MX", "Mexico"],
  ["pl", "PL", "Poland"],
  ["tr", "TR", "Turkey"],
  ["ru", "RU", "Russia"],
  ["cl", "CL", "Chile"]
];

const GENDER = { f: "female", m: "male", t: "trans", c: "couples", s: "trans" };
const BLOCKED = /\b(teen|teens|teenage|underage|preteen|lolita|child|children|kid|kids|young|barely\s*legal|18\s*yo|19\s*yo|#18\b|#19\b)\b/gi;
const NAMES = {
  US:"United States", CA:"Canada", GB:"United Kingdom", IE:"Ireland", AU:"Australia", NZ:"New Zealand",
  DE:"Germany", AT:"Austria", CH:"Switzerland", FR:"France", BE:"Belgium", NL:"Netherlands", LU:"Luxembourg",
  SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", IS:"Iceland", JP:"Japan", SG:"Singapore",
  BR:"Brazil", CO:"Colombia", MX:"Mexico", AR:"Argentina", CL:"Chile", PE:"Peru", VE:"Venezuela",
  PH:"Philippines", TH:"Thailand", CN:"China", RO:"Romania", UA:"Ukraine", IT:"Italy", ES:"Spain",
  PL:"Poland", CZ:"Czechia", HU:"Hungary", KE:"Kenya", KZ:"Kazakhstan", IN:"India", RU:"Russia", ZA:"South Africa",
  AE:"United Arab Emirates", HK:"Hong Kong", PT:"Portugal", TR:"Turkey", CL:"Chile"
};

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const STATS = path.join(DATA_DIR, "clicks.json");
const STATS_KEY = process.env.STATS_KEY || "";

let cache = { at: 0, rooms: [], notice: "" };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "NightCamFinds/2.0", Accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", c => { body += c; });
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error("Feed " + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    }).on("error", reject);
  });
}

function clean(text) {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[\w.-]+\.(com|net|tv|xxx|ai)\b\S*/gi, "")
    .replace(/\(\s*1[89]\s*\)/g, "")
    .replace(BLOCKED, "")
    .replace(/\b(beat|barely)\s*18\b/gi, "")
    .replace(/#[^\s#]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-|#]+|[\s\-|#]+$/g, "")
    .trim();
}

function cleanLabel(value, fallback = "unknown", max = 40) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
  return cleaned || fallback;
}

function visitorCountry(req) {
  const candidates = [
    req.headers["cf-ipcountry"],
    req.headers["x-vercel-ip-country"],
    req.headers["cloudfront-viewer-country"],
    req.headers["x-country-code"]
  ];
  for (const value of candidates) {
    const iso = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso;
  }
  return "UNKNOWN";
}

function writeStats(stats) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATS}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(stats, null, 2));
  fs.renameSync(tmp, STATS);
}

function readStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS, "utf8"));
  } catch {
    return { total: 0, countries: {}, byCategory: {}, byCountryCategory: {}, bySource: {}, byCampaign: {}, byCountrySource: {}, byCountryCampaign: {}, byPlacement: {}, byPlatform: {}, updatedAt: null };
  }
}

let trackingReady = false;
async function ensureTrackingTable() {
  if (!pgPool || trackingReady) return;
  await pgPool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id BIGSERIAL PRIMARY KEY,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    country VARCHAR(16) NOT NULL,
    category VARCHAR(40) NOT NULL,
    source VARCHAR(40) NOT NULL,
    campaign VARCHAR(80) NOT NULL,
    placement VARCHAR(80) NOT NULL,
    platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'
  )`);
  await pgPool.query("ALTER TABLE affiliate_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_click_id_idx ON affiliate_clicks(click_id)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_country_idx ON affiliate_clicks(country)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_clicked_at_idx ON affiliate_clicks(clicked_at)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_platform_idx ON affiliate_clicks(platform)");
  trackingReady = true;
}

async function ensureAffiliateLedgers() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS cb_clicks (
      click_id VARCHAR(128) PRIMARY KEY,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
      category VARCHAR(40) NOT NULL DEFAULT 'unknown',
      source VARCHAR(80) NOT NULL DEFAULT 'direct',
      campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
      placement VARCHAR(80) NOT NULL DEFAULT 'unknown'
    )
  `);
  await pgPool.query("ALTER TABLE cb_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'direct'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS campaign VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS placement VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS bonga_clicks (
      id BIGSERIAL PRIMARY KEY,
      affiliate_click_id BIGINT,
      click_id VARCHAR(128) UNIQUE,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
      category VARCHAR(40) NOT NULL DEFAULT 'unknown',
      source VARCHAR(80) NOT NULL DEFAULT 'direct',
      campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
      placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
      medium VARCHAR(80) NOT NULL DEFAULT 'unknown',
      content VARCHAR(120) NOT NULL DEFAULT '',
      device VARCHAR(32) NOT NULL DEFAULT 'unknown'
    )
  `);
  await pgPool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS bonga_clicks_clicked_at_idx ON bonga_clicks(clicked_at)");
}

async function countClick({ src, country, category = "unknown", source = "direct", campaign = "unknown", medium = "unknown", content = "", device = "unknown", clickId, platform = "chaturbate" }) {
  if (pgPool) {
    try {
      await ensureTrackingTable();
      await ensureAffiliateLedgers();
      const inserted = await pgPool.query(
        "INSERT INTO affiliate_clicks (country, category, source, campaign, placement, platform, medium, content, device, click_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
        [country, category, source, campaign, src, platform, medium, content, device, clickId || null]
      );
      if (platform === "chaturbate" && clickId) {
        await pgPool.query(
          "INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING",
          [clickId, country, category, source, campaign, src]
        );
      } else if (platform === "bongacams" && clickId) {
        await pgPool.query(
          "INSERT INTO bonga_clicks (affiliate_click_id,click_id,country,category,source,campaign,placement,medium,content,device) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (click_id) DO NOTHING",
          [inserted.rows[0]?.id || null, clickId, country, category, source, campaign, src, medium, content, device]
        );
      }
      return;
    } catch (err) {
      console.error("Postgres click tracking failed; falling back to local storage:", err.message);
    }
  }

  const stats = readStats();
  stats.total = (stats.total || 0) + 1;
  stats.countries = stats.countries || {};
  stats.countries[country] = (stats.countries[country] || 0) + 1;
  stats.byCategory = stats.byCategory || {};
  stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
  stats.byCountryCategory = stats.byCountryCategory || {};
  stats.byCountryCategory[`${country}:${category}`] = (stats.byCountryCategory[`${country}:${category}`] || 0) + 1;
  stats.bySource = stats.bySource || {};
  stats.bySource[source] = (stats.bySource[source] || 0) + 1;
  stats.byCampaign = stats.byCampaign || {};
  stats.byCampaign[campaign] = (stats.byCampaign[campaign] || 0) + 1;
  stats.byCountrySource = stats.byCountrySource || {};
  stats.byCountrySource[`${country}:${source}`] = (stats.byCountrySource[`${country}:${source}`] || 0) + 1;
  stats.byCountryCampaign = stats.byCountryCampaign || {};
  stats.byCountryCampaign[`${country}:${campaign}`] = (stats.byCountryCampaign[`${country}:${campaign}`] || 0) + 1;
  stats.byPlacement = stats.byPlacement || {};
  stats.byPlacement[`${platform}:${src}`] = (stats.byPlacement[`${platform}:${src}`] || 0) + 1;
  stats.byPlatform = stats.byPlatform || {};
  stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
  stats.byMedium = stats.byMedium || {};
  stats.byMedium[medium] = (stats.byMedium[medium] || 0) + 1;
  stats.byDevice = stats.byDevice || {};
  stats.byDevice[device] = (stats.byDevice[device] || 0) + 1;
  stats.updatedAt = new Date().toISOString();
  writeStats(stats);
}

async function statsFromDb() {
  if (!pgPool) return null;
  try {
    await ensureTrackingTable();
    const q = async (sql, params = []) => (await pgPool.query(sql, params)).rows;
    const countries = {};
    for (const r of await q("SELECT country, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country ORDER BY count DESC")) countries[r.country] = r.count;
    const byCountryCategory = {};
    for (const r of await q("SELECT country, category, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country, category ORDER BY count DESC")) byCountryCategory[`${r.country}:${r.category}`] = r.count;
    const byCountrySource = {};
    for (const r of await q("SELECT country, source, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country, source ORDER BY count DESC")) byCountrySource[`${r.country}:${r.source}`] = r.count;
    const byPlatform = {};
    for (const r of await q("SELECT platform, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY platform ORDER BY count DESC")) byPlatform[r.platform] = r.count;
    const total = Number((await q("SELECT COUNT(*)::int AS count FROM affiliate_clicks"))[0]?.count || 0);
    const updated = await q("SELECT MAX(clicked_at) AS updated_at FROM affiliate_clicks");
    return { total, countries, byCountryCategory, byCountrySource, byPlatform, updatedAt: updated[0]?.updated_at || null, persistent: true };
  } catch (err) {
    console.error("Postgres stats read failed:", err.message);
    return null;
  }
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(fwd) || fwd.includes(":")) return fwd;
  return "8.8.8.8";
}

function normalizeChaturbateRoom(room) {
  return {
    id: "chaturbate:" + room.username,
    platform: "chaturbate",
    platformName: "Chaturbate",
    username: room.username,
    displayName: clean(room.display_name || room.username) || room.username,
    gender: GENDER[room.gender] || "female",
    country: (room.country || "").toUpperCase(),
    countryName: NAMES[(room.country || "").toUpperCase()] || room.country || "",
    location: clean(room.location),
    viewerCount: Number(room.num_users || 0),
    isHd: !!room.is_hd,
    isNew: !!room.is_new,
    image: room.image_url_360x270 || room.image_url || "",
    roomSubject: clean(room.room_subject),
    languages: room.spoken_languages || "",
    href: room.chat_room_url_revshare || room.chat_room_url || "",
    tags: (Array.isArray(room.tags) ? room.tags : []).map(tag => clean(tag)).filter(tag => tag && !new RegExp(BLOCKED.source, "i").test(tag)).slice(0, 8)
  };
}

function bongaGender(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("female") || v === "f") return "female";
  if (v.includes("male") || v === "m") return "male";
  if (v.includes("trans") || v === "t") return "trans";
  if (v.includes("couple") || v === "c") return "couples";
  return "female";
}

function normalizeBongaRoom(room) {
  const username = clean(room.username || room.user_name || room.nickname || room.model || room.id);
  if (!username) return null;
  const rawImages = room.profile_images || room.images || {};
  const images = typeof rawImages === "string" ? {} : rawImages;
  const age = Number(room.display_age || room.age || 0);
  const tags = Array.isArray(room.tags) ? room.tags.join(", ") : String(room.tags || "");
  if (Number.isFinite(age) && age > 0 && age < 18) return null;
  const country = String(room.homecountry || room.country || room.country_code || "").toUpperCase();
  const viewers = Number(room.members_count ?? room.num_users ?? room.viewers ?? room.viewer_count ?? 0) || 0;
  const image = (typeof rawImages === "string" ? rawImages : "") ||
    images.profile_image || images.thumbnail_image_big || images.thumbnail_image_medium ||
    images.thumbnail_image_small || images.thumbnail_image_big_live ||
    images.thumbnail_image_medium_live || room.image_url || room.thumbnail || room.avatar || "";
  return {
    id: "bongacams:" + username,
    platform: "bongacams",
    platformName: "BongaCams",
    username,
    displayName: clean(room.display_name || room.name || username) || username,
    gender: bongaGender(room.gender || room.sex),
    country: country.match(/^[A-Z]{2}$/)?.[0] || "",
    countryName: NAMES[country] || clean(country),
    location: clean(room.hometown || room.location || country),
    viewerCount: viewers,
    isHd: !!room.hd_cam || !!room.hd || /\bhd\b/i.test(tags),
    isNew: !!room.is_new || !!room.new,
    image,
    roomSubject: clean(room.chat_topic || room.room_subject || room.topic || tags),
    languages: clean([room.primary_language, room.secondary_language, room.language].filter(Boolean).join(", ")),
    href: room.chat_url || room.direct_chat_url || room.room_url || room.url || ""
  };
}

async function fetchChaturbateRooms(req) {
  const ip = encodeURIComponent(clientIp(req));
  const data = await fetchJson(`https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=${encodeURIComponent(CAMPAIGN)}&client_ip=${ip}&format=json&limit=500`);
  return (data.results || []).map(normalizeChaturbateRoom).filter(r => r.href);
}

async function fetchBongaRooms() {
  if (!BONGA_ENABLED) return [];
  const params = new URLSearchParams({
    c: BONGA_CAMPAIGN,
    type: "api",
    api_v: "1",
    limit: String(BONGA_LIMIT),
    api_type: "json"
  });
  const data = await fetchJson(`${BONGA_API_BASE}?${params.toString()}`);
  const candidateRows = Array.isArray(data) ? data : (data.results || data.rooms || data.data || data.models || []);
  const rows = Array.isArray(candidateRows) ? candidateRows : [];
  return rows.map(normalizeBongaRoom).filter(Boolean).filter(r => r.href);
}

async function rooms(req) {
  if (Date.now() - cache.at < 20000 && cache.rooms.length) return cache;
  const results = await Promise.allSettled([fetchChaturbateRooms(req), fetchBongaRooms()]);
  const ch = results[0].status === "fulfilled" ? results[0].value : [];
  const bc = results[1].status === "fulfilled" ? results[1].value : [];
  const notices = [];
  if (results[0].status === "rejected") notices.push("Chaturbate feed unavailable");
  if (results[1].status === "rejected" && BONGA_ENABLED) notices.push("BongaCams feed unavailable");
  const combined = [...ch, ...bc];
  cache = {
    at: Date.now(),
    rooms: combined,
    notice: combined.length ? "" : (notices.join(" · ") || "Live rooms are temporarily unavailable. Please check again shortly.")
  };
  return cache;
}

function langFor(country) {
  const iso = String(country || "").toUpperCase();
  if (["FR", "BE", "LU", "MC"].includes(iso)) return "fr";
  if (["DE", "AT"].includes(iso)) return "de";
  if (iso === "CH") return "de";
  if (iso === "NL") return "nl";
  return "en";
}

function pageOrigin(req) {
  if (ORIGIN) return ORIGIN;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return proto + "://" + req.headers.host;
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  });
  res.end(body);
}

function legal(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="robots" content="index,follow"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body><main class="wrap legal"><h1>${title}</h1>${body}<p><a href="/">Back to rooms</a></p></main></body></html>`;
}

const pages = {
  "/about": legal("About NightCamFinds", `<p>NightCamFinds is an independent 18+ directory of public rooms from partner cam platforms. Video plays on the partner platform after you click through. This site does not host streams, take payments, or operate broadcaster accounts.</p><p>Room titles, thumbnails, viewer counts, and country data come from affiliate feeds and can be wrong or out of date. Youth-adjacent words are removed from text shown here.</p><p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/affiliate-disclosure": legal("Affiliate disclosure", `<p>NightCamFinds participates in affiliate programs for cam platforms including Chaturbate and BongaCams.</p><p>If you register or spend after using a tracked link, NightCamFinds may earn a commission. That does not change the price you pay. Listings are not a review of a specific performer.</p><p>Room cards use tracked redirects so clicks can be attributed to the correct platform and placement.</p>`),
  "/privacy": legal("Privacy policy", `<p>Last updated 21 October 2026.</p><p>NightCamFinds stores an age-notice flag in your browser’s localStorage after you confirm you are 18 or older. The server keeps standard logs for security and debugging. For affiliate analytics, the site records aggregate redirect clicks by visitor country, category, traffic label, and platform when a trusted CDN/proxy provides a country code. The site does not need to store a visitor’s name or exact location for this reporting.</p><p>Clicking a room sends you to a partner platform. Those sites set their own cookies and have their own privacy policies. This site does not sell personal information.</p><p>Privacy questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/terms": legal("Terms", `<p>Last updated 21 October 2026.</p><p>You must be at least 18, or the age of majority where you live, whichever is higher. Do not use the site if adult material is illegal where you are.</p><p>NightCamFinds is a directory. Streams, chat, tips, and accounts belong to partner platforms. Do not scrape the site in a way that overloads it, attempt to access admin tools, or use the directory to find anyone under 18.</p><p>The directory is provided as is. NightCamFinds is not responsible for performer conduct or partner charges.</p>`),
  "/contact": legal("Contact", `<p>Operator email: <a href="mailto:${CONTACT}">${CONTACT}</a></p><p>Use this address for privacy requests, takedown notices, and affiliate questions. For a recording on a partner site, contact that platform. NightCamFinds does not host the video.</p>`)
};

function sitemap(origin) {
  const paths = ["/", "/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/", "/broadcast", "/about", "/affiliate-disclosure", "/privacy", "/terms", "/contact", ...MARKETS.map(([slug]) => `/country/${slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`;
}

function withTrack(url, track) {
  try {
    const next = new URL(url);
    next.searchParams.set("track", track);
    return next.toString();
  } catch {
    return `https://chaturbate.com/in/?tour=${encodeURIComponent(TOUR)}&campaign=${encodeURIComponent(CAMPAIGN)}&track=${encodeURIComponent(track)}`;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/robots.txt") {
    return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /bgo/\nDisallow: /api/\nSitemap: ${pageOrigin(req)}/sitemap.xml\n`, "text/plain");
  }
  if (pathname === "/sitemap.xml") return send(res, 200, sitemap(pageOrigin(req)), "application/xml");
  if (pathname === "/broadcast" || pathname === "/broadcast/") {
    const html = fs.readFileSync(path.join(PUBLIC, "broadcast.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (pages[pathname]) return send(res, 200, pages[pathname], "text/html; charset=utf-8");

  if (pathname === "/visits") {
    if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res, 404, "Not found", "text/plain");
    const stats = (await statsFromDb()) || readStats();
    const countryRows = Object.entries(stats.countries || {}).sort((a,b) => b[1]-a[1]).map(([iso,count]) => `<tr><td>${NAMES[iso] || iso}</td><td>${iso}</td><td>${count}</td></tr>`).join("");
    const categoryRows = Object.entries(stats.byCountryCategory || {}).sort((a,b) => b[1]-a[1]).map(([key,count]) => { const [iso,category] = key.split(":"); return `<tr><td>${NAMES[iso] || iso}</td><td>${category}</td><td>${count}</td></tr>`; }).join("");
    const sourceRows = Object.entries(stats.byCountrySource || {}).sort((a,b) => b[1]-a[1]).map(([key,count]) => { const [iso,source] = key.split(":"); return `<tr><td>${NAMES[iso] || iso}</td><td>${source}</td><td>${count}</td></tr>`; }).join("");
    const platformRows = Object.entries(stats.byPlatform || {}).sort((a,b) => b[1]-a[1]).map(([platform,count]) => `<tr><td>${platform}</td><td>${count}</td></tr>`).join("");
    return send(res, 200, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>NightCamFinds Click Stats</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 16px}table{border-collapse:collapse;width:100%;margin:12px 0 32px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.kpi{padding:16px;border:1px solid #ddd;border-radius:10px}.kpi strong{font-size:1.7rem;display:block}</style></head><body><h1>NightCamFinds affiliate click stats</h1><p class="muted">Aggregate redirect clicks only. Country comes from a trusted CDN/proxy header when available.</p><div class="grid"><div class="kpi"><span>Total clicks</span><strong>${stats.total || 0}</strong></div><div class="kpi"><span>Countries seen</span><strong>${Object.keys(stats.countries || {}).filter(k => k !== "UNKNOWN").length}</strong></div><div class="kpi"><span>Last updated</span><strong>${stats.updatedAt ? new Date(stats.updatedAt).toLocaleString() : "Never"}</strong></div></div><h2>Clicks by platform</h2><table><thead><tr><th>Platform</th><th>Clicks</th></tr></thead><tbody>${platformRows || '<tr><td colspan="2">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by visitor country</h2><table><thead><tr><th>Country</th><th>ISO</th><th>Clicks</th></tr></thead><tbody>${countryRows || '<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by country and category</h2><table><thead><tr><th>Country</th><th>Category</th><th>Clicks</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by country and traffic source</h2><table><thead><tr><th>Country</th><th>Source</th><th>Clicks</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><p><a href="/api/stats?key=${encodeURIComponent(STATS_KEY)}">JSON export</a> · <a href="/api/stats.csv?key=${encodeURIComponent(STATS_KEY)}">CSV export</a></p></body></html>`, "text/html; charset=utf-8");
  }

  if (pathname === "/api/stats") {
    if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res, 404, "Not found", "text/plain");
    return send(res, 200, JSON.stringify((await statsFromDb()) || readStats()), "application/json");
  }

  if (pathname === "/api/stats.csv") {
    if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res, 404, "Not found", "text/plain");
    const stats = (await statsFromDb()) || readStats();
    const rows = [["country","category","source","clicks"]];
    for (const [key,count] of Object.entries(stats.byCountryCategory || {})) {
      const [country,category] = key.split(":");
      rows.push([country,category,"all",count]);
    }
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.writeHead(200, { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":"attachment; filename=nightcamfinds-clicks.csv", "X-Content-Type-Options":"nosniff", "Cache-Control":"no-store" });
    return res.end(csv);
  }

  if (pathname === "/api/rooms") {
    const feed = await rooms(req);
    const category = url.searchParams.get("category") || "all";
    const country = (url.searchParams.get("country") || "").toUpperCase();
    const platform = (url.searchParams.get("platform") || "").toLowerCase();
    const language = (url.searchParams.get("language") || "").trim().toLowerCase();
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const sort = url.searchParams.get("sort") || "recommended";
    let list = feed.rooms.slice();
    if (["female","male","trans","couples"].includes(category)) list = list.filter(r => r.gender === category);
    if (category === "hd") list = list.filter(r => r.isHd);
    if (category === "new") list = list.filter(r => r.isNew);
    if (country) list = list.filter(r => r.country === country);
    if (["chaturbate","bongacams"].includes(platform)) list = list.filter(r => r.platform === platform);
    const languagesFor = room => (Array.isArray(room.languages) ? room.languages : String(room.languages || "").split(/[,;|]/))
      .map(value => String(value || "").trim().toLowerCase()).filter(Boolean);
    if (language) list = list.filter(room => languagesFor(room).includes(language));
    if (q) list = list.filter(r => `${r.displayName} ${r.roomSubject} ${r.country} ${r.location} ${r.platformName} ${(r.tags || []).join(" ")} ${languagesFor(r).join(" ")}`.toLowerCase().includes(q));
    list.sort((a,b) => sort === "newest" ? Number(b.isNew)-Number(a.isNew) || b.viewerCount-a.viewerCount : b.viewerCount-a.viewerCount);
    const countries = [...new Set(feed.rooms.map(r => r.country).filter(Boolean))].sort();
    const platforms = [...new Set(feed.rooms.map(r => r.platform).filter(Boolean))].sort();
    const languages = [...new Set(feed.rooms.flatMap(languagesFor))].sort();
    const viewerCountry = visitorCountry(req);
    const viewerTier = countryTier(viewerCountry);
    return send(res, 200, JSON.stringify({
      rooms:list.slice(0,60), countries, platforms, languages, notice:feed.notice,
      visitorCountry, countryTier:viewerTier.tier,
      tier1: viewerTier.tier === 1
    }), "application/json");
  }

  if (pathname === "/api/surprise") {
    const feed = await rooms(req);
    const room = feed.rooms[Math.floor(Math.random() * Math.min(feed.rooms.length,40))] || null;
    return send(res, room ? 200 : 503, JSON.stringify({ room }), "application/json");
  }

  if (pathname.startsWith("/bgo/") || pathname.startsWith("/go/")) {
    const isBonga = pathname.startsWith("/bgo/");
    const id = decodeURIComponent(pathname.slice(isBonga ? 5 : 4));
    const username = id.split(":").pop();
    const platform = isBonga ? "bongacams" : "chaturbate";
    const src = cleanLabel(url.searchParams.get("src"), isBonga ? "bonga-card" : "cb-card", 80);
    const category = cleanLabel(url.searchParams.get("cat"), "unknown", 40);
    const source = cleanLabel(url.searchParams.get("utm_source") || url.searchParams.get("source"), "direct", 40);
    const medium = cleanLabel(url.searchParams.get("utm_medium") || url.searchParams.get("medium"), "unknown", 80);
    const campaign = cleanLabel(url.searchParams.get("utm_campaign") || url.searchParams.get("campaign"), "unknown", 80);
    const content = cleanLabel(url.searchParams.get("utm_content") || url.searchParams.get("content"), "", 120);
    const country = visitorCountry(req);
    const agent = String(req.headers["user-agent"] || "").toLowerCase();
    const device = /mobile|android|iphone|ipad/.test(agent) ? "mobile" : "desktop";
    const clickId = "ncf_" + Date.now().toString(36) + "_" + require("crypto").randomBytes(8).toString("hex");
    await countClick({ src, country, category, source, campaign, medium, content, device, clickId, platform });
    const room = cache.rooms.find(r => r.platform === platform && r.username === username);
    let target;
    if (isBonga) {
      const supplied = room?.href || "";
      try {
        const parsed = supplied ? new URL(supplied) : null;
        if (parsed && /(^|\.)bongacams4?\.com$/i.test(parsed.hostname)) {
          parsed.searchParams.set("click_id", clickId);
          parsed.searchParams.set("source", source);
          parsed.searchParams.set("track", src);
          target = parsed.toString();
        }
      } catch (_) {}
      if (!target) target = `https://bongacams4.com/track?c=${encodeURIComponent(BONGA_CAMPAIGN)}&click_id=${encodeURIComponent(clickId)}&track=${encodeURIComponent(src)}`;
    } else {
      const selectedTour = CATEGORY_TOURS[category] || TOUR;
      let destination = buildChaturbateUrl({
        roomUrl: room?.href || "",
        campaign: CAMPAIGN,
        tour: selectedTour,
        track: src,
        clickId,
        source,
        medium,
        utmCampaign: campaign
      });
      if (!destination.ok) {
        // If the live feed returns an unexpected room URL, fall back safely to the
        // category's official affiliate tour instead of breaking the visitor's click.
        destination = buildChaturbateUrl({
          campaign: CAMPAIGN,
          tour: selectedTour,
          track: src,
          clickId,
          source,
          medium,
          utmCampaign: campaign
        });
      }
      if (!destination.ok) {
        console.error("Chaturbate redirect destination rejected:", destination.reason);
        res.writeHead(502, { "Cache-Control": "no-store" });
        return res.end("Affiliate destination unavailable");
      }
      target = destination.url;
    }
    res.writeHead(302, { Location:target, "Cache-Control":"no-store", "Referrer-Policy":"no-referrer" });
    return res.end();
  }

  const file = pathname === "/" || pathname.endsWith("/") ? "/index.html" : pathname;
  const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC, safe);
  const market = pathname.match(/^\/country\/([a-z]{2})\/$/);
  const forced = market ? MARKETS.find(([slug]) => slug === market[1]) : null;
  if (pathname.endsWith("/") || forced) {
    let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")
      .replaceAll("__ORIGIN__", pageOrigin(req))
      .replace("__COUNTRY__", visitorCountry(req))
      .replace("__FORCE__", forced ? forced[1] : "")
      .replace("__LANG__", langFor(forced ? forced[1] : visitorCountry(req)));
    const slug = pathname.replace(/^\/+|\/+$/g, "") || "home";
    const seo = {
      home: ["Live cams now | NightCamFinds", "Browse live adult cam rooms from Chaturbate and BongaCams. Filter by category, country, language, tags and viewer count, then open a room on its partner platform."],
      live: ["Live Cams Now | NightCamFinds", "Discover current live cam rooms, compare viewer counts and browse broadcasters who are online now."],
      female: ["Live Female Cams | NightCamFinds", "Browse live female cam rooms by country, viewer count, language and room tags. Streams open on the partner platform."],
      male: ["Live Male Cams | NightCamFinds", "Discover live male cam rooms, compare public room details and choose a room on its partner platform."],
      trans: ["Live Trans Cams | NightCamFinds", "Browse live trans cam rooms by country, language, tags and viewer count. Video plays on the partner platform."],
      couples: ["Live Couples Cams | NightCamFinds", "Find live couples cam rooms and filter current listings by country, popularity and room details."],
      hd: ["HD Live Cams | NightCamFinds", "Browse rooms marked HD by the partner feed. Stream quality and availability can change."],
      new: ["New Live Cams | NightCamFinds", "Find rooms newly marked live by partner feeds and explore current broadcasts."],
      popular: ["Popular Live Cams | NightCamFinds", "Explore live rooms ranked by current viewer counts. Popularity changes as broadcasters come online and offline."],
      countries: ["Live Cams by Country | NightCamFinds", "Browse live cam listings by country and compare current public room details."],
      broadcast: ["Become a Broadcaster | NightCamFinds", "Learn how to apply to broadcast through a partner cam platform. Eligibility and approval are determined by the partner."]
    };
    const titleAndDescription = forced
      ? [`Live cams in ${forced[2]} | NightCamFinds`, `Browse current live cam listings tagged for ${forced[2]}. Room availability and country data come from partner feeds and can change.`]
      : (seo[slug] || seo.home);
    const safeMeta = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeMeta(titleAndDescription[0])}</title>`)
      .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${safeMeta(titleAndDescription[1])}">`)
      .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${safeMeta(titleAndDescription[0])}">`)
      .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${safeMeta(titleAndDescription[1])}">`)
      .replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${safeMeta(pageOrigin(req) + pathname)}">`);
    if (forced) {
      html = html
        .replace("Discover live cams right now", `Live cams in ${forced[2]}`)
        .replace("NightCamFinds — Live cam directory", `Live cams in ${forced[2]} — NightCamFinds`)
        .replace("Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.", `Browse current live cam listings tagged for ${forced[2]}. Room availability and country data come from partner feeds and can change.`);
    } else if (seo[slug]) {
      html = html.replace("Discover live cams right now", titleAndDescription[0].replace(" | NightCamFinds", ""));
      html = html.replace("Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.", titleAndDescription[1]);
    }
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, "Not found", "text/plain");
  const types = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".svg":"image/svg+xml" };
  send(res, 200, fs.readFileSync(full), types[path.extname(full)] || "application/octet-stream");
});

server.listen(PORT, () => console.log(`NightCamFinds listening on ${PORT}`));
