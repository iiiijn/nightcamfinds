'use strict';

const { validDate } = require('./click-origins.cjs');
const { invalidCallbackPredicate } = require('./callback-integrity.cjs');

function buildQuery(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };

  const params = [];
  const clickWhere = [
    "COALESCE(ac.is_owner_traffic, FALSE) IS FALSE",
    "LOWER(COALESCE(ac.source, '')) <> 'test'",
    "LOWER(COALESCE(ac.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')"
  ];
  const visitWhere = [
    "COALESCE(tv.is_owner_traffic, FALSE) IS FALSE",
    "LOWER(COALESCE(tv.source, '')) <> 'test'",
    "LOWER(COALESCE(tv.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')"
  ];
  const conversionWhere = [];
  if (from) {
    params.push(from);
    const p = '$' + params.length;
    clickWhere.push("ac.clicked_at >= (" + p + "::date AT TIME ZONE 'UTC')");
    visitWhere.push("tv.first_seen_at >= (" + p + "::date AT TIME ZONE 'UTC')");
    conversionWhere.push("cc.received_at >= (" + p + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    params.push(to);
    const p = '$' + params.length;
    clickWhere.push("ac.clicked_at < ((" + p + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    visitWhere.push("tv.first_seen_at < ((" + p + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    conversionWhere.push("cc.received_at < ((" + p + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }

  const invalidCallback = invalidCallbackPredicate('cc');
  const text = [
    'WITH click_groups AS (',
    " SELECT COALESCE(NULLIF(BTRIM(ac.landing_path), ''), 'unknown') AS landing_path,",
    " UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    " LOWER(COALESCE(NULLIF(ac.platform, ''), 'unknown')) AS platform,",
    " COALESCE(NULLIF(LOWER(ac.source), ''), 'unknown') AS source,",
    " COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    ' COUNT(*)::int AS clicks,',
    " COUNT(*) FILTER (WHERE ac.is_bot IS TRUE OR ac.bot_reason = 'known_bot_user_agent' OR tv.traffic_class = 'known_bot')::int AS known_bot_clicks,",
    " COUNT(*) FILTER (WHERE ac.bot_reason = 'suspected_automation_user_agent' OR (ac.is_bot IS NOT TRUE AND tv.traffic_class = 'suspected_bot'))::int AS suspected_bot_clicks,",
    " COUNT(*) FILTER (WHERE tv.visit_id IS NOT NULL AND tv.traffic_class = 'unverified' AND ac.is_bot IS NOT TRUE AND COALESCE(ac.bot_reason, '') <> 'suspected_automation_user_agent')::int AS unverified_not_flagged_clicks,",
    " COUNT(*) FILTER (WHERE tv.visit_id IS NULL AND ac.is_bot IS NOT TRUE AND COALESCE(ac.bot_reason, '') <> 'suspected_automation_user_agent')::int AS unclassified_clicks",
    ' FROM affiliate_clicks ac LEFT JOIN traffic_visits tv ON tv.visit_id = ac.visit_id',
    ' WHERE ' + clickWhere.join(' AND '),
    ' GROUP BY 1,2,3,4,5',
    '), visit_groups AS (',
    " SELECT COALESCE(NULLIF(BTRIM(tv.landing_path), ''), 'unknown') AS landing_path,",
    " UPPER(COALESCE(NULLIF(tv.country, ''), 'UNKNOWN')) AS country,",
    " LOWER(COALESCE(NULLIF(tv.platform, ''), 'unknown')) AS platform,",
    " COALESCE(NULLIF(LOWER(tv.source), ''), 'unknown') AS source,",
    " COALESCE(NULLIF(LOWER(tv.campaign), ''), 'unknown') AS campaign,",
    ' COUNT(*)::int AS visits,',
    " COUNT(*) FILTER (WHERE tv.traffic_class = 'unverified' AND EXISTS (SELECT 1 FROM traffic_engagement_events e WHERE e.visit_id = tv.visit_id AND e.event_type IN ('active_10s','scroll_50')))::int AS engaged_visits",
    ' FROM traffic_visits tv WHERE ' + visitWhere.join(' AND '),
    ' GROUP BY 1,2,3,4,5',
    '), matched_by_currency AS (',
    " SELECT COALESCE(NULLIF(BTRIM(ac.landing_path), ''), 'unknown') AS landing_path,",
    " UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    " LOWER(COALESCE(NULLIF(ac.platform, ''), 'chaturbate')) AS platform,",
    " COALESCE(NULLIF(LOWER(ac.source), ''), 'unknown') AS source,",
    " COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    " UPPER(COALESCE(NULLIF(cc.currency, ''), 'UNSPECIFIED')) AS currency,",
    ' COUNT(*)::int AS conversions, COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout',
    ' FROM cb_conversions cc',
    ' JOIN LATERAL (SELECT landing_path, country, platform, source, campaign FROM affiliate_clicks',
    " WHERE click_id = cc.click_id AND LOWER(platform) = 'chaturbate' AND COALESCE(is_owner_traffic, FALSE) IS FALSE AND LOWER(COALESCE(source, '')) <> 'test' AND LOWER(COALESCE(campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')",
    ' ORDER BY clicked_at ASC, id ASC LIMIT 1) ac ON TRUE',
    ' WHERE cc.matched_click IS TRUE AND NULLIF(BTRIM(cc.click_id), \'\') IS NOT NULL',
    " AND LOWER(cc.conversion_type) IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')",
    ' AND NOT ' + invalidCallback,
    conversionWhere.length ? ' AND ' + conversionWhere.join(' AND ') : '',
    ' GROUP BY 1,2,3,4,5,6',
    '), conversion_groups AS (',
    ' SELECT landing_path, country, platform, source, campaign, SUM(conversions)::int AS matched_conversions,',
    " jsonb_object_agg(currency, reported_payout) AS reported_payouts_by_currency FROM matched_by_currency GROUP BY 1,2,3,4,5",
    '), all_groups AS (',
    ' SELECT COALESCE(c.landing_path,v.landing_path) AS landing_path, COALESCE(c.country,v.country) AS country,',
    ' COALESCE(c.platform,v.platform) AS platform, COALESCE(c.source,v.source) AS source, COALESCE(c.campaign,v.campaign) AS campaign,',
    ' COALESCE(c.clicks,0)::int AS clicks, COALESCE(c.known_bot_clicks,0)::int AS known_bot_clicks,',
    ' COALESCE(c.suspected_bot_clicks,0)::int AS suspected_bot_clicks, COALESCE(c.unverified_not_flagged_clicks,0)::int AS unverified_not_flagged_clicks,',
    ' COALESCE(c.unclassified_clicks,0)::int AS unclassified_clicks, COALESCE(v.visits,0)::int AS visits, COALESCE(v.engaged_visits,0)::int AS engaged_visits',
    ' FROM click_groups c FULL OUTER JOIN visit_groups v USING (landing_path,country,platform,source,campaign)',
    ')',
    ' SELECT g.*, COALESCE(c.matched_conversions,0)::int AS matched_conversions,',
    " COALESCE(c.reported_payouts_by_currency,'{}'::jsonb) AS reported_payouts_by_currency",
    ' FROM all_groups g LEFT JOIN conversion_groups c USING (landing_path,country,platform,source,campaign)',
    ' ORDER BY matched_conversions DESC, clicks DESC, visits DESC, landing_path ASC LIMIT 2000'
  ].join('\n');
  return { text, params, filters: { from, to }, dateBasis: 'click_date_visit_first_seen_conversion_received_at_utc' };
}

module.exports = { buildQuery };
