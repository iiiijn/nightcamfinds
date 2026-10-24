-- NightCamFinds RevShare-first reporting

-- Total Chaturbate RevShare revenue
SELECT
  COALESCE(SUM(payout), 0) AS revshare_revenue
FROM affiliate_conversions
WHERE platform = 'chaturbate'
  AND revenue_class = 'revshare';

-- RevShare revenue by country
SELECT
  country,
  COALESCE(SUM(payout), 0) AS revenue,
  COUNT(*) AS events
FROM affiliate_conversions
WHERE platform = 'chaturbate'
  AND revenue_class = 'revshare'
GROUP BY country
ORDER BY revenue DESC;

-- RevShare revenue by traffic source, joined through click_id
SELECT
  c.source,
  c.medium,
  c.campaign,
  COALESCE(SUM(v.payout), 0) AS revenue,
  COUNT(DISTINCT v.transaction_id) AS conversions,
  COUNT(DISTINCT c.click_id) AS clicks,
  CASE WHEN COUNT(DISTINCT c.click_id) = 0 THEN 0
       ELSE COALESCE(SUM(v.payout), 0) / COUNT(DISTINCT c.click_id)
  END AS revshare_epc
FROM affiliate_conversions v
JOIN affiliate_clicks c ON c.click_id = v.click_id
WHERE v.platform = 'chaturbate'
  AND v.revenue_class = 'revshare'
GROUP BY c.source, c.medium, c.campaign
ORDER BY revenue DESC;

-- Tier-1 RevShare performance
SELECT
  c.country,
  COUNT(DISTINCT c.click_id) AS clicks,
  COUNT(DISTINCT v.transaction_id) AS conversions,
  COALESCE(SUM(v.payout), 0) AS revenue,
  CASE WHEN COUNT(DISTINCT c.click_id) = 0 THEN 0
       ELSE COALESCE(SUM(v.payout), 0) / COUNT(DISTINCT c.click_id)
  END AS revshare_epc
FROM affiliate_clicks c
LEFT JOIN affiliate_conversions v
  ON v.click_id = c.click_id
 AND v.platform = 'chaturbate'
 AND v.revenue_class = 'revshare'
WHERE c.platform = 'chaturbate'
  AND c.country IN ('US','CA','GB','IE','AU','NZ','DE','FR','NL','SE','NO','DK','FI','CH','AT','BE')
GROUP BY c.country
ORDER BY revenue DESC;
