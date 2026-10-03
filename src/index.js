import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db/connect.js";
import { fetchChaturbateRooms } from "./adapters/chaturbate.js";
import { BONGACASH, fetchBongaCashRooms } from "./adapters/bongacash.js";
import { recommend, surprise } from "./services/recommend.js";
import { buildRedirect, isOpenRedirect, newClickId } from "./services/affiliate.js";
import { parsePostback, classifyPostback } from "./services/postbacks.js";
import { createProviderCache } from "./services/cache.js";
import { hashPassword, verifyPassword, productionGuard } from "./security.js";
import { verifyTotpCode, provisioning, recoveryCodes, hashRecoveryCode, canChangeMfa, mfaRateLimited } from "./mfa.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
loadEnv(path.join(root, ".env"));

const PORT = Number(process.env.PORT || 8787);
const provider = process.env.DATABASE_PROVIDER || (process.env.NODE_ENV === "production" ? "postgres" : "pglite");
const guards = productionGuard();
if (guards.length) {
  console.error("Refusing to start in production:");
  for (const err of guards) console.error(`- ${err}`);
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && provider !== "postgres") {
  console.error("Refusing to start: production cannot use the development database fallback.");
  process.exit(1);
}

const cache = createProviderCache();
const health = {
  application: "up",
  postgres: "unknown",
  cache: "in-process",
  chaturbate: "unknown",
  bongacash: "REQUIRES_VERIFICATION",
  redirects: "unknown",
  postbacks: "unknown",
  jobs: "idle",
  sitemap: "not-checked",
  backup: "NOT_CONFIGURED"
};
let repo;
let refreshing = null;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    if (!process.env[k]) process.env[k] = t.slice(i + 1);
  }
}

function id() {
  return crypto.randomBytes(12).toString("hex");
}

async function settings() {
  return (await repo.setting("runtime")) || {
    maintenance: false,
    redirectsEnabled: true,
    promotionsEnabled: true,
    postbacksEnabled: true,
    providers: { chaturbate: true, bongacash: false }
  };
}

async function audit(actor, action, detail) {
  await repo.audit({ id: id(), actor, action, detail });
}

async function seed() {
  await repo.upsertProvider({ id: "chaturbate", name: "Chaturbate", status: "VERIFIED", apiVersion: "v2", program: "REQUIRES_CONFIRMATION", campaign: process.env.CHATURBATE_WM || "C6yxN", enabled: true, notes: "API v2 documented. Program not confirmed." });
  await repo.upsertProvider({ id: "bongacash", name: "BongaCash", status: "CONFIGURED", apiVersion: null, program: "RevShare", campaign: process.env.BONGACASH_CAMPAIGN || "840970", enabled: false, notes: "API, PPS, postbacks REQUIRES_VERIFICATION" });
  await repo.saveCampaign({ id: "cb-c6yxn", providerId: "chaturbate", name: "Chaturbate C6yxN", program: "REQUIRES_CONFIRMATION", externalCampaign: process.env.CHATURBATE_WM || "C6yxN", status: "CONFIGURED" });
  await repo.saveCampaign({ id: "bc-840970", providerId: "bongacash", name: "BongaCash 840970", program: "RevShare", externalCampaign: "840970", status: "CONFIGURED" });
  await repo.saveLink({ id: "cb-revshare-room", providerId: "chaturbate", campaign: "C6yxN", program: "REQUIRES_CONFIRMATION", destinationType: "room", domain: "chaturbate.com", status: "Unverified", verificationStatus: "REQUIRES_VERIFICATION", notes: "Uses chat_room_url_revshare when present." });
  await repo.saveLink({ id: "bc-direct", providerId: "bongacash", campaign: "840970", program: "RevShare", destinationType: "room", status: "Disabled", verificationStatus: "REQUIRES_VERIFICATION", notes: "Disabled until destination URL is verified." });
  const username = process.env.ADMIN_USER || "owner";
  const password = process.env.ADMIN_PASSWORD || "change-me";
  await repo.ensureAdmin({
    id: "admin-owner",
    username,
    passwordHash: hashPassword(password),
    role: "owner",
    mustChangePassword: password === "change-me",
    mfaSecret: null,
    mfaEnrolled: false
  });
  if (!(await repo.setting("runtime"))) {
    await repo.setSetting("runtime", { maintenance: false, redirectsEnabled: true, promotionsEnabled: true, postbacksEnabled: true, providers: { chaturbate: true, bongacash: false } });
  }
}

async function refreshProviders() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const current = await settings();
    health.jobs = "running";
    if (current.providers.chaturbate && process.env.CHATURBATE_ENABLED !== "false") {
      const result = await fetchChaturbateRooms({ wm: process.env.CHATURBATE_WM || "C6yxN", clientIp: "request_ip", limit: 80 });
      cache.put("chaturbate", result.rooms);
      health.chaturbate = { state: result.rooms.length ? "Healthy" : "Degraded", status: result.status, rooms: result.rooms.length, error: result.error || null, at: new Date().toISOString() };
      for (const room of result.rooms) await repo.upsertRoom(room);
    } else {
      cache.put("chaturbate", []);
      health.chaturbate = { state: "Unavailable", error: "disabled", at: new Date().toISOString() };
    }
    const bc = await fetchBongaCashRooms({ apiBase: process.env.BONGACASH_API_BASE || "" });
    cache.put("bongacash", []);
    health.bongacash = { state: "Unavailable", status: bc.status, rooms: 0, error: bc.error, postbacks: "REQUIRES_VERIFICATION", at: new Date().toISOString() };
    health.jobs = "idle";
    try {
      health.postgres = (await repo.health()) ? "ok" : "failing";
    } catch {
      health.postgres = "failing";
    }
    return health;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve(Object.fromEntries(new URLSearchParams(raw))); }
    });
  });
}

function cookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function sessionFrom(req) {
  const sid = cookie(req, "ncf_admin");
  if (!sid) return null;
  return repo.session(sid);
}

function send(res, code, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {
    "content-type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
    ...headers
  });
  res.end(payload);
}

function page(title, body, robots = "index,follow") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="robots" content="${robots}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body>${body}</body></html>`;
}

function publicRoom(r) {
  return {
    id: r.id, provider: r.provider, displayName: r.displayName, gender: r.gender, age: r.age,
    country: r.country, languages: r.languages, image: r.image, roomSubject: r.roomSubject,
    isHd: r.isHd, isNew: r.isNew, viewerCount: r.viewerCount, tags: r.tags, freshness: r.freshness
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.includes("..")) return send(res, 400, { error: "bad path" });
    if (url.pathname === "/health") return send(res, 200, { ok: health.postgres !== "failing", health });
    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      const base = siteOrigin(req);
      return res.end(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nDisallow: /search\nSitemap: ${base}/sitemap.xml\n`);
    }
    if (url.pathname === "/sitemap.xml") {
      health.sitemap = "generated";
      res.writeHead(200, { "content-type": "application/xml" });
      const base = siteOrigin(req);
      const paths = ["/", "/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/", "/about", "/affiliate-disclosure", "/privacy", "/terms", "/contact"];
      const body = paths.map((loc) => `<url><loc>${base}${loc}</loc></url>`).join("");
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
    }
    if (url.pathname === "/api/rooms") {
      const current = await settings();
      if (current.maintenance) return send(res, 200, { rooms: [], notice: "Maintenance mode." });
      const q = (url.searchParams.get("q") || "").slice(0, 80).toLowerCase();
      if (/[<>]/.test(q)) return send(res, 400, { error: "invalid search" });
      let rooms = cache.live().filter((r) => current.providers[r.provider] !== false);
      if (q) rooms = rooms.filter((r) => [r.displayName, r.roomSubject, r.country, ...(r.tags || [])].join(" ").toLowerCase().includes(q));
      const list = recommend(rooms, { sort: url.searchParams.get("sort") || "recommended", category: url.searchParams.get("category") || "all", limit: 60 }).map(publicRoom);
      return send(res, 200, { rooms: list, health, notice: list.length ? null : "Live rooms are temporarily unavailable. Please check again shortly." });
    }
    if (url.pathname === "/api/surprise") {
      const room = surprise(cache.live());
      return send(res, 200, { room: room ? publicRoom(room) : null });
    }
    if (url.pathname === "/api/meta") {
      return send(res, 200, {
        brand: "NightCamFinds",
        database: provider,
        providers: { chaturbate: { campaign: process.env.CHATURBATE_WM || "C6yxN", api: "v2", status: "VERIFIED", program: "REQUIRES_CONFIRMATION" }, bongacash: BONGACASH },
        bongacashPostbacks: "REQUIRES_VERIFICATION"
      });
    }
    if (url.pathname.startsWith("/go/")) {
      const current = await settings();
      health.redirects = current.redirectsEnabled ? "enabled" : "disabled";
      if (!current.redirectsEnabled) return send(res, 503, page("Redirects disabled", "<main class='wrap'><h1>Affiliate redirects are disabled.</h1></main>", "noindex"));
      const roomId = decodeURIComponent(url.pathname.slice(4));
      const room = cache.live().find((r) => r.id === roomId);
      const links = await repo.links();
      const link = links.find((l) => l.provider_id === room?.provider);
      const clickId = newClickId();
      const dest = room && current.providers[room.provider] === false
        ? { ok: false, reason: "provider disabled" }
        : buildRedirect(room, clickId, link ? { status: link.status, verificationStatus: link.verification_status } : null);
      try {
        await repo.insertClick({ clickId, roomId, provider: room?.provider || null, campaign: room?.provider === "bongacash" ? "840970" : process.env.CHATURBATE_WM || "C6yxN", program: "REQUIRES_CONFIRMATION", destination: dest.ok ? dest.domain : null });
      } catch (err) {
        console.error("click persist failed", err.message);
      }
      if (!dest.ok || isOpenRedirect(dest.url)) return send(res, 400, page("Unavailable", `<main class='wrap'><h1>This room cannot be opened.</h1><p>${dest.reason || "Destination rejected."}</p></main>`, "noindex"));
      res.writeHead(302, { location: dest.url, "cache-control": "no-store" });
      return res.end();
    }
    if (url.pathname === "/postback/chaturbate" || url.pathname === "/postback/bongacash") {
      const current = await settings();
      const name = url.pathname.split("/").pop();
      if (!current.postbacksEnabled) return send(res, 503, { ok: false, error: "postbacks disabled" });
      const body = req.method === "POST" ? await readBody(req) : {};
      const query = Object.fromEntries(url.searchParams);
      const parsed = parsePostback(query, body);
      const duplicate = parsed.known.transaction_id ? Boolean(await repo.findPostbackByTransaction(parsed.known.transaction_id)) : false;
      const clickExists = parsed.known.click_id ? (await repo.clicks()).some((c) => c.click_id === parsed.known.click_id) : false;
      const result = classifyPostback({
        provider: name,
        known: parsed.known,
        token: query.token || body.token,
        expectedToken: process.env.POSTBACK_TOKEN || "",
        duplicate,
        clickExists
      });
      await repo.insertPostback({ id: id(), provider: name, payload: parsed.known, status: result.status, clickId: parsed.known.click_id });
      if (result.status === "accepted" || result.status === "unmatched") {
        await repo.insertConversion({ id: id(), provider: name, clickId: parsed.known.click_id, transactionId: parsed.known.transaction_id, amount: result.amount, currency: result.currency, eventType: parsed.known.type, state: result.state });
      }
      health.postbacks = result.status;
      return send(res, result.status === "rejected" ? 400 : 200, result);
    }
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const body = await readBody(req);
      const username = String(body.username || "");
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      if (await repo.recentFailures(username, since) >= 5) return send(res, 429, { ok: false, error: "rate limited" });
      const admin = await repo.adminByUsername(username);
      const okPass = admin && verifyPassword(body.password || "", admin.password_hash);
      await repo.recordLogin({ id: id(), username, ip: req.socket.remoteAddress, ok: Boolean(okPass) });
      if (!okPass) {
        await audit(username, "login.failed", {});
        return send(res, 401, { ok: false });
      }
      if (mfaRateLimited(await repo.recentFailures(`mfa:${username}`, since))) return send(res, 429, { ok: false, error: "mfa rate limited" });
      const secret = process.env.OWNER_MFA_SECRET || "";
      if (process.env.NODE_ENV === "production" && !secret) return send(res, 503, { ok: false, error: "mfa not configured" });
      let mfaOk = !secret;
      if (secret) {
        if (body.recovery) {
          const row = await repo.unusedRecovery(admin.id, hashRecoveryCode(body.recovery));
          mfaOk = Boolean(row && await repo.consumeRecovery(row.id));
        } else {
          const last = await repo.setting("mfa_last_step");
          const checked = verifyTotpCode(secret, body.totp, Date.now(), last);
          mfaOk = checked.ok;
          if (checked.ok) await repo.setSetting("mfa_last_step", checked.step);
        }
      }
      if (!mfaOk) {
        await repo.recordLogin({ id: id(), username: `mfa:${username}`, ip: req.socket.remoteAddress, ok: false });
        await audit(username, "login.mfa_failed", {});
        return send(res, 401, { ok: false, error: "mfa required" });
      }
      const sid = crypto.randomBytes(18).toString("hex");
      await repo.createSession({ id: sid, adminId: admin.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
      await audit(username, "login", { mfa: Boolean(secret) });
      return send(res, 200, { ok: true, mustChangePassword: admin.must_change_password, mfaConfigured: Boolean(secret) }, { "set-cookie": `ncf_admin=${sid}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (url.pathname === "/api/admin/mfa/enroll" && req.method === "POST") {
      const session = await sessionFrom(req);
      if (!session) return send(res, 401, { ok: false });
      if (session.role !== "owner") return send(res, 403, { error: "forbidden" });
      const body = await readBody(req);
      const admin = await repo.adminByUsername(session.username);
      const gate = canChangeMfa({ session, passwordOk: Boolean(admin && verifyPassword(body.password || "", admin.password_hash)) });
      if (!gate.ok) return send(res, gate.status, { error: gate.error });
      const secret = process.env.OWNER_MFA_SECRET || "";
      if (!secret) return send(res, 400, { error: "OWNER_MFA_SECRET is not configured" });
      const already = await repo.setting("mfa_provisioned");
      if (already && !body.replace) return send(res, 409, { error: "already enrolled" });
      const issued = recoveryCodes();
      await repo.saveRecoveryCodes(issued.map((code) => ({ id: id(), adminId: admin.id, codeHash: hashRecoveryCode(code) })));
      const packed = await provisioning(secret, admin.username);
      await repo.setSetting("mfa_provisioned", true);
      await audit(session.username, "mfa.enroll", { replaced: Boolean(body.replace) });
      return send(res, 200, { qr: packed.qr, uri: packed.uri, recoveryCodes: issued, once: true });
    }
    if (url.pathname === "/api/admin/password" && req.method === "POST") {
      const session = await sessionFrom(req);
      if (!session) return send(res, 401, { ok: false });
      const body = await readBody(req);
      if (!body.password || body.password.length < 12 || body.password === "change-me") return send(res, 400, { error: "password rejected" });
      await repo.updateAdmin(session.admin_id, { passwordHash: hashPassword(body.password), mustChangePassword: false });
      await audit(session.username, "password.changed", {});
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/admin/logout" && req.method === "POST") {
      const sid = cookie(req, "ncf_admin");
      if (sid) await repo.revokeSession(sid);
      return send(res, 200, { ok: true }, { "set-cookie": "ncf_admin=; HttpOnly; Path=/; Max-Age=0" });
    }
    if (url.pathname === "/api/admin/state") {
      const session = await sessionFrom(req);
      if (!session) return send(res, 401, { ok: false });
      if (session.role === "analyst" && url.searchParams.get("mutate")) return send(res, 403, { error: "forbidden" });
      return send(res, 200, {
        role: session.role,
        mustChangePassword: session.must_change_password,
        mfa: session.mfa_enrolled ? "enrolled" : "REQUIRES_VERIFICATION",
        settings: await settings(),
        health,
        links: await repo.links(),
        providers: await repo.providers(),
        clicks: await repo.clicks(),
        conversions: await repo.conversions(),
        postbacks: await repo.postbacks(),
        audit: await repo.audits(),
        bongacashPostbacks: "REQUIRES_VERIFICATION",
        backup: "NOT_CONFIGURED"
      });
    }
    if (url.pathname === "/api/admin/settings" && req.method === "POST") {
      const session = await sessionFrom(req);
      if (!session || session.role === "analyst" || session.role === "editor") return send(res, 403, { error: "forbidden" });
      const body = await readBody(req);
      const current = await settings();
      const next = { ...current, ...body, providers: { ...current.providers, ...(body.providers || {}) } };
      if (next.providers.bongacash && !process.env.BONGACASH_API_BASE) return send(res, 400, { error: "BongaCash API REQUIRES_VERIFICATION" });
      await repo.setSetting("runtime", next);
      await repo.saveConfig({ id: id(), key: "runtime", value: next, author: session.username, note: "admin update" });
      await audit(session.username, "settings.update", body);
      return send(res, 200, { ok: true });
    }
    if (["/privacy", "/terms", "/affiliate-disclosure", "/contact", "/about"].includes(url.pathname)) return send(res, 200, legal(url.pathname));
    const filePath = ["/", "/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/"].includes(url.pathname) || url.pathname.match(/^\/(female|male|trans|couples|hd|new|popular|countries)\/?$/)
      ? path.join(publicDir, "index.html")
      : url.pathname === "/admin" || url.pathname === "/admin/"
        ? path.join(publicDir, "admin.html")
        : path.join(publicDir, path.normalize(url.pathname));
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      return fs.createReadStream(filePath).pipe(res);
    }
    send(res, 404, page("Not found", "<main class='wrap'><h1>Page not found</h1></main>", "noindex"));
  } catch (err) {
    send(res, 500, { error: "internal" });
  }
});

function siteOrigin(req) {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers.host || "nightcamfinds.onrender.com";
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${host}`;
}

function legal(pathName) {
  const email = process.env.CONTACT_EMAIL || "bunnybelle188@gmail.com";
  const pages = {
    "/about": ["About NightCamFinds", `<p>NightCamFinds is an independent 18+ directory. It lists public live rooms supplied by partner platforms. Video plays on the partner site after you click through. This site does not host streams, take payments, or operate broadcaster accounts.</p><p>Room titles, thumbnails, viewer counts, and country codes come from the partner feed and can be wrong or out of date. Youth-adjacent words are stripped from text shown here.</p><p>Contact: <a href="mailto:${email}">${email}</a>.</p>`],
    "/affiliate-disclosure": ["Affiliate disclosure", `<p>NightCamFinds participates in affiliate programs, including Chaturbate and BongaCams. Links to partner sites are sponsored.</p><p>If you register or spend on a partner after using a tracked link, NightCamFinds may earn a commission. That does not change the price you pay. Listings are not a review of a specific performer.</p><p>Room cards go through this site’s /go/ redirect so the partner can attribute the click.</p>`],
    "/privacy": ["Privacy policy", `<p>Last updated 3 October 2026. Replace the contact address before you rely on this page.</p><h2>What this site stores</h2><ul><li>An age-notice flag in your browser’s localStorage after you confirm you are 18 or older.</li><li>Standard server logs: IP address, user agent, requested URL, and time. Keep these only as long as you need them for security.</li></ul><h2>Partners</h2><p>Clicking a room sends you to the partner platform. Those sites set their own cookies and have their own privacy policies.</p><p>Privacy questions: <a href="mailto:${email}">${email}</a>.</p>`],
    "/terms": ["Terms", `<p>Last updated 3 October 2026. This is an operator draft, not a law-firm opinion.</p><p>You must be at least 18, or the age of majority where you live, whichever is higher. Do not use the site if adult material is illegal where you are.</p><p>NightCamFinds is a directory. Streams, chat, tips, and accounts belong to the partner platform. Do not scrape the site in a way that overloads it, attempt to access admin tools, or use the directory to find anyone under 18.</p><p>The directory is provided as is. NightCamFinds is not responsible for performer conduct or partner charges.</p>`],
    "/contact": ["Contact", `<p>Operator email: <a href="mailto:${email}">${email}</a></p><p>Use this address for privacy requests, takedown notices, and affiliate questions. For a recording on a partner site, contact that platform. NightCamFinds does not host the video.</p>`]
  };
  const [title, body] = pages[pathName];
  return page(title, `<main class="wrap legal"><h1>${title}</h1>${body}<p><a href="/">Back to rooms</a></p></main>`);
}

const db = await openDatabase({
  provider,
  databaseUrl: process.env.DATABASE_URL,
  dataDir: path.resolve(root, process.env.DATA_DIR || "./data"),
  sqlDir: path.join(root, "sql")
});
repo = db.repo;
await seed();
health.postgres = "ok";
server.listen(PORT, () => {
  console.log(`NightCamFinds listening on http://localhost:${PORT} (${db.kind})`);
  refreshProviders().catch((err) => console.error("initial refresh failed", err.message));
});
