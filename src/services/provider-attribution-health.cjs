'use strict';
const { validDate } = require('./click-origins.cjs');

function buildQueries(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  const callbackParams = [], callbackWhere = [];
  const clickParams = [], clickWhere = [];
  if (from) {
    callbackParams.push(from); callbackWhere.push("cc.received_at >= ($" + callbackParams.length + "::date AT TIME ZONE 'UTC')");
    clickParams.push(from); clickWhere.push("clicked_at >= ($" + clickParams.length + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    callbackParams.push(to); callbackWhere.push("cc.received_at < (($" + callbackParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    clickParams.push(to); clickWhere.push("clicked_at < (($" + clickParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }
  const callbacks = [
    'SELECT COUNT(*)::int AS total,',
    "COUNT(*) FILTER (WHERE NOT (EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(cc.raw_payload, '{}'::jsonb)) AS p(key,value) WHERE p.value ~ '^\\\\{[A-Za-z][A-Za-z0-9_]*\\\\}$')))::int AS real,",
    "COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(cc.raw_payload, '{}'::jsonb)) AS p(key,value) WHERE p.value ~ '^\\\\{[A-Za-z][A-Za-z0-9_]*\\\\}$'))::int AS test,",
    "COUNT(*) FILTER (WHERE cc.matched_click IS TRUE AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL)::int AS matched,",
    "COUNT(*) FILTER (WHERE NULLIF(BTRIM(cc.click_id), '') IS NULL)::int AS missing_click_id,",
    "COUNT(*) FILTER (WHERE NULLIF(BTRIM(cc.click_id), '') IS NOT NULL AND cc.matched_click IS NOT TRUE)::int AS click_id_not_found",
    'FROM cb_conversions cc',
    callbackWhere.length ? 'WHERE ' + callbackWhere.join(' AND ') : ''
  ].filter(Boolean).join('\n');
  const clicks = [
    'SELECT LOWER(platform) AS platform, COUNT(*)::int AS clicks',
    'FROM affiliate_clicks',
    clickWhere.length ? 'WHERE ' + clickWhere.join(' AND ') : '',
    'GROUP BY LOWER(platform)'
  ].filter(Boolean).join('\n');
  return { callbacks: { text: callbacks, params: callbackParams }, clicks: { text: clicks, params: clickParams }, filters: { from, to } };
}
module.exports = { buildQueries };
