'use strict';
/* SIMPLE_BUSINESS_DASHBOARD_V1 */
(function simpleBusinessDashboard(){
  const nav=document.getElementById('dashboardNav');
  const businessButton=nav?.querySelector('[data-dashboard-tab="monthly"]');
  if(!nav||!businessButton||window.__ncfSimpleBusinessDashboard)return;
  window.__ncfSimpleBusinessDashboard=true;

  businessButton.textContent='Business Dashboard';
  if(typeof dashboardTabDescriptions!=='undefined')dashboardTabDescriptions.monthly='Business Dashboard: clicks, Tier 1 signup events, countries, marketing sources and earnings.';
  businessButton.setAttribute('aria-label','Business Dashboard');
  const businessPanel=document.querySelector('[data-nav-group="monthly"]');
  if(businessPanel){
    const heading=businessPanel.querySelector('h2');
    if(heading)heading.textContent='Business performance';
    const intro=businessPanel.querySelector('.note');
    if(intro)intro.textContent='Your business at a glance for the selected period. Redirects are not unique visitors. Signup counts are matched postback events, not unique people. Chaturbate payouts are partner-reported and shown by currency. BongaCash figures are manual entries.';
  }

  // Keep one simple business view and one consolidated home for detailed reports.
  [...nav.querySelectorAll('[data-dashboard-tab]')].forEach(button=>{
    if(button!==businessButton)button.remove();
  });
  const advancedButton=document.createElement('button');
  advancedButton.className='button';
  advancedButton.type='button';
  advancedButton.setAttribute('role','tab');
  advancedButton.setAttribute('aria-selected','false');
  advancedButton.dataset.dashboardTab='advanced';
  advancedButton.textContent='Advanced Reports';
  nav.appendChild(advancedButton);

  const originalSetDashboardTab=setDashboardTab;
  function showAdvanced(){
    activeDashboardTab='advanced';
    document.querySelectorAll('#dashboard [data-nav-group]').forEach(panel=>{
      const hidden=panel.dataset.navGroup==='monthly';
      panel.classList.toggle('nav-hidden',hidden);
      panel.setAttribute('aria-hidden',String(hidden));
    });
    document.querySelectorAll('[data-dashboard-tab]').forEach(button=>{
      const selected=button.dataset.dashboardTab==='advanced';
      button.setAttribute('aria-selected',String(selected));
      button.classList.toggle('primary',selected);
    });
    const hint=document.getElementById('dashboardNavHint');
    if(hint)hint.textContent='Advanced Reports: detailed traffic, country, campaign, conversion and tracking diagnostics.';
    Promise.allSettled([loadDashboardTab('clicks',true),loadDashboardTab('advanced',true)]);
  }
  setDashboardTab=function(tab){
    if(tab==='advanced'){showAdvanced();return;}
    return originalSetDashboardTab(tab);
  };
  advancedButton.addEventListener('click',()=>{
    if(typeof clearDashboardApiCache==='function')clearDashboardApiCache();
    showAdvanced();
  });

  // The current-month business view remains the default landing tab after login.
  setDashboardTab('monthly');
})();