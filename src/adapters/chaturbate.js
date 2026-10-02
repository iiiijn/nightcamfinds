const ALLOWED = new Set(["chaturbate.com", "www.chaturbate.com"]);

export function normalizeGender(value) {
  const v = String(value || "").toLowerCase();
  if (["f", "female"].includes(v)) return "female";
  if (["m", "male"].includes(v)) return "male";
  if (["t", "trans", "s"].includes(v)) return "trans";
  if (["c", "couples", "couple"].includes(v)) return "couples";
  return v || null;
}

export function mapChaturbateRoom(raw) {
  if (!raw || !raw.username) return null;
  const username = String(raw.username);
  return {
    id: `chaturbate:${username.toLowerCase()}`,
    provider: "chaturbate",
    externalUsername: username,
    displayName: username,
    gender: normalizeGender(raw.gender),
    age: Number.isFinite(raw.age) ? raw.age : null,
    country: raw.country || null,
    languages: Array.isArray(raw.spoken_languages) ? raw.spoken_languages : [],
    image: raw.image_url_360x270 || raw.image_url || null,
    roomSubject: raw.room_subject || null,
    isLive: true,
    isHd: Boolean(raw.is_hd),
    isNew: Boolean(raw.is_new),
    viewerCount: Number.isFinite(raw.num_users) ? raw.num_users : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    roomUrl: raw.chat_room_url_revshare || raw.chat_room_url || null,
    lastSeenAt: new Date().toISOString(),
    freshness: "FRESH",
    providerMetadata: {
      secondsOnline: raw.seconds_online ?? null,
      currentShow: raw.current_show ?? null,
      numFollowers: raw.num_followers ?? null,
      location: raw.location ?? null
    }
  };
}

export function validateChaturbatePayload(body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "malformed payload" };
  const list = Array.isArray(body.results) ? body.results : Array.isArray(body) ? body : null;
  if (!list) return { ok: false, reason: "missing results" };
  return { ok: true, list };
}

export async function fetchChaturbateRooms({ wm, clientIp, limit = 50, offset = 0, gender, hd, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (!wm) {
    return { status: "REQUIRES_VERIFICATION", rooms: [], error: "CHATURBATE_WM missing" };
  }
  const url = new URL("https://chaturbate.com/api/public/affiliates/onlinerooms/");
  url.searchParams.set("wm", wm);
  url.searchParams.set("format", "json");
  url.searchParams.set("client_ip", clientIp || "request_ip");
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  url.searchParams.set("offset", String(offset));
  if (gender) url.searchParams.set("gender", gender);
  if (hd) url.searchParams.set("hd", "1");
  const started = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: controller.signal });
      if (res.status === 429) return { status: "UNAVAILABLE", rooms: [], error: "rate limited", ms: Date.now() - started };
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const body = await res.json();
      const parsed = validateChaturbatePayload(body);
      if (!parsed.ok) return { status: "UNAVAILABLE", rooms: [], error: parsed.reason, ms: Date.now() - started };
      return {
        status: "VERIFIED",
        rooms: parsed.list.map(mapChaturbateRoom).filter(Boolean),
        count: body?.count ?? parsed.list.length,
        ms: Date.now() - started
      };
    } catch (err) {
      lastError = err.name === "AbortError" ? "timeout" : err.message;
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: "UNAVAILABLE", rooms: [], error: lastError, ms: Date.now() - started };
}

export function chaturbateDestination(room, clickId) {
  if (!room?.roomUrl) return { ok: false, reason: "missing room_url from provider" };
  let host;
  try {
    host = new URL(room.roomUrl).hostname;
  } catch {
    return { ok: false, reason: "invalid room url" };
  }
  if (!ALLOWED.has(host)) return { ok: false, reason: "domain not allowlisted" };
  const url = new URL(room.roomUrl);
  if (clickId) url.searchParams.set("click_id", clickId);
  return { ok: true, url: url.toString(), domain: host };
}
