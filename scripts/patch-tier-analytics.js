const fs = require("fs");

const path = "start.js";
const marker = "NIGHTCAMFINDS_TIER_ANALYTICS_V1";
let s = fs.readFileSync(path, "utf8");
if (s.includes(marker)) process.exit(0);

const helper = `
// ${marker}
const CB_TIER1 = new Set(["AN","AT","AU","BE","CA","CH","DE","DK","FI","FK","FO","FR","GB","GG","GI","GL","IE","IS","JE","JP","LI","LU","NL","NO","NZ","QA","SE","SG","SM","UM","US","VI"]);
const CB_TIER2 = new Set(["AE","AW","BN","BR","BS","CY","ES","GQ","GR","HK","IL","IM","IT","KR","KW","KY","MO","PF","PR","PT","SI","VG"]);
const CB_TIER3 = new Set(["AG","AI","BB","BH","CK","CL","CZ","EE","GU","HR","HU","KN","LB","LT","LV","MP","MT","MX","NC","OM","PL","RU","SA","SC","SK","TR","TT","TW","UY","VE"]);
function cbTier(country) {
  const iso = String(country || "").toUpperCase();
  if (CB_TIER1.has(iso)) return "Tier 1";
  if (CB_TIER2.has(iso)) return "Tier 2";
  if (CB_TIER3.has(iso)) return "Tier 3";
  return "Unclassified";
}
`;

const anchor = "const loginAttempts = new Map();";
if (!s.includes(anchor)) throw new Error("start.js loginAttempts anchor not found");
s = s.replace(anchor, anchor + helper);

const oldTierBlock = `const tier1 = ["US","CA","GB","IE","AU","NZ","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE"];
  const tierPlaceholders = tier1.map((_, i) => \`$\${params.length + i + 1}\`).join(",");
  const tierRows = await pool.query(\`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE platform='bongacams')::int AS bonga FROM affiliate_clicks \${where ? where + " AND" : "WHERE"} UPPER(country) IN (\${tierPlaceholders})\`, [...params, ...tier1]);`;
const newTierBlock = `const tier1 = [...CB_TIER1];
  const tier2 = [...CB_TIER2];
  const tier3 = [...CB_TIER3];
  const tierPlaceholders = tier1.map((_, i) => \`$\${params.length + i + 1}\`).join(",");
  const tierRows = await pool.query(\`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE platform='bongacams')::int AS bonga FROM affiliate_clicks \${where ? where + " AND" : "WHERE"} UPPER(country) IN (\${tierPlaceholders})\`, [...params, ...tier1]);
  const clickTierRows = await q(\`SELECT CASE
    WHEN UPPER(country) = ANY($\${params.length + 1}::text[]) THEN 'Tier 1'
    WHEN UPPER(country) = ANY($\${params.length + 2}::text[]) THEN 'Tier 2'
    WHEN UPPER(country) = ANY($\${params.length + 3}::text[]) THEN 'Tier 3'
    ELSE 'Unclassified' END AS tier, COUNT(*)::int AS clicks
    FROM affiliate_clicks \${where} GROUP BY 1 ORDER BY 1\`, [...params, tier1, tier2, tier3]);`;
if (!s.includes(oldTierBlock)) throw new Error("start.js tier block not found");
s = s.replace(oldTierBlock, newTierBlock);

const conversionAnchor = "  const mediumStats = Object.fromEntries(mediums.map(r => [r.medium || \"unknown\", Number(r.n)]));";
const conversionInsert = `  const mediumStats = Object.fromEntries(mediums.map(r => [r.medium || \"unknown\", Number(r.n)]));
  const conversionCountryRows = await pool.query(\`SELECT country,
    COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations,
    COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases,
    COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_broadcaster-referral','revshare_webmaster-commission','revshare_payout-adjustment')),0)::numeric AS earnings
    FROM cb_conversions
    GROUP BY country\`);
  const conversionTiers = {\"Tier 1\":{registrations:0,purchases:0,earnings:0},\"Tier 2\":{registrations:0,purchases:0,earnings:0},\"Tier 3\":{registrations:0,purchases:0,earnings:0},\"Unclassified\":{registrations:0,purchases:0,earnings:0}};
  for (const row of conversionCountryRows.rows) {
    const tier = cbTier(row.country);
    conversionTiers[tier].registrations += Number(row.registrations || 0);
    conversionTiers[tier].purchases += Number(row.purchases || 0);
    conversionTiers[tier].earnings += Number(row.earnings || 0);
  }
  const tierClicks = Object.fromEntries(clickTierRows.map(r => [r.tier, Number(r.clicks || 0)]));`;
if (!s.includes(conversionAnchor)) throw new Error("start.js mediumStats anchor not found");
s = s.replace(conversionAnchor, conversionInsert);

const earningsOld = "  const earningsRows = await pool.query(\`SELECT COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases, COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_broadcaster-referral','revshare_webmaster-commission','revshare_payout-adjustment')),0)::numeric AS earnings FROM cb_conversions\`);";
const earningsNew = "  const earningsRows = await pool.query(\`SELECT COUNT(*) FILTER (WHERE conversion_type='revshare_signup-referral')::int AS registrations, COUNT(*) FILTER (WHERE conversion_type='revshare_purchase')::int AS purchases, COUNT(*) FILTER (WHERE conversion_type='revshare_broadcaster-referral')::int AS broadcaster_referrals, COUNT(*) FILTER (WHERE conversion_type='revshare_webmaster-commission')::int AS webmaster_commissions, COALESCE(SUM(payout) FILTER (WHERE conversion_type IN ('revshare_purchase','revshare_broadcaster-referral','revshare_webmaster-commission','revshare_payout-adjustment')),0)::numeric AS earnings FROM cb_conversions\`);";
if (!s.includes(earningsOld)) throw new Error("Dashboard earnings SQL anchor not found");
s = s.replace(earningsOld, earningsNew);

const returnAnchor = "    platforms, countries, sources, placements, campaigns, devices, mediums";
const returnReplacement = "    platforms, countries, sources, placements, campaigns, devices, mediums, tierClicks, conversionTiers, tierDefinition: { tier1: tier1.length, tier2: tier2.length, tier3: tier3.length }";
if (!s.includes(returnAnchor)) throw new Error("start.js dashboard return anchor not found");
s = s.replace(returnAnchor, returnReplacement);

fs.writeFileSync(path, s);
console.log("NightCamFinds tier analytics patch applied");
