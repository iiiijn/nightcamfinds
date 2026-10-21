const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const originalCreateServer = http.createServer;
const BONGA_CAMPAIGN = process.env.BONGACAMS_CAMPAIGN || "840970";

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

http.createServer = function routeDashboard(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");
    if (incoming.pathname === "/dashboard" || incoming.pathname === "/dashboard/") {
      const html = fs.readFileSync(path.join(__dirname, "public", "dashboard.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      return res.end(html);
    }
    if (incoming.pathname === "/api/bonga-rooms") {
      try { return sendJson(res, 200, { rooms: await bongaRooms(), platform: "bongacams" }); }
      catch (err) { console.error("BongaCams feed error:", err.message); return sendJson(res, 502, { rooms: [], platform: "bongacams", error: err.message }); }
    }
    if (incoming.pathname.startsWith("/bgo/")) {
      const id = decodeURIComponent(incoming.pathname.slice(5));
      const username = id.split(":").pop();
      const target = `https://bongacams4.com/track?c=${encodeURIComponent(BONGA_CAMPAIGN)}&room=${encodeURIComponent(username)}`;
      res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
      return res.end();
    }
    return handler(req, res);
  });
};

require("./start.js");
