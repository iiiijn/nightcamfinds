'use strict';

const { validDate } = require('./click-origins.cjs');
const { invalidCallbackPredicate, typedMacroPredicate } = require('./callback-integrity.cjs');

function buildQuery(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  const params = [];
  const where = [];
  if (from) { params.push(from); where.push("cc.received_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')"); }
  if (to) { params.push(to); where.push("cc.received_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')"); }
  const typedMacroPredicateSql = typedMacroPredicate('cc');
  const isMacro = invalidCallbackPredicate('cc');
  const text = [
    'SELECT',
    "COALESCE(NULLIF(UPPER(ac.country), ''), NULLIF(UPPER(bc.country), ''), NULLIF(UPPER(cc.country), ''), 'UNKNOWN') AS country,",
    "'chaturbate'::text AS platform,",
    "COALESCE(NULLIF(LOWER(ac.source), ''), NULLIF(LOWER(bc.source), ''), NULLIF(LOWER(cc.source), ''), 'unknown') AS source,",
    "COALESCE(NULLIF(LOWER(ac.campaign), ''), NULLIF(LOWER(bc.campaign), ''), NULLIF(LOWER(cc.campaign_id), ''), 'unknown') AS campaign,",
    "LOWER(COALESCE(NULLIF(cc.conversion_type, ''), 'unknown')) AS conversion_type,",
    "COALESCE(NULLIF(UPPER(cc.currency), ''), 'UNSPECIFIED') AS currency,",
    isMacro + ' AS is_test,',
    "CASE WHEN " + typedMacroPredicateSql + " THEN 'invalid_callback' WHEN NULLIF(BTRIM(cc.click_id), '') IS NULL THEN 'missing_click_id' WHEN cc.matched_click IS TRUE THEN 'matched' ELSE 'click_id_not_found' END AS match_status,",
    'COUNT(*)::int AS conversions,',
    'COUNT(*) FILTER (WHERE cc.matched_click IS TRUE AND NOT ' + isMacro + ')::int AS matched_conversions,',
    'COUNT(*) FILTER (WHERE cc.matched_click IS NOT TRUE AND NOT ' + isMacro + ')::int AS unmatched_conversions,',
    'COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout',
    'FROM cb_conversions cc',
    'LEFT JOIN cb_clicks bc ON bc.click_id = cc.click_id',
    "LEFT JOIN LATERAL (SELECT country, source, campaign FROM affiliate_clicks WHERE click_id = cc.click_id AND LOWER(platform) = 'chaturbate' ORDER BY clicked_at ASC, id ASC LIMIT 1) ac ON TRUE",
    (where.length ? 'WHERE ' + where.join(' AND ') : ''),
    'GROUP BY 1,2,3,4,5,6,7,8',
    'ORDER BY is_test ASC, conversions DESC, currency ASC, country ASC, source ASC, campaign ASC',
    'LIMIT 2000'
  ].filter(Boolean).join('\n');
  return { text, params, filters: { from, to } };
}
module.exports = { buildQuery };
