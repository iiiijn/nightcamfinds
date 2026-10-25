const fs = require('fs');

function patchFile(file, marker, apply) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(marker)) return;
  const next = apply(s);
  if (!next || next === s) throw new Error(`SEO attribution anchor not found in ${file}`);
  fs.writeFileSync(file, next);
  console.log(`Applied ${marker} to ${file}`);
}

patchFile('server.js', 'NIGHTCAMFINDS_SEO_ATTRIBUTION_SERVER_V2', s => {
  const schemaAnchor = '  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");';
  const schemaInsert = '  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255) NOT NULL DEFAULT \'/\'");\n  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_landing_path_idx ON affiliate_clicks(landing_path)");';
  if (!s.includes(schemaAnchor)) throw new Error('server schema anchor missing');
  s = s.replace(schemaAnchor, schemaAnchor + '\n' + schemaInsert);
  const sig = 'async function countClick({ src, country, category = "unknown", source = "direct", campaign = "unknown", medium = "unknown", content = "", device = "unknown", clickId, platform = "chaturbate" }) {';
  const sig2 = 'async function countClick({ src, country, category = "unknown", source = "direct", campaign = "unknown", medium = "unknown", content = "", device = "unknown", clickId, platform = "chaturbate", landingPath = "/" }) {';
  if (!s.includes(sig)) throw new Error('countClick signature anchor missing');
  s = s.replace(sig, sig2);
  const insert = '"INSERT INTO affiliate_clicks (country, category, source, campaign, placement, platform, medium, content, device, click_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",';
  const insert2 = '"INSERT INTO affiliate_clicks (country, category, source, campaign, placement, platform, medium, content, device, click_id, landing_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",';
  if (!s.includes(insert)) throw new Error('countClick insert anchor missing');
  s = s.replace(insert, insert2);
  const values = '[country, category, source, campaign, src, platform, medium, content, device, clickId || null]';
  const values2 = '[country, category, source, campaign, src, platform, medium, content, device, clickId || null, landingPath || "/"]';
  if (!s.includes(values)) throw new Error('countClick values anchor missing');
  s = s.replace(values, values2);
  const call = '    await countClick({ src, country, category, source, campaign, medium, content, device, clickId, platform });';
  const call2 = '    const landingPath = String(url.searchParams.get("lp") || "/").slice(0, 255);\n    await countClick({ src, country, category, source, campaign, medium, content, device, clickId, platform, landingPath: landingPath.startsWith("/") ? landingPath : "/" });';
  if (!s.includes(call)) throw new Error('countClick call anchor missing');
  s = s.replace(call, call2);
  const marker = '\nserver.listen(PORT, () => console.log(`NightCamFinds listening on ${PORT}`));';
  if (!s.includes(marker)) throw new Error('server ending anchor missing');
  return s.replace(marker, '\n// NIGHTCAMFINDS_SEO_ATTRIBUTION_SERVER_V2' + marker);
});

patchFile('route.js', 'NIGHTCAMFINDS_SEO_ATTRIBUTION_ROUTE_V2', s => {
  const schemaAnchor = '  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");';
  const schemaInsert = '  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255) NOT NULL DEFAULT \'/\'");\n  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_landing_path_idx ON affiliate_clicks(landing_path)");';
  if (!s.includes(schemaAnchor)) throw new Error('route schema anchor missing');
  s = s.replace(schemaAnchor, schemaAnchor + '\n' + schemaInsert);
  const statsAnchor = '  const devices = {};';
  const statsInsert = '  const seoRevenueRows = await pool.query(`SELECT COALESCE(ac.landing_path, \'/\') AS landing_path, COUNT(DISTINCT ac.click_id)::int AS clicks, COUNT(DISTINCT c.id) FILTER (WHERE c.conversion_type=\'revshare_signup-referral\')::int AS registrations, COUNT(DISTINCT c.id) FILTER (WHERE c.conversion_type=\'revshare_purchase\')::int AS purchases, COALESCE(SUM(c.payout) FILTER (WHERE c.conversion_type IN (\'revshare_purchase\',\'revshare_payout-adjustment\')),0)::numeric AS earnings FROM affiliate_clicks ac LEFT JOIN cb_conversions c ON c.click_id = ac.click_id ${cb.where ? cb.where.replaceAll(\'clicked_at\',\'ac.clicked_at\') : \'\'} GROUP BY COALESCE(ac.landing_path, \'/\') ORDER BY earnings DESC, clicks DESC LIMIT 50`, cb.params);\n  const seoRevenue = seoRevenueRows.rows.map(r => ({ landingPath: r.landing_path || \'/\', clicks: Number(r.clicks || 0), registrations: Number(r.registrations || 0), purchases: Number(r.purchases || 0), earnings: Number(r.earnings || 0) }));';
  if (!s.includes(statsAnchor)) throw new Error('route stats anchor missing');
  s = s.replace(statsAnchor, statsAnchor + '\n' + statsInsert);
  const returnAnchor = '    placements,\n    devices\n  };';
  const returnReplacement = '    placements,\n    devices,\n    seoRevenue\n  };';
  if (!s.includes(returnAnchor)) throw new Error('route return anchor missing');
  s = s.replace(returnAnchor, returnReplacement);
  const marker = '\nhttp.createServer = function routeDashboard';
  if (!s.includes(marker)) throw new Error('route dashboard ending anchor missing');
  return s.replace(marker, '\n  // NIGHTCAMFINDS_SEO_ATTRIBUTION_ROUTE_V2' + marker);
});

patchFile('public/app.js', 'NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V2', s => {
  const anchor = '    placement: extra.placement || src\n  });';
  const replacement = '    placement: extra.placement || src,\n    lp: location.pathname.slice(0, 255) || "/"\n  });';
  if (!s.includes(anchor)) throw new Error('app trackingQuery anchor missing');
  return s.replace(anchor, replacement) + '\n// NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V2\n';
});

patchFile('public/dashboard.html', 'NIGHTCAMFINDS_DASHBOARD_SEO_ATTRIBUTION_V2', s => {
  const panelAnchor = '<section class="panel"><h2>Tracking health</h2>';
  const panel = '<section class="panel"><h2>SEO page revenue attribution</h2><p class="note">Landing pages that generated tracked affiliate clicks and confirmed Chaturbate RevShare conversions.</p><div id="seoAttribution"></div></section>\n';
  if (!s.includes(panelAnchor)) throw new Error('dashboard panel anchor missing');
  s = s.replace(panelAnchor, panel + panelAnchor);
  const jsAnchor = "function setHealth(id,active,detail){";
  const helper = "function renderSeoAttribution(rows){const el=$('seoAttribution');if(!el)return;if(!Array.isArray(rows)||!rows.length){el.innerHTML='<p class=\\\"hint\\\">No SEO-attributed data for this period.</p>';return}el.innerHTML='<table class=\\\"table\\\"><thead><tr><th>Landing page</th><th>Clicks</th><th>Registrations</th><th>Purchases</th><th>Earnings</th><th>EPC</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.landingPath||'/')+'</td><td>'+n(r.clicks)+'</td><td>'+n(r.registrations)+'</td><td>'+n(r.purchases)+'</td><td>'+money(r.earnings)+'</td><td>'+money(r.clicks?Number(r.earnings||0)/Number(r.clicks):0)+'</td></tr>').join('')+'</tbody></table>'}\n";
  if (!s.includes(jsAnchor)) throw new Error('dashboard JS anchor missing');
  s = s.replace(jsAnchor, helper + jsAnchor);
  const jsonAnchor = 'const j=await r.json();';
  if (!s.includes(jsonAnchor)) throw new Error('dashboard JSON anchor missing');
  s = s.replace(jsonAnchor, jsonAnchor + 'renderSeoAttribution(j.seoRevenue||[]);');
  return s + '\n<!-- NIGHTCAMFINDS_DASHBOARD_SEO_ATTRIBUTION_V2 -->\n';
});

require('./patch-seo-attribution-v3');
console.log('NightCamFinds SEO attribution v2 patch complete');
