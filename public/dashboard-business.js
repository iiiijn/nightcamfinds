'use strict';
/* RESTORE_FIVE_SECTION_DASHBOARD_V1 */
(function restoreFiveSectionDashboard(){
  const nav=document.getElementById('dashboardNav');
  if(!nav||window.__ncfFiveSectionDashboard)return;
  window.__ncfFiveSectionDashboard=true;

  const tabs=[
    ['overview','Overview'],
    ['traffic','Traffic Intelligence'],
    ['investigation','Click Investigation'],
    ['revenue','Revenue & Conversions'],
    ['health','Tracking & System Health']
  ];
  nav.querySelectorAll('[data-dashboard-tab]').forEach(button=>button.remove());
  for(const [key,label] of tabs){
    const button=document.createElement('button');
    button.className='button';button.type='button';button.setAttribute('role','tab');
    button.setAttribute('aria-selected','false');button.dataset.dashboardTab=key;
    button.textContent=label;nav.appendChild(button);
    button.addEventListener('click',()=>{clearDashboardApiCache();setDashboardTab(key)});
  }
  const telegramLink=document.createElement('a');
  telegramLink.className='button';telegramLink.href='/telegram-campaigns.html';
  telegramLink.textContent='Telegram Campaigns';telegramLink.setAttribute('aria-label','Open Telegram campaign attribution report');
  nav.appendChild(telegramLink);

  const descriptions={
    overview:'Overview: monthly business performance, room coverage, country preferences and category performance.',
    traffic:'Traffic Intelligence: traffic quality, recorded sources, countries, devices and placements.',
    investigation:'Click Investigation: inspect recent room-level redirects and their recorded attribution details.',
    revenue:'Revenue & Conversions: compare campaigns, matched events, provider payouts and manual reconciliation.',
    health:'Tracking & System Health: inspect provider attribution diagnostics and tracking status.'
  };
  const groups={
    'Click summary':'overview','Additional overview metrics':'overview',
    'Live room coverage':'overview','Country platform preferences':'overview',
    'Best room categories by country':'overview','Platform performance':'overview',
    'Weekly traffic quality':'traffic','Traffic quality since 10 November':'traffic',
    'Repeated-click intelligence':'traffic',
    'Click origins report':'traffic','Daily clicks by country':'traffic',
    'Country × platform attribution':'traffic','Promo placement performance':'traffic',
    'Recent room clicks':'investigation','Individual click trace':'investigation',
    'Campaign performance':'revenue','Traffic-to-revenue performance':'revenue',
    'Conversion & revenue performance':'revenue','Conversion funnel overview':'revenue',
    'Chaturbate conversion events':'revenue','BongaCash daily reconciliation':'revenue',
    'Provider attribution health':'health','Traffic channel signals':'health'
  };
  document.querySelectorAll('#dashboard .panel').forEach(panel=>{
    const heading=panel.querySelector('h2');
    if(!heading)return;
    const group=groups[heading.textContent.trim()];
    if(group)panel.dataset.navGroup=group;
  });
  // Keep the newer monthly business report, but place it inside Overview.
  const monthlyPanel=document.querySelector('#dashboard [data-nav-group="monthly"]');
  if(monthlyPanel)monthlyPanel.dataset.navGroup='overview';
  if(typeof dashboardTabDescriptions!=='undefined'){
    Object.assign(dashboardTabDescriptions,descriptions);
    delete dashboardTabDescriptions.monthly;
    delete dashboardTabDescriptions.clicks;
    delete dashboardTabDescriptions.advanced;
  }

  const nativeMonthlyLoader=loadDashboardTab;
  const loaders={
    overview:[loadRoomCoverage,load,loadRouteSettings,loadCountryCategoryAnalytics],
    traffic:[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadTrafficSinceCutoff,loadOwnerTrafficMode,loadClickOrigins,loadRepeatedClickIntelligence],
    investigation:[loadRecentRoomClicks,loadIndividualClickTrace],
    revenue:[loadCampaignPerformance,loadTrafficRevenuePerformance,loadConversionRevenue,loadConversionFunnel],
    health:[loadProviderAttributionHealth]
  };
  const loaded=new Set(),pending=new Map();
  loadDashboardTab=async function(tab,force=false){
    const key=tab+'|'+dashboardPeriodKey();
    if(!force&&loaded.has(key))return;
    if(pending.has(key))return pending.get(key);
    const jobs=(loaders[tab]||[]).map(loader=>()=>loader());
    if(tab==='overview'&&monthlyPanel)jobs.push(()=>nativeMonthlyLoader('monthly',force));
    const task=Promise.allSettled(jobs.map(run=>run())).then(results=>{
      loaded.add(key);
      const failed=results.find(x=>x.status==='rejected');
      if(failed)throw failed.reason;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);return task;
  };
  setDashboardTab=function(tab){
    if(!descriptions[tab])return;
    activeDashboardTab=tab;
    document.querySelectorAll('#dashboard [data-nav-group]').forEach(panel=>{
      const hidden=panel.dataset.navGroup!==tab;
      panel.classList.toggle('nav-hidden',hidden);
      panel.setAttribute('aria-hidden',String(hidden));
    });
    nav.querySelectorAll('[data-dashboard-tab]').forEach(button=>{
      const selected=button.dataset.dashboardTab===tab;
      button.setAttribute('aria-selected',String(selected));
      button.classList.toggle('primary',selected);
    });
    const hint=document.getElementById('dashboardNavHint');
    if(hint)hint.textContent=descriptions[tab];
    if(!$('dashboard').classList.contains('hidden'))loadDashboardTab(tab);
  };
  $('apply').addEventListener('click',()=>{loaded.clear();loadDashboardTab(activeDashboardTab,true)});
  $('range').addEventListener('change',()=>{loaded.clear();loadDashboardTab(activeDashboardTab,true)});
  setDashboardTab('overview');
})();