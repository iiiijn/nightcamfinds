const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ORIGIN = (process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const CAMPAIGN = process.env.CB_CAMPAIGN || "C6yxN";
const TOUR = process.env.CB_TOUR || "LQps";
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
  ["sg", "SG", "Singapore"]
];
const GENDER = { f: "female", m: "male", t: "trans", c: "couples", s: "trans" };
const BLOCKED = /\b(teen|teens|teenage|underage|preteen|lolita|child|children|kid|kids|young|barely\s*legal|18\s*yo|19\s*yo|#18\b|#19\b)\b/gi;

let cache = { at: 0, rooms: [], notice: "" };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "NightCamFinds/1.1", Accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error("Feed " + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    }).on("error", reject);
  });
}

function clean(text) {
  return String(text || "")
    .replace(BLOCKED, "")
    .replace(/#[^\s#]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-|#]+|[\s\-|#]+$/g, "")
    .trim();
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(fwd) || fwd.includes(":")) return fwd;
  return "8.8.8.8";
}

async function rooms(req) {
  if (Date.now() - cache.at < 20000 && cache.rooms.length) return cache;
  try {
    const ip = encodeURIComponent(clientIp(req));
    const data = await fetchJson(`https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=${CAMPAIGN}&client_ip=${ip}&format=json&limit=500`);
    const list = (data.results || []).map((room) => ({
      id: "chaturbate:" + room.username,
      username: room.username,
      displayName: room.display_name || room.username,
      gender: GENDER[room.gender] || "female",
      country: (room.country || "").toUpperCase(),
      location: clean(room.location),
      viewerCount: room.num_users || 0,
      isHd: !!room.is_hd,
      isNew: !!room.is_new,
      image: room.image_url_360x270 || room.image_url || "",
      roomSubject: clean(room.room_subject),
      languages: room.spoken_languages || "",
      href: room.chat_room_url_revshare || ""
    }));
    cache = { at: Date.now(), rooms: list, notice: "" };
  } catch (err) {
    cache = { at: Date.now(), rooms: cache.rooms, notice: cache.rooms.length ? "" : "Live rooms are temporarily unavailable. Please check again shortly." };
  }
  return cache;
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
  "/about": legal("About NightCamFinds", `<p>NightCamFinds is an independent 18+ directory of public Chaturbate rooms. Video plays on Chaturbate after you click through. This site does not host streams, take payments, or operate broadcaster accounts.</p><p>Room titles, thumbnails, viewer counts, and country codes come from the Chaturbate affiliate feed and can be wrong or out of date. Youth-adjacent words are removed from text shown here.</p><p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/affiliate-disclosure": legal("Affiliate disclosure", `<p>NightCamFinds participates in the Chaturbate affiliate program. Links to Chaturbate are sponsored.</p><p>If you register or spend on Chaturbate after using a tracked link, NightCamFinds may earn a commission. That does not change the price you pay. Listings are not a review of a specific performer.</p><p>Room cards go through this site’s /go/ redirect so Chaturbate can attribute the click. Each placement uses its own track ID.</p>`),
  "/privacy": legal("Privacy policy", `<p>Last updated 4 October 2026.</p><p>NightCamFinds stores an age-notice flag in your browser’s localStorage after you confirm you are 18 or older. The server keeps standard logs — IP address, user agent, requested URL, and time — for up to 30 days for security and debugging.</p><p>Clicking a room sends you to the partner platform. Those sites set their own cookies and have their own privacy policies. This site does not sell personal information.</p><p>Privacy questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/terms": legal("Terms", `<p>Last updated 4 October 2026.</p><p>You must be at least 18, or the age of majority where you live, whichever is higher. Do not use the site if adult material is illegal where you are.</p><p>NightCamFinds is a directory. Streams, chat, tips, and accounts belong to the partner platform. Do not scrape the site in a way that overloads it, attempt to access admin tools, or use the directory to find anyone under 18.</p><p>The directory is provided as is. NightCamFinds is not responsible for performer conduct or partner charges.</p>`),
  "/contact": legal("Contact", `<p>Operator email: <a href="mailto:${CONTACT}">${CONTACT}</a></p><p>Use this address for privacy requests, takedown notices, and affiliate questions. For a recording on a partner site, contact that platform. NightCamFinds does not host the video.</p>`)
};

function sitemap(origin) {
  const paths = ["/", "/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/", "/broadcast", "/about", "/affiliate-disclosure", "/privacy", "/terms", "/contact", ...MARKETS.map(([slug]) => `/country/${slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`;
}

function withTrack(url, track) {
  try {
    const next = new URL(url);
    next.searchParams.set("track", track);
    return next.toString();
  } catch {
    return `https://chaturbate.com/in/?tour=${TOUR}&campaign=${CAMPAIGN}&track=${encodeURIComponent(track)}`;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/robots.txt") {
    return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /api/\nSitemap: ${pageOrigin(req)}/sitemap.xml\n`, "text/plain");
  }
  if (pathname === "/sitemap.xml") return send(res, 200, sitemap(pageOrigin(req)), "application/xml");
  if (pathname === "/broadcast" || pathname === "/broadcast/") {
    const html = fs.readFileSync(path.join(PUBLIC, "broadcast.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (pages[pathname]) return send(res, 200, pages[pathname], "text/html; charset=utf-8");

  if (pathname === "/api/rooms") {
    const feed = await rooms(req);
    const category = url.searchParams.get("category") || "all";
    const country = (url.searchParams.get("country") || "").toUpperCase();
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const sort = url.searchParams.get("sort") || "recommended";
    let list = feed.rooms.slice();
    if (["female", "male", "trans", "couples"].includes(category)) list = list.filter((r) => r.gender === category);
    if (category === "hd") list = list.filter((r) => r.isHd);
    if (category === "new") list = list.filter((r) => r.isNew);
    if (country) list = list.filter((r) => r.country === country);
    if (q) list = list.filter((r) => `${r.displayName} ${r.roomSubject} ${r.country} ${r.location}`.toLowerCase().includes(q));
    list.sort((a, b) => sort === "newest" ? Number(b.isNew) - Number(a.isNew) || b.viewerCount - a.viewerCount : b.viewerCount - a.viewerCount);
    const countries = [...new Set(feed.rooms.map((r) => r.country).filter(Boolean))].sort();
    return send(res, 200, JSON.stringify({ rooms: list.slice(0, 60), countries, notice: feed.notice, tier1: MARKETS.some(([, iso]) => iso === (req.headers["cf-ipcountry"] || "").toUpperCase()) }), "application/json");
  }

  if (pathname === "/api/surprise") {
    const feed = await rooms(req);
    const room = feed.rooms[Math.floor(Math.random() * Math.min(feed.rooms.length, 40))] || null;
    return send(res, room ? 200 : 503, JSON.stringify({ room }), "application/json");
  }

  if (pathname.startsWith("/go/")) {
    const id = decodeURIComponent(pathname.slice(4));
    const username = id.split(":").pop();
    const src = (url.searchParams.get("src") || "card").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "card";
    const feed = await rooms(req);
    const room = feed.rooms.find((r) => r.username === username);
    const target = room?.href
      ? withTrack(room.href, src)
      : `https://chaturbate.com/in/?tour=${TOUR}&campaign=${CAMPAIGN}&track=${encodeURIComponent(src)}&room=${encodeURIComponent(username)}`;
    res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
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
      .replace("__COUNTRY__", (req.headers["cf-ipcountry"] || "").toUpperCase())
      .replace("__FORCE__", forced ? forced[1] : "");
    if (forced) {
      html = html
        .replace("Discover live cams right now", `Live cams in ${forced[2]}`)
        .replace("NightCamFinds — Live cam directory", `Live cams in ${forced[2]} — NightCamFinds`)
        .replace("Explore live rooms, compare viewer counts, and open a room on Chaturbate. NightCamFinds does not stream video itself.", `Public rooms that list ${forced[2]} in the Chaturbate feed. Counts change quickly. Video plays on Chaturbate, not on NightCamFinds.`);
    }
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    return send(res, 404, "Not found", "text/plain");
  }
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
  send(res, 200, fs.readFileSync(full), types[path.extname(full)] || "application/octet-stream");
});

server.listen(PORT, () => console.log("NightCamFinds listening on " + PORT));
