'use strict';

const PLATFORMS = Object.freeze(['chaturbate', 'bongacams']);
const ISO_DATE = /^\\d{4}-\\d{2}-\\d{2}$/;
function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function parseFilters(params) {
  const from = String(params.get('from') || '').trim();
  const to = String(params.get('to') || '').trim();
  const platformRaw = String(params.get('platform') || 'ALL').trim().toLowerCase();
  const platform = platformRaw === 'all' ? 'ALL' : platformRaw;
  const limitRaw = params.get('limit');
  const limit = limitRaw === null ? 100 : Number(limitRaw);
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  if (platform !== 'ALL' && !PLATFORMS.includes(platform)) return { error: 'Platform must be ALL, chaturbate or bongacams.' };
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: 'Limit must be a whole number from 1 to 100.' };
  return { value: { from, to, platform, limit } };
}
function buildQuery(filters) {
  const params = [];
  const where = [];
  if (filters.from) { params.push(filters.from); where.push("c.clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')"); }
  if (filters.to) { params.push(filters.to); where.push("(c.clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC'))"); }
  if (filters.platform !== 'ALL') { params.push(filters.platform); where.push("LOWER(c.platform) = $" + params.length); }
  params.push(filters.limit);
  return {
    text: `SELECT c.id, c.clicked_at, c.click_id, UPPER(c.country) AS country,
      LOWER(c.platform) AS platform, LOWER(c.category) AS category,
      CASE WHEN LOWER(COALESCE(c.source_evidence, 'legacy')) = 'legacy' AND LOWER(COALESCE(c.source, '')) = 'direct' THEN 'unknown' ELSE COALESCE(NULLIF(LOWER(c.source), ''), 'unknown') END AS source,
      COALESCE(NULLIF(LOWER(c.source_evidence), ''), 'legacy') AS source_evidence,
      COALESCE(NULLIF(LOWER(c.medium), ''), 'unknown') AS medium,
      COALESCE(NULLIF(LOWER(c.campaign), ''), 'unknown') AS campaign,
      COALESCE(NULLIF(LOWER(c.content), ''), 'unknown') AS content,
      COALESCE(NULLIF(LOWER(c.placement), ''), 'unknown') AS placement,
      COALESCE(NULLIF(c.landing_path, ''), 'unknown') AS landing_path,
      COALESCE(NULLIF(LOWER(c.device), ''), 'unknown') AS device,
      c.visit_id::text AS visit_id, (to_jsonb(c)->>'is_bot') AS is_bot, (to_jsonb(c)->>'bot_reason') AS bot_reason,
      v.traffic_class AS visit_traffic_class
      FROM affiliate_clicks c
      LEFT JOIN traffic_visits v ON v.visit_id = c.visit_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.clicked_at DESC, c.id DESC LIMIT $${params.length}`,
    params
  };
}
function mapRow(row) {
  const content = String(row.content || '');
  const roomMatch = content.match(/(?:^|:)room-([a-z0-9_-]{1,64})(?::|$)/i);
  const trafficClass = row.is_bot === true || row.is_bot === 'true' || row.bot_reason === 'known_bot_user_agent'
    ? 'known_bot'
    : row.bot_reason === 'suspected_automation_user_agent'
      ? 'suspected_bot'
      : ['known_bot', 'suspected_bot', 'unverified'].includes(row.visit_traffic_class)
        ? row.visit_traffic_class : 'unclassified';
  return {
    id: Number(row.id), clickedAt: row.clicked_at, clickId: row.click_id || null,
    country: row.country || 'UNKNOWN', platform: row.platform || 'unknown',
    category: row.category || 'unknown', room: roomMatch ? roomMatch[1] : null,
    source: row.source || 'unknown', sourceEvidence: row.source_evidence || 'legacy',
    medium: row.medium || 'unknown', campaign: row.campaign || 'unknown',
    content: row.content || 'unknown', placement: row.placement || 'unknown',
    landingPath: row.landing_path || 'unknown', device: row.device || 'unknown',
    visitId: row.visit_id || null, trafficClass
  };
}
module.exports = { PLATFORMS, validDate, parseFilters, buildQuery, mapRow };
