'use strict';
/* SIMPLE_BUSINESS_DASHBOARD_V1 */
(function simpleBusinessDashboard(){
  const nav=document.getElementById('dashboardNav');
  const monthlyButton=nav?.querySelector('[data-dashboard-tab="monthly"]');
  if(!nav||!monthlyButton||window.__ncfSimpleBusinessDashboard)return;
  window.__ncfSimpleBusinessDashboard=true;

  const tier1=new Set(['US','GB','NO','CH','SE','DK','AU','CA','DE','NL','FR','IE','FI','AT','BE','NZ','IS','LU']);
  const countryNames={
    US:'United States',GB:'United Kingdom',NO:'Norway',CH:'Switzerland',SE:'Sweden',DK:'Denmark',
    AU:'Australia',CA:'Canada',DE:'Germany',NL:'Netherlands',FR:'France',IE:'Ireland',FI:'Finland',
    AT:'Austria',BE:'Belgium',NZ:'New Zealand',IS:'Iceland',LU:'Luxembourg',IT:'Italy',ES:'Spain',
    PL:'Poland',CZ:'Czechia',HU:'Hungary',RU:'Russia',KE:'Kenya',ZA:'South Africa',BR:'Brazil',
    MX:'Mexico',IN:'India',JP:'Japan',SG:'Singapore',UA:'Ukraine',RO:'Romania',PT:'Portugal'
  };
  const countryLabel=code=>{
    const value=String(code||'UNKNOWN').toUpperCase();
    return (countryNames[value]||value)+' ('+value+')';
  };

  monthlyButton.textContent='Business Dashboard';
  monthlyButton.setAttribute('aria-label','Business Dashboard');
  const monthlyPanel=document.querySelector('[data-nav-group="monthly"]');
  if(monthlyPanel){
    const heading=monthlyPanel.querySelector('h2');
    if(heading)heading.textContent='Business performance';
    const intro=monthlyPanel.querySelector('.note');
    if(intro)intro.textContent='Your business at a glance for the selected period. Redirects are not unique visitors. Chaturbate payouts are partner-reported and shown by currency. BongaCash figures are manual entries.';
    const countryHeading=[...monthlyPanel.querySelectorAll('h3')].find(h=>h.textContent.includes('Top countries by recorded redirects'));
    if(countryHeading)countryHeading.textContent='Countries bringing the most clicks';
    const conversionHeading=[...monthlyPanel.querySelectorAll('h3')].find(h=>h.textContent.includes('Chaturbate conversion countries'));
    if(conversionHeading)conversionHeading.textContent='Countries bringing member signups';
    const sourceHeading=[...monthlyPanel.querySelectorAll('h3')].find(h=>h.textContent.includes('Chaturbate signup and payout by recorded source'));
    if(sourceHeading)sourceHeading.textContent='Which marketing sources bring signups?';
  }

  // Keep the business view as the first and default tab. All existing detailed
  // click, traffic, revenue and health panels remain available under one tab.
  [...nav.querySelectorAll('[data-dashboard-tab]')].forEach(button=>{
    if(button!==monthlyButton)button.remove();
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
  advancedButton.addEventListener('click',()=>{clearDashboardApiCache();showAdvanced();});

  // Replace the monthly render hook with readable country names and decision-useful KPIs.
  const monthlyStatus=document.getElementById('monthlyOverviewStatus');
  if(monthlyStatus){
    const observer=new MutationObserver(()=>{
      const cards=document.getElementById('monthlyOverviewCards');
      if(cards&&cards.dataset.businessKpis!=='1'){
        const statsText=monthlyStatus.textContent||'';
        if(!statsText.startsWith('Updated '))return;
        cards.dataset.businessKpis='1';
        const existing=[...cards.querySelectorAll('.stat')];
        const values=existing.map(card=>card.querySelector('strong')?.textContent||'0');
        const events=window.__ncfLastMonthlyEvents||[];
        const matched=events.filter(x=>!x.isTest&&x.matchStatus==='matched');
        const signups=matched.filter(x=>['tokens_signup-referral','ppr_signup-referral','revshare_signup-referral'].includes(String(x.conversionType||'').toLowerCase()));
        const broadcaster=matched.filter(x=>['tokens_broadcaster-referral','ppr_broadcaster-referral','revshare_broadcaster-referral'].includes(String(x.conversionType||'').toLowerCase()));
        const tier1Signups=signups.filter(x=>tier1.has(String(x.country||'').toUpperCase())).reduce((sum,x)=>sum+Number(x.matchedConversions||0),0);
        const signupCount=signups.reduce((sum,x)=>sum+Number(x.matchedConversions||0),0);
        const broadcasterCount=broadcaster.reduce((sum,x)=>sum+Number(x.matchedConversions||0),0);
        const totalClicks=values[0]||'—';
        const tier1Clicks=values[3]||'—';
        const fmt=n=>Number(n||0).toLocaleString();
        cards.innerHTML=[
          ['Total affiliate clicks',totalClicks],
          ['Tier 1 country clicks',tier1Clicks],
          ['Tier 1 member signup events',fmt(tier1Signups)],
          ['All matched member signup events',fmt(signupCount)],
          ['Matched broadcaster referral events',fmt(broadcasterCount)]
        ].map(([label,value])=>'<div class="stat"><small>'+label+'</small><strong>'+value+'</strong></div>').join('');
      }
    });
    observer.observe(monthlyStatus,{childList:true,characterData:true,subtree:true});
  }

  const monthlyLoad=loadDashboardTab;
  loadDashboardTab=async function(tab,force=false){
    if(tab==='monthly'){
      const result=await monthlyLoad(tab,force);
      return result;
    }
    return monthlyLoad(tab,force);
  };

  // Wrap fetch only for the existing monthly conversion request so its response
  // can feed the extra summary metrics without making another API request.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    return nativeFetch(input,init).then(response=>{
      try{
        const url=typeof input==='string'?input:input.url;
        if(url&&url.includes('/api/conversion-revenue')){
          response.clone().json().then(data=>{window.__ncfLastMonthlyEvents=Array.isArray(data.rows)?data.rows:[];}).catch(()=>{});
        }
      }catch(_){}
      return response;
    });
  };

  // Convert ISO codes to names in the business summary tables after each refresh.
  const panel=document.querySelector('[data-nav-group="monthly"]');
  if(panel){
    const tableObserver=new MutationObserver(()=>{
      const clicks=panel.querySelector('#monthlyCountryTable');
      if(clicks){
        const table=clicks.querySelector('tbody');
        if(table)[...table.rows].forEach(row=>{
          const cell=row.cells[0];if(!cell||cell.dataset.named==='1')return;
          const code=cell.textContent.trim().toUpperCase();
          cell.textContent=countryLabel(code);cell.dataset.named='1';
        });
      }
      const conversions=panel.querySelector('#monthlyConversionCountryTable tbody');
      if(conversions)[...conversions.rows].forEach(row=>{
        const cell=row.cells[0];if(!cell||cell.dataset.named==='1')return;
        const code=cell.textContent.trim().toUpperCase();
        cell.textContent=countryLabel(code);cell.dataset.named='1';
      });
    });
    tableObserver.observe(panel,{childList:true,subtree:true});
  }
  monthlyButton.addEventListener('click',()=>setDashboardTab('monthly'));
  // Reassert the clean default after the original dashboard initialization.
  setDashboardTab('monthly');
})();