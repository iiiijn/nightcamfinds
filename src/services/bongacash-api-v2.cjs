"use strict";

const BASE_URL = "https://bngprm.com/api/v2/";
const TRUSTED_IP_HEADERS = new Set([
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for"
]);
const DICTIONARY_KEYS = new Set([
  "bust_size", "butt_size", "ethnicity", "eye_color", "gender",
  "hair_color", "height", "language", "penis_size", "pubic_hair",
  "region", "sexual_preference", "tags", "weight"
]);
const DICTIONARY_LANGUAGES = new Set([
  "ar", "bg", "cn", "cz", "de", "dk", "ee", "en", "es", "fi", "fr",
  "gr", "hr", "hu", "il", "in", "it", "jp", "kr", "lt", "lv", "mk",
  "nl", "no", "pl", "pt", "ro", "rs", "ru", "se", "si", "sk", "tr", "ua"
]);
const SORT_VALUES = new Set(["display_name", "languages", "last_online", "rank"]);
const REGION_VALUES = new Set(["asia", "cis", "europe", "latin_america", "north_america", "other"]);
const SECTION_VALUES = new Set(["all", "straight", "couples", "gay", "transsexual", "new"]);

function isPublicIpv4(value) {
  if (typeof value !== "string" || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  const parts = value.split(".").map(Number);
  if (parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) return false;
  return true;
}

function resolveTrustedClientIpv4(req, configuredHeader) {
  const header = String(configuredHeader || "").trim().toLowerCase();
  if (!TRUSTED_IP_HEADERS.has(header)) return null;
  const raw = req && req.headers ? req.headers[header] : null;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  // Reject comma-separated proxy chains. The configured proxy must supply one
  // client address in this header; selecting an arbitrary hop is unsafe.
  return isPublicIpv4(value) ? value : null;
}

function validateBaseUrl(baseUrl) {
  const parsed = new URL(baseUrl || BASE_URL);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "bngprm.com" ||
    !["/api/v2/", "/api/v2"].includes(parsed.pathname) ||
    parsed.username || parsed.password
  ) {
    throw new TypeError("BongaCash V2 base URL must be https://bngprm.com/api/v2/.");
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed;
}

function buildModelsOnlineUrl(options = {}) {
  const campaign = String(options.campaignId == null ? "" : options.campaignId).trim();
  if (!/^\d+$/.test(campaign)) throw new TypeError("A numeric BongaCash campaign ID is required.");
  if (!isPublicIpv4(options.clientIp)) throw new TypeError("A valid public visitor IPv4 address is required for BongaCash V2.");
  const limit = Number(options.limit == null ? 100 : options.limit);
  const offset = Number(options.offset == null ? 0 : options.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError("BongaCash V2 limit must be between 1 and 500.");
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("BongaCash V2 offset must be a non-negative integer.");

  const url = new URL("models-online", validateBaseUrl(options.baseUrl));
  url.searchParams.set("c", campaign);
  url.searchParams.set("client_ip", options.clientIp);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const filters = options.filters || {};
  if (filters.username) {
    const username = String(filters.username).trim();
    if (!/^[a-z0-9_-]{1,64}$/i.test(username)) throw new TypeError("Invalid BongaCash model username filter.");
    url.searchParams.set("username", username);
  }
  if (filters.sort) {
    if (!SORT_VALUES.has(filters.sort)) throw new TypeError("Unsupported BongaCash sort value.");
    url.searchParams.set("sort", filters.sort);
  }
  if (filters.region) {
    if (!REGION_VALUES.has(filters.region)) throw new TypeError("Unsupported BongaCash region value.");
    url.searchParams.set("region", filters.region);
  }
  if (filters.section) {
    if (!SECTION_VALUES.has(filters.section)) throw new TypeError("Unsupported BongaCash section value.");
    url.searchParams.set("section", filters.section);
  }
  // categories and tags are array parameters. Their exact query serialization
  // is not present in the supplied constructor output, so this client does not
  // guess whether BongaCash expects repeated keys or another encoding.
  if (filters.categories != null || filters.tags != null) {
    throw new TypeError("BongaCash categories/tags filters require confirmation of the provider's generated URL encoding.");
  }
  return url.toString();
}

function buildDictionaryUrl(options = {}) {
  const key = String(options.key || "").trim();
  const lang = String(options.lang || "en").trim().toLowerCase();
  if (!DICTIONARY_KEYS.has(key)) throw new TypeError("Unsupported BongaCash dictionary key.");
  if (!DICTIONARY_LANGUAGES.has(lang)) throw new TypeError("Unsupported BongaCash dictionary language.");
  const url = new URL("dict", validateBaseUrl(options.baseUrl));
  url.searchParams.set("key", key);
  url.searchParams.set("lang", lang);
  return url.toString();
}

function resolveBongaRoomImage(room = {}) {
  const liveImages = room.live_images && typeof room.live_images === "object" ? room.live_images : {};
  const profileImages = room.profile_images && typeof room.profile_images === "object" ? room.profile_images : {};
  return liveImages.thumbnail_image_big ||
    liveImages.thumbnail_image_medium ||
    profileImages.profile_image ||
    profileImages.thumbnail_image_big ||
    profileImages.thumbnail_image_medium ||
    profileImages.thumbnail_image_small ||
    room.image_url || room.thumbnail || room.avatar || "";
}

function isBongaHd(room = {}) {
  return room.is_hd === true || room.hd_cam === true || room.hd === true;
}

function normalizeTags(value) {
  const values = typeof value === "string"
    ? value.split(/[\s,]+/)
    : Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key])
        : [];
  return [...new Set(values.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean))];
}

function parseModelsOnlineResponse(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.models)) {
    throw new TypeError("BongaCash V2 response did not contain a models array.");
  }
  const onlineModels = data.online_models == null ? null : Number(data.online_models);
  if (onlineModels !== null && (!Number.isInteger(onlineModels) || onlineModels < 0)) {
    throw new TypeError("BongaCash V2 online_models must be a non-negative integer.");
  }
  for (const room of data.models) {
    if (!room || typeof room !== "object" || Array.isArray(room)) {
      throw new TypeError("BongaCash V2 models must contain JSON objects.");
    }
  }
  return {
    models: data.models,
    onlineModels,
    randomChatUrl: typeof data.random_chat_url === "string" ? data.random_chat_url : "",
    popularChatUrl: typeof data.popular_chat_url === "string" ? data.popular_chat_url : ""
  };
}

function parseDictionaryResponse(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("BongaCash dictionary response must be an object.");
  }
  return data;
}

module.exports = {
  BASE_URL,
  isPublicIpv4,
  resolveTrustedClientIpv4,
  buildModelsOnlineUrl,
  buildDictionaryUrl,
  parseModelsOnlineResponse,
  normalizeTags,
  resolveBongaRoomImage,
  isBongaHd,
  parseDictionaryResponse
};
