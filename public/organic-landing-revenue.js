'use strict';
(function organicLandingRevenueDashboard() {
  const nav = document.getElementById('dashboardNav');
  const dashboard = document.getElementById('dashboard');
  if (!nav || !dashboard || document.querySelector('[data-dashboard-tab="organic"]')) return;

  const button = document.createElement('button');
  button.className = 'button';
  button.type = 'button';
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', 'false');
  button.dataset.dashboardTab = 'organic';
  button.textContent = 'Landing Pages & Categories';
  nav.append(button);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.dataset.navGroup = 'organic';
  panel.innerHTML = '<h2>Landing-page and category performance</h2>' +
    '<p class="note">Shows which original landing pages generate recorded affiliate activity and matched Chaturbate postbacks. Clicks are redirects, not verified human visitors. Payouts are partner-reported and shown separately by currency. BongaCash remains manual and is not automatically attributed.</p>' +
    '<div class="controls"><button id="organicLandingRefresh" class="button primary" type="button">Refresh report</button><span id="organicLandingStatus" class="hint">Choose this tab to load the report.</span></div>' +
    '<div class="cards" id="organicLandingSummary"></div>' +
    '<div id="organicLandingTable"><p class="hint">No report loaded yet.</p></div>' +
    '<p class="note">Date basis: affiliate click date, visit first-seen date and Chaturbate callback received date, using Africa/Nairobi calendar days. Category comes from affiliate clicks and matched conversions; visit records do not store category, so visit totals appear under unknown category. Older records without landing-path or visit linkage cannot be reconstructed. Known bots, suspected bots, unverified-not-flagged and unclassified clicks are displayed separately.</p>';
  nav.insertAdjacentElement('afterend', panel);

  const responsiveStyle = document.createElement('style');
  responsiveStyle.textContent = [
    '[data-nav-group="organic"] .organic-campaign-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0 20px}',
    '[data-nav-group="organic"] .organic-campaign-card{background:#100e14;border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0}',
    '[data-nav-group="organic"] .organic-campaign-card h3{font-size:14px;margin:0 0 8px;overflow-wrap:anywhere}',
    '[data-nav-group="organic"] .organic-campaign-card strong{font-size:23px;display:block;margin:4px 0}',
    '[data-nav-group="organic"] .organic-table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;border:1px solid var(--line);border-radius:10px}',
    '[data-nav-group="organic"] .organic-table-scroll .table{min-width:1180px;margin:0}',
    '[data-nav-group="organic"] .organic-table-scroll th:first-child,[data-nav-group="organic"] .organic-table-scroll td:first-child{position:sticky;left:0;background:var(--panel);z-index:1}',
    '[data-nav-group="organic"] .organic-scroll-hint{margin:8px 0;color:var(--muted);font-size:12px}',
    '@media(max-width:760px){[data-nav-group="organic"] .organic-campaign-grid{grid-template-columns:1fr}[data-nav-group="organic"] .organic-table-scroll .table{min-width:1180px}}'
  ].join('');
  panel.append(responsiveStyle);

  const previousSetDashboardTab = setDashboardTab;
  const previousLoadDashboardTab = loadDashboardTab;
  dashboardTabDescriptions.organic = 'Landing Pages & Categories: compare landing paths, recorded click categories, visits, affiliate redirects and matched Chaturbate payouts.';
  let loadedKey = '';

  function reportDates() {
    const dates = selected();
    const query = new URLSearchParams();
    if (dates.from) query.set('from', dates.from);
    if (dates.to) query.set('to', dates.to);
    return query.toString();
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function renderRows(rows) {
    const totals = { clicks: 0, visits: 0, engaged: 0, conversions: 0 };
    const payouts = {};
    for (const row of rows) {
      totals.clicks += Number(row.clicks || 0);
      totals.visits += Number(row.visits || 0);
      totals.engaged += Number(row.engagedVisits || 0);
      totals.conversions += Number(row.matchedConversions || 0);
      for (const [currency, amount] of Object.entries(row.reportedPayoutsByCurrency || {})) {
        payouts[currency] = (payouts[currency] || 0) + Number(amount || 0);
      }
    }
    document.getElementById('organicLandingSummary').innerHTML = [
      ['Tracked visits', totals.visits],
      ['Engaged unverified visits', totals.engaged],
      ['Affiliate redirects', totals.clicks],
      ['Matched Chaturbate conversions', totals.conversions]
    ].map(([label, value]) => '<div class="stat"><small>' + esc(label) + '</small><strong>' + formatNumber(value) + '</strong></div>').join('');

    const campaignGroups = new Map();
    for (const row of rows) {
      const source = String(row.source || 'unknown').toLowerCase();
      const campaign = String(row.campaign || 'unknown').toLowerCase();
      const key = source + '/' + campaign;
      if (!campaignGroups.has(key)) campaignGroups.set(key, {
        source, campaign, clicks: 0, visits: 0, conversions: 0,
        countries: new Set(), platforms: new Set()
      });
      const group = campaignGroups.get(key);
      group.clicks += Number(row.clicks || 0);
      group.visits += Number(row.visits || 0);
      group.conversions += Number(row.matchedConversions || 0);
      if (row.country && row.country !== 'UNKNOWN') group.countries.add(String(row.country));
      if (row.platform && row.platform !== 'unknown') group.platforms.add(String(row.platform));
    }
    const xCampaigns = ['x_female_models', 'x_male_models'];
    const xCards = xCampaigns.map(name => {
      const group = campaignGroups.get('x/' + name);
      return '<article class="organic-campaign-card"><h3>' + esc(name === 'x_female_models' ? 'Female X account' : 'Male X account') + '</h3>' +
        '<strong>' + formatNumber(group ? group.clicks : 0) + '</strong><span class="hint">Affiliate redirects</span>' +
        '<p class="note">Visits: ' + formatNumber(group ? group.visits : 0) +
        ' · Conversions: ' + formatNumber(group ? group.conversions : 0) +
        '<br>Countries: ' + esc(group ? [...group.countries].sort().join(', ') || 'Not recorded' : 'No campaign rows') +
        '<br>Platforms: ' + esc(group ? [...group.platforms].sort().join(', ') || 'Not recorded' : 'No campaign rows') + '</p></article>';
    }).join('');
    const otherCampaigns = [...campaignGroups.values()]
      .filter(group => group.source !== 'x' || !xCampaigns.includes(group.campaign))
      .sort((a,b) => b.clicks - a.clicks)
      .slice(0, 8)
      .map(group => '<article class="organic-campaign-card"><h3>' + esc(group.source + ' / ' + group.campaign) + '</h3><strong>' +
        formatNumber(group.clicks) + '</strong><span class="hint">Affiliate redirects</span><p class="note">Visits: ' +
        formatNumber(group.visits) + ' · Conversions: ' + formatNumber(group.conversions) + '</p></article>').join('');
    const campaignPanel = '<h3> X campaign performance</h3><p class="note">These totals are grouped by the recorded source and campaign tags. Redirects are not confirmed signups or revenue.</p><div class="organic-campaign-grid">' +
      xCards + otherCampaigns + '</div>';
    const payoutText = Object.entries(payouts).sort((a,b) => a[0].localeCompare(b[0]))
      .map(([currency, amount]) => esc(currency) + ' ' + amount.toFixed(2)).join(' · ') || 'No matched payouts';
    const sorted = [...rows].sort((a,b) => Number(b.matchedConversions || 0) - Number(a.matchedConversions || 0) || Number(b.clicks || 0) - Number(a.clicks || 0));
    document.getElementById('organicLandingTable').innerHTML = sorted.length
      ? campaignPanel + '<p class="note">Matched payouts across the selected report window: ' + payoutText + '</p><p class="organic-scroll-hint">The detailed table scrolls horizontally. On a phone, swipe left or right inside the table to see every column.</p><div class="organic-table-scroll" role="region" aria-label="Detailed landing-page and category report" tabindex="0"><table class="table"><thead><tr><th>Landing page</th><th>Category</th><th>Country</th><th>Platform</th><th>Source / campaign</th><th>Visits</th><th>Engaged</th><th>Redirects</th><th>Known bots</th><th>Suspected</th><th>Unverified</th><th>Unclassified</th><th>Matched conversions</th><th>Reported payout</th></tr></thead><tbody>' +
        sorted.map(row => {
          const amounts = Object.entries(row.reportedPayoutsByCurrency || {}).sort((a,b) => a[0].localeCompare(b[0])).map(([currency, amount]) => esc(currency) + ' ' + Number(amount || 0).toFixed(2)).join('<br>') || '—';
          return '<tr><td>' + esc(row.landingPath || 'unknown') + '</td><td>' + esc(row.category || 'unknown') + '</td><td>' + esc(row.country || 'UNKNOWN') + '</td><td>' + esc(row.platform || 'unknown') + '</td><td>' + esc((row.source || 'unknown') + ' / ' + (row.campaign || 'unknown')) + '</td><td>' + formatNumber(row.visits) + '</td><td>' + formatNumber(row.engagedVisits) + '</td><td>' + formatNumber(row.clicks) + '</td><td>' + formatNumber(row.knownBotClicks) + '</td><td>' + formatNumber(row.suspectedBotClicks) + '</td><td>' + formatNumber(row.unverifiedNotFlaggedClicks) + '</td><td>' + formatNumber(row.unclassifiedClicks) + '</td><td>' + formatNumber(row.matchedConversions) + '</td><td>' + amounts + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="hint">No landing-page activity found for this date range. This can also mean older records do not have usable landing-path attribution.</p>';
  }

  async function loadOrganicLandingRevenue(force = false) {
    const key = reportDates();
    if (!force && loadedKey === key) return;
    const status = document.getElementById('organicLandingStatus');
    status.textContent = 'Loading landing-page and category performance…';
    try {
      const response = await fetch('/api/organic-landing-revenue' + (key ? '?' + key : ''), { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) {
        showLogin('Your session expired. Sign in again.');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Organic landing-page report could not be loaded.');
      renderRows(data.rows || []);
      loadedKey = key;
      status.textContent = 'Updated ' + new Date().toLocaleTimeString() + ' · ' + (data.rows || []).length + ' report rows · Africa/Nairobi';
      if (data.truncated) status.textContent += ' · Results limited to 2,000 rows';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  setDashboardTab = function(tab) {
    if (tab === 'organic') {
      activeDashboardTab = 'organic';
      document.querySelectorAll('[data-nav-group]').forEach(item => {
        const hidden = item.dataset.navGroup !== 'organic';
        item.classList.toggle('nav-hidden', hidden);
        item.setAttribute('aria-hidden', String(hidden));
      });
      document.querySelectorAll('[data-dashboard-tab]').forEach(item => {
        const active = item.dataset.dashboardTab === 'organic';
        item.setAttribute('aria-selected', String(active));
        item.classList.toggle('primary', active);
      });
      document.getElementById('dashboardNavHint').textContent = dashboardTabDescriptions.organic;
      if (!dashboard.classList.contains('hidden')) loadOrganicLandingRevenue();
      return;
    }
    return previousSetDashboardTab(tab);
  };

  loadDashboardTab = async function(tab, force = false) {
    if (tab === 'organic') return loadOrganicLandingRevenue(force);
    return previousLoadDashboardTab(tab, force);
  };

  button.addEventListener('click', () => {
    if (typeof clearDashboardApiCache === 'function') clearDashboardApiCache();
    loadedKey = '';
    setDashboardTab('organic');
  });
  document.getElementById('organicLandingRefresh').addEventListener('click', () => {
    loadedKey = '';
    loadOrganicLandingRevenue(true);
  });
  const range = document.getElementById('range');
  const apply = document.getElementById('apply');
  range.addEventListener('change', () => {
    if (activeDashboardTab === 'organic') {
      loadedKey = '';
      loadOrganicLandingRevenue(true);
    }
  });
  apply.addEventListener('click', () => {
    if (activeDashboardTab === 'organic') {
      loadedKey = '';
      loadOrganicLandingRevenue(true);
    }
  });
})();