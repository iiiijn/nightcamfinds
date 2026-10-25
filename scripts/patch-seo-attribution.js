const fs = require('fs');
const path = 'start.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_SEO_ATTRIBUTION_V1';
if (s.includes(marker)) process.exit(0);

const schemaAnchor = '  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");';
const schemaInsert = `  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255) NOT NULL DEFAULT '/'");
  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_landing_path_idx ON affiliate_clicks(landing_path)");`;
if (!s.includes(schemaAnchor)) throw new Error('SEO attribution schema anchor not found');
s = s.replace(schemaAnchor, schemaAnchor + '\n' + schemaInsert);

const saveAnchor = `      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement, click.platform, click.medium, click.content, click.device]`;
const saveReplacement = `      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement, click.platform, click.medium, click.content, click.device, click.landingPath]`;
if (!s.includes(saveAnchor)) throw new Error('SEO attribution save values anchor not found');
s = s.replace(saveAnchor, saveReplacement);

const insertAnchor = `      \`INSERT INTO affiliate_clicks (click_id,country,category,source,campaign,placement,platform,medium,content,device)\n       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)\`,`;
const insertReplacement = `      \`INSERT INTO affiliate_clicks (click_id,country,category,source,campaign,placement,platform,medium,content,device,landing_path)\n       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)\`,`;
if (!s.includes(insertAnchor)) throw new Error('SEO attribution insert anchor not found');
s = s.replace(insertAnchor, insertReplacement);

const parseReturn = '  return { clickId: makeClickId(), country: country(req), category, source, medium, campaign, placement, content, device: device(req), platform };';
const parseReplacement = `  const landingPath = String(incoming.pathname || '/').slice(0, 255) || '/';\n  return { clickId: makeClickId(), country: country(req), category, source, medium, campaign, placement, content, device: device(req), landingPath, platform };`;
if (!s.includes(parseReturn)) throw new Error('SEO attribution parse anchor not found');
s = s.replace(parseReturn, parseReplacement);

const statsAnchor = `  const mediumStats = Object.fromEntries(mediums.map(r => [r.medium || "unknown", Number(r.n)]));`;
const statsInsert = [
  '  const seoRows = await q(`SELECT COALESCE(landing_path, \'/\') AS landing_path, COUNT(*)::int AS clicks',
  '    FROM affiliate_clicks ${where} GROUP BY COALESCE(landing_path, \'/\') ORDER BY clicks DESC LIMIT 50`);',
  '  const seoRevenueRows = await pool.query(`SELECT COALESCE(ac.landing_path, \'/\') AS landing_path,',
  '      COUNT(DISTINCT ac.click_id)::int AS clicks,',
  '      COUNT(DISTINCT c.id) FILTER (WHERE c.conversion_type=\'revshare_signup-referral\')::int AS registrations,',
  '      COUNT(DISTINCT c.id) FILTER (WHERE c.conversion_type=\'revshare_purchase\')::int AS purchases,',
  '      COALESCE(SUM(c.payout) FILTER (WHERE c.conversion_type IN (\'revshare_purchase\',\'revshare_payout-adjustment\')),0)::numeric AS earnings',
  '    FROM affiliate_clicks ac',
  '    LEFT JOIN cb_conversions c ON c.click_id = ac.click_id',
  '    ${where.replaceAll(\'clicked_at\',\'ac.clicked_at\')}',
  '    GROUP BY COALESCE(ac.landing_path, \'/\') ORDER BY earnings DESC, clicks DESC LIMIT 50`, params);',
  '  const seoPages = Object.fromEntries(seoRows.map(r => [r.landing_path || \'/\', Number(r.clicks)]));',
  '  const seoRevenue = seoRevenueRows.rows.map(r => ({ landingPath: r.landing_path || \'/\', clicks: Number(r.clicks || 0), registrations: Number(r.registrations || 0), purchases: Number(r.purchases || 0), earnings: Number(r.earnings || 0) }));'
].join('\\n');
if (!s.includes(statsAnchor)) throw new Error('SEO attribution stats anchor not found');
s = s.replace(statsAnchor, statsAnchor + '\n' + statsInsert);

const returnAnchor = '    platforms, countries, sources, placements, campaigns, devices, mediums\n  };';
const returnReplacement = '    platforms, countries, sources, placements, campaigns, devices, mediums, seoPages, seoRevenue\n  };';
if (!s.includes(returnAnchor)) throw new Error('SEO attribution return anchor not found');
s = s.replace(returnAnchor, returnReplacement);

s = s.replace(/`INSERT INTO cb_clicks \(click_id,country,category,source,campaign,placement\)/, '`INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement)');
fs.writeFileSync(path, s);
console.log('NightCamFinds SEO attribution patch applied');
