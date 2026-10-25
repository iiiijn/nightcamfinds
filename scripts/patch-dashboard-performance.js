const fs = require("fs");

const path = "public/dashboard.html";
const marker = "NIGHTCAMFINDS_DASHBOARD_PERFORMANCE_V1";
let s = fs.readFileSync(path, "utf8");
if (s.includes(marker)) process.exit(0);

const panel = `
<section class="panel" id="performance-panel">
  <h2>Traffic quality & campaign performance</h2>
  <p class="note">Use this section to decide where to send your next traffic dollar. Tier performance uses the country classification from the tracking runtime. Campaign and medium totals are click counts.</p>
  <div class="grid">
    <div><h3>Tier performance</h3><div id="tierPerformance"><p class="hint">Loading...</p></div></div>
    <div><h3>Campaigns</h3><div id="campaignPerformance"><p class="hint">Loading...</p></div></div>
  </div>
  <div style="margin-top:18px"><h3>Mediums</h3><div id="mediumPerformance"><p class="hint">Loading...</p></div></div>
</section>`;

const anchor = '<section class="panel"><h2>Tracking health</h2>';
if (!s.includes(anchor)) throw new Error("dashboard tracking health anchor not found");
s = s.replace(anchor, panel + "\n" + anchor);

const script = `<script>
// ${marker}
(function(){
  const esc = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]||c));
  const num = v => Number(v||0).toLocaleString();
  const money = v => '$' + Number(v||0).toFixed(2);
  const table = (rows, headers, formatter) => {
    if (!rows.length) return '<p class="hint">No data for this period.</p>';
    return '<table class="table"><thead><tr>' + headers.map(h=>'<th>'+esc(h)+'</th>').join('') + '</tr></thead><tbody>' + rows.map(r=>'<tr>' + r.map((v,i)=>'<td>'+esc(formatter ? formatter(v,i) : v)+'</td>').join('') + '</tr>').join('') + '</tbody></table>';
  };
  function range(){
    const r=document.getElementById('range');
    const from=document.getElementById('from');
    const to=document.getElementById('to');
    if(from && to && (from.value || to.value)) return {from:from.value,to:to.value};
    const today=new Date(); const iso=d=>d.toISOString().slice(0,10);
    if(!r || r.value==='all') return {from:'',to:''};
    if(r.value==='today') return {from:iso(today),to:iso(today)};
    const d=new Date(today); d.setDate(d.getDate()-(Number(r.value)-1));
    return {from:iso(d),to:iso(today)};
  }
  async function renderPerformance(){
    const panel=document.getElementById('performance-panel');
    const dashboard=document.getElementById('dashboard');
    if(!panel || !dashboard || dashboard.classList.contains('hidden')) return;
    try{
      const r=range(); const q=new URLSearchParams(); if(r.from)q.set('from',r.from); if(r.to)q.set('to',r.to);
      const res=await fetch('/api/dashboard-stats?'+q.toString(),{credentials:'same-origin',cache:'no-store'});
      if(res.status===401)return;
      const j=await res.json();
      const tiers=['Tier 1','Tier 2','Tier 3','Unclassified'];
      const tierRows=tiers.map(t=>{
        const c=Number((j.tierClicks||{})[t]||0); const x=(j.conversionTiers||{})[t]||{};
        const conversions=Number(x.registrations||0)+Number(x.purchases||0);
        return [t,c,Number(x.registrations||0),Number(x.purchases||0),money(x.earnings),c?((conversions/c)*100).toFixed(1)+'%':'0%'];
      }).filter(r=>r[1]||r[2]||r[3]||Number(r[4].replace('$','')));
      document.getElementById('tierPerformance').innerHTML=table(tierRows,['Tier','Clicks','Regs','Purchases','Earnings','Conv. rate']);
      const campaigns=Object.entries(j.campaigns||{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,20).map(([k,v])=>[k,Number(v)]);
      document.getElementById('campaignPerformance').innerHTML=table(campaigns,['Campaign','Clicks'],(v)=>typeof v==='number'?num(v):v);
      const mediums=Object.entries(j.mediums||{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,20).map(([k,v])=>[k,Number(v)]);
      document.getElementById('mediumPerformance').innerHTML=table(mediums,['Medium','Clicks'],(v)=>typeof v==='number'?num(v):v);
    }catch(e){
      console.error('Performance panel failed',e);
    }
  }
  document.getElementById('apply')?.addEventListener('click',()=>setTimeout(renderPerformance,100));
  document.getElementById('range')?.addEventListener('change',()=>setTimeout(renderPerformance,100));
  const dash=document.getElementById('dashboard');
  if(dash) new MutationObserver(()=>{if(!dash.classList.contains('hidden'))renderPerformance();}).observe(dash,{attributes:true,attributeFilter:['class']});
  setTimeout(renderPerformance,700);
})();
</script>`;

const scriptAnchor = '</script>\n</body>';
if (!s.includes(scriptAnchor)) throw new Error("dashboard script closing anchor not found");
s = s.replace(scriptAnchor, script + "\n" + scriptAnchor);

fs.writeFileSync(path, s);
console.log("NightCamFinds dashboard performance patch applied");
