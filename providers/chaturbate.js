const https = require("https");

const DEFAULT_API_BASE = "https://chaturbate.com/api/public/affiliates/onlinerooms/";
const DEFAULT_CAMPAIGN = "C6yxN";
const DEFAULT_LIMIT = 100;

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "NightCamFinds/2.0",
        Accept: "application/json"
      }
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Chaturbate API HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Chaturbate API returned invalid JSON"));
        }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error("Chaturbate API timeout")));
    req.on("error", reject);
  });
}

function normalizeGender(value) {
  const gender = String(value || "").toLowerCase();
  if (gender === "f") return "female";
  if (gender === "m") return "male";
  if (gender === "t" || gender === "s") return "trans";
  if (gender === "c") return "couples";
  return "female";
}

function cleanText(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRoom(room) {
  const username = cleanText(room.username);
  if (!username) return null;

  const country = String(room.country || "").toUpperCase().match(/^[A-Z]{2}$/)?.[0] || "";

  return {
    id: `chaturbate:${username}`,
    platform: "chaturbate",
    platformName: "Chaturbate",
    username,
    displayName: cleanText(room.display_name) || username,
    gender: normalizeGender(room.gender),
    country,
    countryName: country,
    location: cleanText(room.location),
    viewerCount: Number(room.num_users || 0) || 0,
    isHd: Boolean(room.is_hd),
    isNew: Boolean(room.is_new),
    image: room.image_url_360x270 || room.image_url || "",
    roomSubject: cleanText(room.room_subject),
    languages: cleanText(room.spoken_languages),
    href: room.chat_room_url_revshare || room.chat_room_url || ""
  };
}

function buildUrl({ campaign, clientIp, limit, offset, gender, region, tag, exhibitionist, apiBase }) {
  const url = new URL(apiBase || DEFAULT_API_BASE);
  url.searchParams.set("wm", campaign || DEFAULT_CAMPAIGN);
  url.searchParams.set("client_ip", clientIp || "request_ip");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit || DEFAULT_LIMIT));
  if (offset !== undefined && offset !== null) url.searchParams.set("offset", String(Math.max(0, Number(offset) || 0)));
  if (gender) url.searchParams.set("gender", gender);
  if (region) url.searchParams.set("region", region);
  if (tag) url.searchParams.set("tag", tag);
  if (exhibitionist !== undefined && exhibitionist !== null) url.searchParams.set("exhibitionist", String(Boolean(exhibitionist)));
  return url;
}

async function fetchRooms(options = {}) {
  const url = buildUrl(options);
  const payload = await requestJson(url);
  const rows = Array.isArray(payload) ? payload : (payload.results || []);
  const rooms = rows.map(normalizeRoom).filter(Boolean).filter(room => room.href);
  return {
    rooms,
    meta: {
      provider: "chaturbate",
      campaign: options.campaign || DEFAULT_CAMPAIGN,
      limit: Number(options.limit || DEFAULT_LIMIT),
      endpoint: url.origin + url.pathname
    }
  };
}

module.exports = {
  DEFAULT_API_BASE,
  DEFAULT_CAMPAIGN,
  DEFAULT_LIMIT,
  buildUrl,
  normalizeRoom,
  fetchRooms
};
