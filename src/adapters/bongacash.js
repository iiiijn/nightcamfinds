const FEED = "https://tools.bongacams.com/promo.php";
const ALLOWED_HOSTS = new Set(["bongacams.com", "www.bongacams.com"]);

export const BONGACASH = {
  id: "bongacash",
  campaign: "840970",
  program: "RevShare",
  status: "VERIFIED",
  apiStatus: "VERIFIED",
  ppsStatus: "REQUIRES_VERIFICATION",
  postbackStatus: "REQUIRES_VERIFICATION",
  notes: "Promo XML feed verified for campaign 840970. Postbacks are still not verified."
};

function field(block, tag) {
  const match = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  return match ? match[1].trim() : "";
}

export function normalizeBongaGender(value) {
  const v = String(value || "").toLowerCase();
  if (v === "female") return "female";
  if (v === "male") return "male";
  if (v.includes("trans")) return "trans";
  if (v.includes("couple")) return "couples";
  return null;
}

export function mapBongaRoom(block, campaign) {
  const username = field(block, "username");
  const chatUrl = field(block, "chat_url");
  if (!username || !chatUrl) return null;
  let destination;
  try {
    destination = new URL(chatUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(destination.hostname) || destination.searchParams.get("c") !== String(campaign)) return null;
  const liveImage = field(block, "thumbnail_image_medium_live") || field(block, "thumbnail_image_medium");
  const viewers = Number(field(block, "members_count"));
  return {
    id: `bongacash:${username.toLowerCase()}`,
    provider: "bongacash",
    externalUsername: username,
    displayName: field(block, "display_name") || username,
    gender: normalizeBongaGender(field(block, "gender")),
    age: Number(field(block, "display_age")) || null,
    country: field(block, "homecountry") || null,
    languages: [field(block, "primary_language_key")].filter(Boolean),
    image: liveImage ? `https:${liveImage}` : null,
    roomSubject: field(block, "chat_topic") || null,
    isLive: true,
    isHd: field(block, "hd_cam") === "1",
    isNew: field(block, "is_new") === "1",
    viewerCount: Number.isFinite(viewers) ? viewers : null,
    tags: [],
    roomUrl: destination.toString(),
    lastSeenAt: new Date().toISOString(),
    freshness: "FRESH",
    providerMetadata: { campaign }
  };
}

export async function fetchBongaCashRooms({ campaign = "840970", fetchImpl = fetch, timeoutMs = 12000, limit = 120 } = {}) {
  const url = new URL(FEED);
  url.searchParams.set("c", campaign);
  url.searchParams.set("type", "api");
  url.searchParams.set("api_type", "xml");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { accept: "text/xml" }, signal: controller.signal });
    if (!res.ok) return { status: "UNAVAILABLE", rooms: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    if (!xml.includes("<online_models>")) return { status: "UNAVAILABLE", rooms: [], error: "feed missing online_models" };
    const rooms = [...xml.matchAll(/<online_models>([\s\S]*?)<\/online_models>/g)]
      .map((match) => mapBongaRoom(match[1], campaign))
      .filter(Boolean)
      .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0))
      .slice(0, limit);
    if (!rooms.length) return { status: "UNAVAILABLE", rooms: [], error: "feed had no usable rooms" };
    return { status: "VERIFIED", rooms, count: rooms.length };
  } catch (error) {
    return { status: "UNAVAILABLE", rooms: [], error: error.name === "AbortError" ? "timeout" : "feed request failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function bongaCashDestination(room) {
  if (!room?.roomUrl) return { ok: false, reason: "BongaCams room has no tracked chat URL" };
  try {
    const url = new URL(room.roomUrl);
    if (!ALLOWED_HOSTS.has(url.hostname)) return { ok: false, reason: "BongaCams destination host rejected" };
    return { ok: true, url: url.toString(), domain: url.hostname };
  } catch {
    return { ok: false, reason: "BongaCams destination invalid" };
  }
}
