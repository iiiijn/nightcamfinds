(() => {
  "use strict";
  const KEYS = { favorites: "ncf_favorites_v1", recent: "ncf_recent_v1" };
  const MAX_FAVORITES = 24, MAX_RECENT = 8;
  const read = key => { try { const v=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(v)?v:[]; } catch (_) { return []; } };
  const write = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch (_) { return false; } };
  const safeText = (v,max=120) => String(v||"").replace(/[<>]/g,"").trim().slice(0,max);
  const roomFromCard = card => {
    const m=card.getAttribute("href")?.match(/^\/(go|bgo)\/([^?]+)/);
    if(!m) return null;
    const name=safeText(card.querySelector(".meta strong")?.textContent,80);
    if(!name) return null;
    const image=card.querySelector("img.thumb")?.getAttribute("src")||"";
    return {id:decodeURIComponent(m[2]),platform:m[1]==="bgo"?"bongacams":"chaturbate",name,subject:safeText(card.querySelector(".subject")?.textContent,140),image:/^(https:\/\/|\/)/i.test(image)?image:""};
  };
  const roomUrl=(room,source)=>(room.platform==="bongacams"?"/bgo/":"/go/")+encodeURIComponent(room.id)+"?src="+encodeURIComponent(source)+"&cat=all";
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const favoritesGrid=document.querySelector("#favorite-rooms"),recentGrid=document.querySelector("#recent-rooms");
  if(!favoritesGrid||!recentGrid)return;
  function renderCollection(target,rooms,source){
    target.replaceChildren();
    for(const room of rooms){
      const item=el("article","loyalty-item"),link=el("a","loyalty-link");
      link.href=roomUrl(room,source);link.rel="sponsored nofollow noopener";
      if(room.image){const img=el("img","loyalty-thumb");img.src=room.image;img.alt="";img.loading="lazy";img.onerror=()=>img.remove();link.append(img);}
      const details=el("span","loyalty-details");details.append(el("strong","",room.name),el("small","",room.subject||(room.platform==="bongacams"?"BongaCams":"Chaturbate")));link.append(details);
      const remove=el("button","loyalty-remove",source==="favorites"?"Remove":"Clear");remove.type="button";
      remove.setAttribute("aria-label",(source==="favorites"?"Remove ":"Clear ")+room.name);
      remove.addEventListener("click",()=>{const key=source==="favorites"?KEYS.favorites:KEYS.recent;write(key,read(key).filter(x=>x.id!==room.id||x.platform!==room.platform));render();});
      item.append(link,remove);target.append(item);
    }
    if(!rooms.length)target.append(el("p","loyalty-empty",source==="favorites"?"Save rooms you want to find again.":"Rooms you open will appear here on this device."));
  }
  function render(){
    const favorites=read(KEYS.favorites),recent=read(KEYS.recent);
    renderCollection(favoritesGrid,favorites,"favorites");renderCollection(recentGrid,recent,"recent");
    const fc=document.querySelector("#favorites-count"),rc=document.querySelector("#recent-count");
    if(fc)fc.textContent=String(favorites.length);if(rc)rc.textContent=String(recent.length);
  }
  function enhance(card){
    if(card.dataset.loyaltyReady==="1")return;
    const room=roomFromCard(card);if(!room)return;
    card.dataset.loyaltyReady="1";
    const wrapper=el("div","loyalty-card-wrap");card.parentNode.insertBefore(wrapper,card);wrapper.append(card);
    const button=el("button","favorite-toggle","☆ Save");button.type="button";button.setAttribute("aria-pressed","false");
    button.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      const favorites=read(KEYS.favorites),exists=favorites.some(x=>x.id===room.id&&x.platform===room.platform);
      const next=exists?favorites.filter(x=>x.id!==room.id||x.platform!==room.platform):[room,...favorites].slice(0,MAX_FAVORITES);
      if(!write(KEYS.favorites,next)){button.textContent="Storage unavailable";return;}
      render();
    });
    wrapper.append(button);
    const saved=read(KEYS.favorites).some(x=>x.id===room.id&&x.platform===room.platform);
    button.textContent=saved?"★ Saved":"☆ Save";button.setAttribute("aria-pressed",String(saved));
  }
  document.addEventListener("click",event=>{
    const card=event.target.closest?.("a.card");if(!card||event.target.closest(".favorite-toggle"))return;
    const room=roomFromCard(card);if(!room)return;
    write(KEYS.recent,[room,...read(KEYS.recent).filter(x=>x.id!==room.id||x.platform!==room.platform)].slice(0,MAX_RECENT));
  },true);
  const observer=new MutationObserver(()=>document.querySelectorAll("a.card").forEach(enhance));
  observer.observe(document.body,{childList:true,subtree:true});document.querySelectorAll("a.card").forEach(enhance);
  document.querySelector("#clear-recent")?.addEventListener("click",()=>{write(KEYS.recent,[]);render();});
  document.querySelector("#share-site")?.addEventListener("click",async()=>{
    const data={title:"NightCamFinds",text:"Discover live rooms on NightCamFinds.",url:location.origin+"/"};
    try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(data.url);const b=document.querySelector("#share-site");b.textContent="Link copied";setTimeout(()=>b.textContent="Share NightCamFinds",2200);}}catch(_){}
  });
  render();
})();