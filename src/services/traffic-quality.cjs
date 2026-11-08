'use strict';

const crypto = require('node:crypto');

const KNOWN_BOT = /bot|crawler|spider|slurp|preview|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|google-inspectiontool|bingpreview|headlesschrome|phantomjs|selenium|playwright|puppeteer/i;
const SUSPICIOUS = /curl|wget|python-requests|httpclient|axios|go-http-client|libwww-perl|scrapy/i;
const ALLOWED_EVENTS = new Set(['active_10s', 'scroll_50', 'bonga_banner_loaded', 'bonga_banner_viewable']);

function classifyUserAgent(value) {
  const ua = String(value || '').trim();
  if (!ua) return 'unverified';
  if (KNOWN_BOT.test(ua)) return 'known_bot';
  if (SUSPICIOUS.test(ua)) return 'suspected_bot';
  return 'unverified';
}

function mergeTrafficClass(existing, incoming) {
  const rank = { unverified: 0, suspected_bot: 1, known_bot: 2 };
  const current = Object.prototype.hasOwnProperty.call(rank, existing) ? existing : 'unverified';
  const next = Object.prototype.hasOwnProperty.call(rank, incoming) ? incoming : 'unverified';
  return rank[next] > rank[current] ? next : current;
}

function normalizeVisitId(value) {
  const id = String(value || '').trim();
  return /^[a-f0-9]{32}$/i.test(id) ? id.toLowerCase() : null;
}

function normalizeEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Invalid event payload.' };
  const visitId = normalizeVisitId(payload.visitId);
  if (!visitId) return { error: 'Invalid visit identifier.' };
  if (!ALLOWED_EVENTS.has(payload.eventType)) return { error: 'Unsupported engagement event.' };
  const pagePath = String(payload.pagePath || '').trim();
  if (!pagePath.startsWith('/') || pagePath.startsWith('//') || pagePath.length > 255 || /[\r\n]/.test(pagePath)) return { error: 'Invalid page path.' };
  return { value: { visitId, eventType: payload.eventType, pagePath } };
}

function createEngagementRateLimiter({ perMinute = 6, perHour = 30, maxEntries = 10000 } = {}) {
  const requests = new Map();
  return function allowEngagement(visitId, now = Date.now()) {
    const id = normalizeVisitId(visitId);
    if (!id) return false;
    const recent = (requests.get(id) || []).filter(time => now - time < 60 * 60 * 1000);
    if (recent.filter(time => now - time < 60 * 1000).length >= perMinute || recent.length >= perHour) {
      requests.set(id, recent);
      return false;
    }
    if (!requests.has(id) && requests.size >= maxEntries) {
      const oldestKey = requests.keys().next().value;
      if (oldestKey !== undefined) requests.delete(oldestKey);
    }
    recent.push(now);
    requests.delete(id);
    requests.set(id, recent);
    return true;
  };
}

function newVisitId() {
  return crypto.randomBytes(16).toString('hex');
}

// Convert a Nairobi-local Monday-to-Sunday week into UTC boundaries.
// Africa/Nairobi is UTC+03:00 and does not observe daylight saving time.
function nairobiWeekBounds(date = new Date()) {
  const local = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const day = local.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const mondayLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday));
  const nextMondayLocal = new Date(mondayLocal.getTime() + 7 * 86400000);
  return {
    from: new Date(mondayLocal.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    toExclusive: new Date(nextMondayLocal.getTime() - 3 * 60 * 60 * 1000).toISOString()
  };
}

module.exports = { classifyUserAgent, mergeTrafficClass, normalizeVisitId, normalizeEvent, createEngagementRateLimiter, newVisitId, nairobiWeekBounds, ALLOWED_EVENTS };
