'use strict';
const { validDate } = require('./click-origins.cjs');
const { invalidCallbackPredicate } = require('./callback-integrity.cjs');

function buildQueries(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  const callbackParams = [], callbackWhere = [];
  const clickParams = [], clickWhere = [];
  if (from) {
    callbackParams.push(from); callbackWhere.push("cc.received_at >= ($" + callbackParams.length + "::date AT TIME ZONE 'UTC')");
    clickParams.push(from); clickWhere.push("ac.clicked_at >= ($" + clickParams.length + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    callbackParams.push(to); callbackWhere.push("cc.received_at < (($" + callbackParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    clickParams.push(to); clickWhere.push("ac.clicked_at < (($" + clickParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }
  const invalidCallback = invalidCallbackPredicate('cc');
  const callbacks = [
    'SELECT COUNT(*)::int AS total,',
    'COUNT(*) FILTER (WHERE NOT ' + invalidCallback + ')::int AS real,',
    'COUNT(*) FILTER (WHERE ' + invalidCallback + ')::int AS test,',
    'COUNT(*) FILTER (WHERE ' + invalidCallback + ')::int AS invalid_callback,',
    "COUNT(*) FILTER (WHERE NOT " + invalidCallback + " AND cc.matched_click IS TRUE AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL)::int AS matched,",
    "COUNT(*) FILTER (WHERE NOT " + invalidCallback + " AND NULLIF(BTRIM(cc.click_id), '') IS NULL)::int AS missing_click_id,",
    "COUNT(*) FILTER (WHERE NOT " + invalidCallback + " AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL AND cc.matched_click IS NOT TRUE)::int AS click_id_not_found",
    'FROM cb_conversions cc',
    callbackWhere.length ? 'WHERE ' + callbackWhere.join(' AND ') : ''
  ].filter(Boolean).join('\n');
  const clicks = [
    'SELECT LOWER(ac.platform) AS platform, COUNT(*)::int AS clicks,',
    "COUNT(*) FILTER (WHERE NULLIF(BTRIM(ac.click_id), '') IS NOT NULL)::int AS click_ids_generated,",
    "COUNT(*) FILTER (WHERE NULLIF(BTRIM(ac.click_id), '') IS NULL)::int AS clicks_without_click_id,",
    "COUNT(*) FILTER (WHERE (LOWER(ac.platform) = 'chaturbate' AND cb.click_id IS NOT NULL) OR (LOWER(ac.platform) = 'bongacams' AND bc.click_id IS NOT NULL))::int AS local_ledger_entries",
    'FROM affiliate_clicks ac',
    'LEFT JOIN cb_clicks cb ON cb.click_id = ac.click_id',
    'LEFT JOIN bonga_clicks bc ON bc.click_id = ac.click_id',
    clickWhere.length ? 'WHERE ' + clickWhere.join(' AND ') : '',
    'GROUP BY LOWER(ac.platform)'
  ].filter(Boolean).join('\n');
  const orphanParams = [];
  const orphanCbWhere = [];
  const orphanBongaWhere = [];
  if (from) {
    orphanParams.push(from);
    const p = orphanParams.length;
    orphanCbWhere.push("cb.clicked_at >= ($" + p + "::date AT TIME ZONE 'UTC')");
    orphanBongaWhere.push("bc.clicked_at >= ($" + p + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    orphanParams.push(to);
    const p = orphanParams.length;
    orphanCbWhere.push("cb.clicked_at < (($" + p + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    orphanBongaWhere.push("bc.clicked_at < (($" + p + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }
  const orphans = [
    "SELECT 'chaturbate'::text AS platform, COUNT(*)::int AS orphaned_ledger_entries",
    "FROM cb_clicks cb",
    "WHERE NULLIF(BTRIM(cb.click_id), '') IS NOT NULL",
    "AND NOT EXISTS (SELECT 1 FROM affiliate_clicks ac WHERE ac.click_id = cb.click_id AND LOWER(ac.platform) = 'chaturbate')",
    orphanCbWhere.length ? 'AND ' + orphanCbWhere.join(' AND ') : '',
    "UNION ALL",
    "SELECT 'bongacams'::text AS platform, COUNT(*)::int AS orphaned_ledger_entries",
    "FROM bonga_clicks bc",
    "WHERE NULLIF(BTRIM(bc.click_id), '') IS NOT NULL",
    "AND NOT EXISTS (SELECT 1 FROM affiliate_clicks ac WHERE ac.click_id = bc.click_id AND LOWER(ac.platform) = 'bongacams')",
    orphanBongaWhere.length ? 'AND ' + orphanBongaWhere.join(' AND ') : ''
  ].filter(Boolean).join('\n');
  return { callbacks: { text: callbacks, params: callbackParams }, clicks: { text: clicks, params: clickParams }, orphans: { text: orphans, params: orphanParams }, filters: { from, to } };
}
module.exports = { buildQueries };
