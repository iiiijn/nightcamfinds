const DEFAULT_BASE_URL = 'https://en.bongacams.com';

function first(...values) {
  return values.find((v) => v !== undefined && v !== null && String(v).trim() !== '') ?? '';
}

function normalizeRoom(raw = {}) {
  const username = String(first(raw.username, raw.user, raw.model, raw.nickname)).trim();
  if (!username) return null;

  return {
    id: String(first(raw.id, username)),
    platform: 'bongacams',
    username,
    displayName: String(first(raw.display_name, raw.nickname, raw.username, username)),
    gender: String(first(raw.gender, 'unknown')).toLowerCase(),
    country: String(first(raw.country, raw.country_code, 'UNKNOWN')).toUpperCase(),
    viewerCount: Number(first(raw.num_users, raw.viewer_count, raw.viewers, 0)) || 0,
    image: String(first(raw.image, raw.image_url, raw.thumbnail, '')),
    roomSubject: String(first(raw.room_subject, raw.subject, 'Live now')),
    isHd: Boolean(first(raw.hd, raw.is_hd, false)),
    isNew: Boolean(first(raw.is_new, false)),
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    href: `${DEFAULT_BASE_URL}/profile/${encodeURIComponent(username)}`
  };
}

function extractRooms(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : first(payload?.rooms, payload?.models, payload?.data, []);
  return Array.isArray(candidates) ? candidates.map(normalizeRoom).filter(Boolean) : [];
}

async function fetchRooms({ apiUrl, apiKey, fetchImpl = fetch } = {}) {
  if (!apiUrl) throw new Error('BongaCams API URL is not configured');

  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(apiUrl, { headers });
  if (!response.ok) throw new Error(`BongaCams feed returned HTTP ${response.status}`);

  return extractRooms(await response.json());
}

module.exports = { normalizeRoom, extractRooms, fetchRooms };
