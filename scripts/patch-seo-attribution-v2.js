const fs = require('fs');

function patchFile(file, marker, apply, { required = true } = {}) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(marker)) {
    console.log(`${marker} already applied`);
    return true;
  }
  try {
    const next = apply(s);
    if (!next || next === s) throw new Error(`SEO attribution anchor not found in ${file}`);
    fs.writeFileSync(file, next);
    console.log(`Applied ${marker} to ${file}`);
    return true;
  } catch (err) {
    if (required) throw err;
    console.warn(`Skipped optional ${marker}: ${err.message}`);
    return false;
  }
}

// The production service is route.js. The old server.js patch was tied to a
// retired runtime and caused Render to fail before route.js could start.
// Keep the startup patch additive and compatible with the current architecture.
patchFile('route.js', 'NIGHTCAMFINDS_SEO_ATTRIBUTION_ROUTE_V2', s => {
  const schemaAnchor = '  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");';
  if (!s.includes(schemaAnchor)) throw new Error('route schema anchor missing');
  const schemaInsert = '  await pool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255) NOT NULL DEFAULT \'/\'");\n  await pool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_landing_path_idx ON affiliate_clicks(landing_path)");';
  s = s.replace(schemaAnchor, schemaAnchor + '\n' + schemaInsert);

  const statsAnchor = '  const devices = {};';
  if (!s.includes(statsAnchor)) throw new Error('route stats anchor missing');
  const statsInsert = '  const seoRevenue = [];';
  s = s.replace(statsAnchor, statsAnchor + '\n' + statsInsert);

  const marker = '\nhttp.createServer = function routeDashboard';
  if (!s.includes(marker)) throw new Error('route dashboard ending anchor missing');
  return s.replace(marker, '\n  // NIGHTCAMFINDS_SEO_ATTRIBUTION_ROUTE_V2' + marker);
}, { required: false });

patchFile('public/app.js', 'NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V2', s => {
  const anchor = '    placement: extra.placement || src\n  });';
  const replacement = '    placement: extra.placement || src,\n    lp: location.pathname.slice(0, 255) || "/"\n  });';
  if (!s.includes(anchor)) throw new Error('app trackingQuery anchor missing');
  return s.replace(anchor, replacement) + '\n// NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V2\n';
});

// Dashboard markup has changed since the original SEO panel patch. Do not let
// a cosmetic analytics-panel mismatch block the production site from starting.
patchFile('public/dashboard.html', 'NIGHTCAMFINDS_DASHBOARD_SEO_ATTRIBUTION_V2', s => {
  const panelAnchor = '<section class="panel"><h2>Chaturbate conversion events</h2>';
  const panel = '<section class="panel"><h2>SEO page revenue attribution</h2><p class="note">Landing pages associated with tracked affiliate clicks.</p><div id="seoAttribution"></div></section>\n';
  if (!s.includes(panelAnchor)) throw new Error('dashboard panel anchor missing');
  s = s.replace(panelAnchor, panel + panelAnchor);

  const jsAnchor = "function setHealth(id,active,detail){";
  if (!s.includes(jsAnchor)) throw new Error('dashboard JS anchor missing');
  const helper = "function renderSeoAttribution(rows){const el=document.getElementById('seoAttribution');if(!el)return;if(!Array.isArray(rows)||!rows.length){el.innerHTML='<p class=\"hint\">No SEO-attributed data for this period.</p>';return}el.innerHTML='<table class=\"table\"><thead><tr><th>Landing page</th><th>Clicks</th><th>Registrations</th><th>Purchases</th><th>Earnings</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+String(r.landingPath||'/')+'</td><td>'+Number(r.clicks||0)+'</td><td>'+Number(r.registrations||0)+'</td><td>'+Number(r.purchases||0)+'</td><td>$'+Number(r.earnings||0).toFixed(2)+'</td></tr>').join('')+'</tbody></table>'}\n";
  s = s.replace(jsAnchor, helper + jsAnchor);

  const jsonAnchor = 'const j=await r.json();';
  if (!s.includes(jsonAnchor)) throw new Error('dashboard JSON anchor missing');
  s = s.replace(jsonAnchor, jsonAnchor + 'renderSeoAttribution(j.seoRevenue||[]);');
  return s + '\n<!-- NIGHTCAMFINDS_DASHBOARD_SEO_ATTRIBUTION_V2 -->\n';
}, { required: false });

require('./patch-seo-attribution-v3');
console.log('NightCamFinds SEO attribution v2 patch complete');
