const fs = require('fs');
const path = 'public/dashboard.html';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_DASHBOARD_SEO_ATTRIBUTION_V1';
if (s.includes(marker)) process.exit(0);

const panel = `<section class="panel" id="seoAttributionPanel"><h2>SEO page revenue attribution</h2><p class="note">Shows which NightCamFinds landing pages generated tracked affiliate clicks and confirmed Chaturbate RevShare conversions.</p><div id="seoAttribution"></div></section>\n<!-- ${marker} -->\n`;
const anchor = '<section class="panel"><h2>Tracking health</h2>';
if (!s.includes(anchor)) throw new Error('Dashboard tracking health anchor not found');
s = s.replace(anchor, panel + anchor);

const scriptAnchor = "function setHealth(id,active,detail){";
const helper = `function renderSeoAttribution(rows){const el=$('seoAttribution');if(!el)return;if(!Array.isArray(rows)||!rows.length){el.innerHTML='<p class="hint">No SEO-attributed clicks or conversions for this period yet.</p>';return}el.innerHTML='<table class="table"><thead><tr><th>Landing page</th><th>Clicks</th><th>Registrations</th><th>Purchases</th><th>Earnings</th><th>Earnings / Click</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.landingPath||'/')+'</td><td>'+n(r.clicks)+'</td><td>'+n(r.registrations)+'</td><td>'+n(r.purchases)+'</td><td>'+money(r.earnings)+'</td><td>'+money(r.clicks?Number(r.earnings||0)/Number(r.clicks):0)+'</td></tr>').join('')+'</tbody></table>'}\n`;
if (!s.includes(scriptAnchor)) throw new Error('Dashboard JS helper anchor not found');
s = s.replace(scriptAnchor, helper + scriptAnchor);

const loadAnchor = "$('status').textContent='Loading...';try{";
if (!s.includes(loadAnchor)) throw new Error('Dashboard load anchor not found');
s = s.replace(loadAnchor, loadAnchor);

const renderAnchor = "$('status').textContent='Loaded '+new Date().toLocaleTimeString();";
if (!s.includes(renderAnchor)) throw new Error('Dashboard final render anchor not found');
s = s.replace(renderAnchor, "renderSeoAttribution(j.seoRevenue||[]);" + renderAnchor);

fs.writeFileSync(path, s);
console.log('NightCamFinds dashboard SEO attribution patch applied');
