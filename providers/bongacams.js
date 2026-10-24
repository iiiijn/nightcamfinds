const https = require("https");

const DEFAULT_API_BASE = "https://bngprm.com/promo.php";
const DEFAULT_CAMPAIGN = "840970";
const DEFAULT_LIMIT = 100;

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "NightCamFinds/2.0", Accept: "application/json" } }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`BongaCams API HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error("BongaCams API returned invalid JSON")); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error("BongaCams API timeout")));
    req.on("error", reject);
  });
}

function clean(value) {
  return String(value || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
}

function gender(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("female") || v === "f") return "female";
  if (v.includes("male") || v === "m") return "male";
  if (v.includes("trans") || v === "t") return "trans";
  if (v.includes("couple") || v === "c") return "couples";
  return "female";
}

function normalizeRoom(room) {
  const username = clean(room.username || room.user_name || room.nickname || room.model || room.id);
  if (!username) return null;
  const rawImages = room.profile_images || room.images || {};
  const images = typeof rawImages === "string" ? {} : rawImages;
  const age = Number(room.display_age || room.age || 0);
  if (Number.isFinite(age) && age > 0 && age < 18) return null;
  const country = String(room.homecountry || room.country || room.country_code || "").toUpperCase();
  const tags = Array.isArray(room.tags) ? room.tags.join(", ") : String(room.tags || "");
  const image = (typeof rawImages === "string" ? rawImages : "") || images.profile_image || images.thumbnail_image_big || images.thumbnail_image_medium || images.thumbnail_image_small || images.thumbnail_image_big_live || images.thumbnail_image_medium_live || room.image_url || room.thumbnail || room.avatar || "";
  return {
    id: `bongacams:${username}`,
    platform: "bongacams",
    platformName: "BongaCams",
    username,
    displayName: clean(room.display_name || room.name || username) || username,
    gender: gender(room.gender || room.sex),
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    countryName: country,
    location: clean(room.hometown || room.location || country),
    viewerCount: Number(room.members_count ?? room.num_users ?? room.viewers ?? room.viewer_count ?? 0) || 0,
    isHd: Boolean(room.hd_cam || room.hd) || /\bhd\b/i.test(tags),
    isNew: Boolean(room.is_new || room.new),
    image,
    roomSubject: clean(room.chat_topic || room.room_subject || room.topic || tags),
    languages: clean([room.primary_language, room.secondary_language, room.language].filter(Boolean).join(", ")),
    href: room.chat_url || room.direct_chat_url || room.room_url || room.url || ""
  };
}

function buildUrl({ apiBase, campaign, limit }) {
  const url = new URL(apiBase || DEFAULT_API_BASE);
  url.searchParams.set("c", campaign || DEFAULT_CAMPAIGN);
  url.searchParams.set("type", "api");
  url.searchParams.set("api_v", "1");
  url.searchParams.set("limit", String(limit || DEFAULT_LIMIT));
  url.searchParams.set("api_type", "json");
  return url;
}

async function fetchRooms(options = {}) {
  const url = buildUrl(options);
  const data = await requestJson(url);
  const candidateRows = Array.isArray(data) ? data : (data.results || data.rooms || data.data || data.models || []);
  const rooms = (Array.isArray(candidateRows) ? candidateRows : []).map(normalizeRoom).filter(Boolean).filter(room => room.href);
  return { rooms, meta: { provider: "bongacams", campaign: options.campaign || DEFAULT_CAMPAIGN, limit: Number(options.limit || DEFAULT_LIMIT) } };
}

module.exports = { DEFAULT_API_BASE, DEFAULT_CAMPAIGN, DEFAULT_LIMIT, buildUrl, normalizeRoom, fetchRooms };
