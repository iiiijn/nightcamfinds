'use strict';

const { validDate } = require('./click-origins.cjs');
const { invalidCallbackPredicate } = require('./callback-integrity.cjs');

const TELEGRAM_SOURCES = Object.freeze(['telegram', 'tg', 't.me', 'telegram.me', 'telegram.org']);

function buildQuery(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };

  const params = [];
  const dateClick = [], dateVisit = [], dateConversion = [], dateLinkedClick = [];
  if (from) {
    params.push(from);
    dateClick.push("ac.clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')");
    dateVisit.push("tv.first_seen_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')");
    dateConversion.push("cc.received_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')");
    dateLinkedClick.push("acv.clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    params.push(to);
    dateClick.push("ac.clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    dateVisit.push("tv.first_seen_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    dateConversion.push("cc.received_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    dateLinkedClick.push("acv.clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }

  const sourceFilter = "LOWER(COALESCE(ac_source.source, '')) IN ('telegram','tg','t.me','telegram.me','telegram.org')";
  const invalidCallback = invalidCallbackPredicate('cc');
  const normalizedContent = "CASE WHEN LOWER(COALESCE(ac_source.content, '')) ~ '^room-[^:]+:' THEN REGEXP_REPLACE(LOWER(ac_source.content), '^room-[^:]+:', '') ELSE COALESCE(NULLIF(LOWER(ac_source.content), ''), '') END";

  const text = [
    'WITH click_groups AS (',
    "  SELECT UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    "         LOWER(COALESCE(NULLIF(ac.source, ''), 'unknown')) AS source,",
    "         COALESCE(NULLIF(LOWER(ac.medium), ''), 'unknown') AS medium,",
    "         COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    "         CASE WHEN LOWER(COALESCE(ac.content, '')) ~ '^room-[^:]+:' THEN REGEXP_REPLACE(LOWER(ac.content), '^room-[^:]+:', '') ELSE COALESCE(NULLIF(LOWER(ac.content), ''), '') END AS content,",
    '         COUNT(*)::int AS clicks,',
    "         COUNT(*) FILTER (WHERE LOWER(ac.platform) = 'chaturbate')::int AS chaturbate_clicks,",
    "         COUNT(*) FILTER (WHERE LOWER(ac.platform) = 'bongacams')::int AS bongacams_clicks,",
    "         COUNT(*) FILTER (WHERE ac.is_bot IS TRUE OR ac.bot_reason = 'known_bot_user_agent' OR tv.traffic_class = 'known_bot')::int AS known_bot_clicks,",
    "         COUNT(*) FILTER (WHERE (ac.bot_reason = 'suspected_automation_user_agent' OR (ac.is_bot IS NOT TRUE AND tv.traffic_class = 'suspected_bot')) AND NOT (ac.is_bot IS TRUE OR ac.bot_reason = 'known_bot_user_agent' OR tv.traffic_class = 'known_bot'))::int AS suspected_bot_clicks,",
    "         COUNT(*) FILTER (WHERE ac.is_bot IS NOT TRUE AND COALESCE(ac.bot_reason, '') <> 'suspected_automation_user_agent' AND tv.visit_id IS NULL)::int AS unclassified_clicks",
    '  FROM affiliate_clicks ac',
    '  LEFT JOIN traffic_visits tv ON tv.visit_id = ac.visit_id',
    '  WHERE ' + [...dateClick, "COALESCE(ac.is_owner_traffic, FALSE) IS FALSE", "LOWER(COALESCE(ac.source, '')) IN ('telegram','tg','t.me','telegram.me','telegram.org')", "LOWER(COALESCE(ac.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')"].join(' AND '),
    '  GROUP BY 1,2,3,4,5',
    '), visit_groups AS (',
    "  SELECT UPPER(COALESCE(NULLIF(tv.country, ''), 'UNKNOWN')) AS country,",
    "         LOWER(COALESCE(NULLIF(tv.source, ''), 'unknown')) AS source,",
    "         COALESCE(NULLIF(LOWER(tv.medium), ''), 'unknown') AS medium,",
    "         COALESCE(NULLIF(LOWER(tv.campaign), ''), 'unknown') AS campaign,",
    "         CASE WHEN LOWER(COALESCE(tv.content, '')) ~ '^room-[^:]+:' THEN REGEXP_REPLACE(LOWER(tv.content), '^room-[^:]+:', '') ELSE COALESCE(NULLIF(LOWER(tv.content), ''), '') END AS content,",
    '         COUNT(*)::int AS visits,',
    "         COUNT(*) FILTER (WHERE tv.traffic_class = 'unverified' AND EXISTS (SELECT 1 FROM traffic_engagement_events e WHERE e.visit_id = tv.visit_id AND e.event_type IN ('active_10s','scroll_50')))::int AS engaged_visits,",
    '         COUNT(*) FILTER (WHERE EXISTS (',
    "           SELECT 1 FROM affiliate_clicks acv WHERE acv.visit_id = tv.visit_id AND " + [...dateLinkedClick, "COALESCE(acv.is_owner_traffic, FALSE) IS FALSE", "LOWER(COALESCE(acv.source, '')) IN ('telegram','tg','t.me','telegram.me','telegram.org')", "LOWER(COALESCE(acv.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')"].join(' AND '),
    '         ))::int AS visits_with_affiliate_click',
    '  FROM traffic_visits tv',
    '  WHERE ' + [...dateVisit, "COALESCE(tv.is_owner_traffic, FALSE) IS FALSE", "LOWER(COALESCE(tv.source, '')) IN ('telegram','tg','t.me','telegram.me','telegram.org')", "LOWER(COALESCE(tv.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')"].join(' AND '),
    '  GROUP BY 1,2,3,4,5',
    '), matched_by_currency AS (',
    "  SELECT UPPER(COALESCE(NULLIF(cc.currency, ''), 'UNSPECIFIED')) AS currency,",
    "         UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    "         LOWER(COALESCE(NULLIF(ac.source, ''), 'unknown')) AS source,",
    "         COALESCE(NULLIF(LOWER(ac.medium), ''), 'unknown') AS medium,",
    "         COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    "         CASE WHEN LOWER(COALESCE(ac.content, '')) ~ '^room-[^:]+:' THEN REGEXP_REPLACE(LOWER(ac.content), '^room-[^:]+:', '') ELSE COALESCE(NULLIF(LOWER(ac.content), ''), '') END AS content,",
    '         COUNT(*)::int AS conversions,',
    '         COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout',
    '  FROM cb_conversions cc',
    '  JOIN LATERAL (',
    "    SELECT ac_source.country, ac_source.source, ac_source.medium, ac_source.campaign, " + normalizedContent + " AS content FROM affiliate_clicks ac_source",
    "    WHERE ac_source.click_id = cc.click_id AND LOWER(ac_source.platform) = 'chaturbate' AND COALESCE(ac_source.is_owner_traffic, FALSE) IS FALSE AND " + sourceFilter + " AND LOWER(COALESCE(ac_source.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')",
    '    ORDER BY ac_source.clicked_at ASC, ac_source.id ASC LIMIT 1',
    '  ) ac ON TRUE',
    '  WHERE cc.matched_click IS TRUE',
    "    AND LOWER(cc.conversion_type) IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')",
    "    AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL",
    '    AND NOT ' + invalidCallback,
    dateConversion.length ? '    AND ' + dateConversion.join(' AND ') : '',
    '  GROUP BY 1,2,3,4,5,6',
    '), conversion_groups AS (',
    '  SELECT country, source, medium, campaign, content,',
    '         SUM(conversions)::int AS matched_conversions,',
    '         jsonb_object_agg(currency, reported_payout) AS reported_payouts_by_currency',
    '  FROM matched_by_currency',
    '  GROUP BY country, source, medium, campaign, content',
    '), all_groups AS (',
    '  SELECT COALESCE(c.country, v.country) AS country,',
    '         COALESCE(c.source, v.source) AS source,',
    '         COALESCE(c.medium, v.medium) AS medium,',
    '         COALESCE(c.campaign, v.campaign) AS campaign,',
    '         COALESCE(c.content, v.content) AS content,',
    '         COALESCE(c.clicks, 0)::int AS clicks,',
    '         COALESCE(c.chaturbate_clicks, 0)::int AS chaturbate_clicks,',
    '         COALESCE(c.bongacams_clicks, 0)::int AS bongacams_clicks,',
    '         COALESCE(c.known_bot_clicks, 0)::int AS known_bot_clicks,',
    '         COALESCE(c.suspected_bot_clicks, 0)::int AS suspected_bot_clicks,',
    '         COALESCE(c.unclassified_clicks, 0)::int AS unclassified_clicks,',
    '         COALESCE(v.visits, 0)::int AS visits,',
    '         COALESCE(v.engaged_visits, 0)::int AS engaged_visits,',
    '         COALESCE(v.visits_with_affiliate_click, 0)::int AS visits_with_affiliate_click',
    '  FROM click_groups c FULL OUTER JOIN visit_groups v',
    '    ON c.country=v.country AND c.source=v.source AND c.medium=v.medium AND c.campaign=v.campaign AND c.content=v.content',
    ')',
    'SELECT g.country, g.source, g.medium, g.campaign, g.content, g.clicks, g.chaturbate_clicks, g.bongacams_clicks,',
    '       g.known_bot_clicks, g.suspected_bot_clicks, g.unclassified_clicks, g.visits, g.engaged_visits, g.visits_with_affiliate_click,',
    '       COALESCE(v.matched_conversions, 0)::int AS matched_conversions,',
    "       COALESCE(v.reported_payouts_by_currency, '{}'::jsonb) AS reported_payouts_by_currency",
    'FROM all_groups g',
    'LEFT JOIN conversion_groups v USING (country, source, medium, campaign, content)',
    'ORDER BY matched_conversions DESC, engaged_visits DESC, clicks DESC, visits DESC, country ASC, source ASC, campaign ASC, content ASC',
    'LIMIT 2000'
  ].filter(Boolean).join('\n');

  return { text, params, filters: { from, to } };
}

module.exports = { TELEGRAM_SOURCES, buildQuery };
