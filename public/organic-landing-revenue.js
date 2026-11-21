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
  button.textContent = 'Organic Landing Pages';
  nav.append(button);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.dataset.navGroup = 'organic';
  panel.innerHTML = '<h2>Organic landing-page revenue</h2>' +
    '<p class="note">Shows which original landing pages generate recorded affiliate activity and matched Chaturbate postbacks. Clicks are redirects, not verified human visitors. Payouts are partner-reported and shown separately by currency. BongaCash remains manual and is not automatically attributed.</p>' +
    '<div class="controls"><button id="organicLandingRefresh" class="button primary" type="button">Refresh report</button><span id="organicLandingStatus" class="hint">Choose this tab to load the report.</span></div>' +
    '<div class="cards" id="organicLandingSummary"></div>' +
    '<div id="organicLandingTable"><p class="hint">No report loaded yet.</p></div>' +
    '<p class="note">Date basis: affiliate click date, visit first-seen date and Chaturbate callback received date, all in UTC. Older records without landing-path or visit linkage cannot be reconstructed. Known bots, suspected bots, unverified-not-flagged and unclassified clicks are displayed separately.</p>';
  nav.insertAdjacentElement('afterend', panel);

  const previousSetDashboardTab = setDashboardTab;
  const previousLoadDashboardTab = loadDashboardTab;
  dashboardTabDescriptions.organic = 'Organic Landing Pages: compare landing pages by tracked visits, affiliate redirects and matched Chaturbate payouts.';
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

    const payoutText = Object.entries(payouts).sort((a,b) => a[0].localeCompare(b[0]))
      .map(([currency, amount]) => esc(currency) + ' ' + amount.toFixed(2)).join(' · ') || 'No matched payouts';
    const sorted = [...rows].sort((a,b) => Number(b.matchedConversions || 0) - Number(a.matchedConversions || 0) || Number(b.clicks || 0) - Number(a.clicks || 0));
    document.getElementById('organicLandingTable').innerHTML = sorted.length
      ? '<p class="note">Matched payouts across the selected report window: ' + payoutText + '</p><table class="table"><thead><tr><th>Landing page</th><th>Country</th><th>Platform</th><th>Source / campaign</th><th>Visits</th><th>Engaged</th><th>Redirects</th><th>Known bots</th><th>Suspected</th><th>Unverified</th><th>Unclassified</th><th>Matched conversions</th><th>Reported payout</th></tr></thead><tbody>' +
        sorted.map(row => {
          const amounts = Object.entries(row.reportedPayoutsByCurrency || {}).sort((a,b) => a[0].localeCompare(b[0])).map(([currency, amount]) => esc(currency) + ' ' + Number(amount || 0).toFixed(2)).join('<br>') || '—';
          return '<tr><td>' + esc(row.landingPath || 'unknown') + '</td><td>' + esc(row.country || 'UNKNOWN') + '</td><td>' + esc(row.platform || 'unknown') + '</td><td>' + esc((row.source || 'unknown') + ' / ' + (row.campaign || 'unknown')) + '</td><td>' + formatNumber(row.visits) + '</td><td>' + formatNumber(row.engagedVisits) + '</td><td>' + formatNumber(row.clicks) + '</td><td>' + formatNumber(row.knownBotClicks) + '</td><td>' + formatNumber(row.suspectedBotClicks) + '</td><td>' + formatNumber(row.unverifiedNotFlaggedClicks) + '</td><td>' + formatNumber(row.unclassifiedClicks) + '</td><td>' + formatNumber(row.matchedConversions) + '</td><td>' + amounts + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="hint">No landing-page activity found for this date range. This can also mean older records do not have usable landing-path attribution.</p>';
  }

  async function loadOrganicLandingRevenue(force = false) {
    const key = reportDates();
    if (!force && loadedKey === key) return;
    const status = document.getElementById('organicLandingStatus');
    status.textContent = 'Loading organic landing-page performance…';
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
      status.textContent = 'Updated ' + new Date().toLocaleTimeString() + ' · ' + (data.rows || []).length + ' report rows · UTC';
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