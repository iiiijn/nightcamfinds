"use strict";
const { isIso3166Alpha2 } = require("./iso-country-codes.cjs");
const COUNTRY_NAME_CODES = new Map([
 ["UNITED STATES","US"],["UNITED STATES OF AMERICA","US"],["USA","US"],["UNITED KINGDOM","GB"],["GREAT BRITAIN","GB"],["UK","GB"],
 ["CANADA","CA"],["AUSTRALIA","AU"],["GERMANY","DE"],["FRANCE","FR"],["NETHERLANDS","NL"],["THE NETHERLANDS","NL"],
 ["IRELAND","IE"],["NEW ZEALAND","NZ"],["SWEDEN","SE"],["NORWAY","NO"],["DENMARK","DK"],["FINLAND","FI"],
 ["SWITZERLAND","CH"],["AUSTRIA","AT"],["BELGIUM","BE"],
 ["CZECHIA","CZ"],["CZECH REPUBLIC","CZ"],["ESTONIA","EE"],["ISRAEL","IL"],["ITALY","IT"],["SLOVAKIA","SK"],
 ["RUSSIA","RU"],["RUSSIAN FEDERATION","RU"],["РОССИЯ","RU"],["SLOVENIA","SI"],["POLAND","PL"],["ICELAND","IS"],["LATVIA","LV"],
 ["GREECE","GR"],["SPAIN","ES"],["LITHUANIA","LT"],["REPUBLIC OF LITHUANIA","LT"],["LUXEMBOURG","LU"],
 ["UNITED ARAB EMIRATES","AE"],["UAE","AE"],["ROMANIA","RO"],["HUNGARY","HU"],["TURKEY","TR"],["TÜRKIYE","TR"],
 ["CYPRUS","CY"],["BULGARIA","BG"],["CROATIA","HR"],["PORTUGAL","PT"],["NORTH MACEDONIA","MK"],
 ["SOUTH AFRICA","ZA"],["BAHRAIN","BH"],["JORDAN","JO"],["HASHEMITE KINGDOM OF JORDAN","JO"],["SERBIA","RS"],
 ["ARGENTINA","AR"],["KAZAKHSTAN","KZ"],["UKRAINE","UA"],["BELARUS","BY"],["CHINA","CN"],["MEXICO","MX"],
 ["REPUBLIC OF MOLDOVA","MD"],["MOLDOVA","MD"],["BOSNIA AND HERZEGOVINA","BA"],["BRAZIL","BR"],["COLOMBIA","CO"],["EGYPT","EG"],["INDIA","IN"],["KENYA","KE"]
]);
function textValue(value) {
 if (typeof value==="string"||typeof value==="number") return String(value).trim();
 if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
 if (value&&typeof value==="object") for (const key of ["name","language","label","title","value","code","text"]) if(value[key]!=null){const s=textValue(value[key]);if(s)return s;}
 return "";
}
function normalizeCountryCode(value) {
 const raw=textValue(value);
 if(/^[A-Za-z]{2}$/.test(raw)) { const code=raw.toUpperCase(); return isIso3166Alpha2(code) ? code : ""; }
 return COUNTRY_NAME_CODES.get(raw.toUpperCase())||"";
}
function resolveChaturbateCountry(country, location) {
 const explicit = normalizeCountryCode(country);
 if (explicit) return explicit;
 if (typeof location !== "string") return "";
 const text = location.trim();
 if (!text) return "";
 const exact = normalizeCountryCode(text);
 if (exact) return exact;
 const parts = text.split(",").map((part) => part.trim());
 if (parts.length < 2 || parts.some((part) => !part)) return "";
 return normalizeCountryCode(parts[parts.length - 1]);
}
function normalizeRegion(value){return textValue(value).replaceAll("\t"," ").replaceAll("\n"," ").split(" ").filter(Boolean).join(" ").slice(0,80);}
function normalizeLanguages(value){
 const values=(Array.isArray(value)?value:[value]).map(textValue).flatMap(v=>v.split(/[,;|]/)).map(v=>v.trim()).filter(Boolean);
 return [...new Set(values)].slice(0,8).join(", ");
}
function isValidCountryRoom(room){
 return !!room&&typeof room.id==="string"&&room.id.trim().length>0&&
  ["chaturbate","bongacams"].includes(String(room.platform||"").toLowerCase())&&
  !!normalizeCountryCode(room.country);
}
function isIndexableCountryRooms(rooms,minimum=10){
 if(!Array.isArray(rooms))return false;
 const unique=new Set();
 for(const room of rooms)if(isValidCountryRoom(room))unique.add(room.id.trim());
 return unique.size>=minimum;
}
function buildCountrySitemap(origin,rooms,countryEntries,lastmodByPath={}){
 const base=(String(origin||"").endsWith("/")?String(origin||"").slice(0,-1):String(origin||""));
 const staticPaths=["/","/live/","/female/","/male/","/trans/","/couples/","/hd/","/new/","/popular/","/countries/","/sitemap/","/broadcast","/about","/affiliate-disclosure","/privacy","/terms","/contact"];
 const byCountry=new Map();
 for(const room of Array.isArray(rooms)?rooms:[]){
  if(!isValidCountryRoom(room))continue;
  const code=normalizeCountryCode(room.country);
  if(!byCountry.has(code))byCountry.set(code,new Map());
  byCountry.get(code).set(room.id.trim(),room);
 }
 const countryPaths=(Array.isArray(countryEntries)?countryEntries:[])
  .filter(e=>isIndexableCountryRooms([...(byCountry.get(normalizeCountryCode(e.code))||new Map()).values()]))
  .map(e=>"/country/"+String(e.slug).toLowerCase()+"/");
 const esc=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
 const paths=[...staticPaths,...countryPaths];
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>{
  const raw=lastmodByPath&&lastmodByPath[p];const date=raw?new Date(raw):null;
  const lastmod=date&&Number.isFinite(date.getTime())?"<lastmod>"+date.toISOString()+"</lastmod>":"";
  return "<url><loc>"+esc(base+p)+"</loc>"+lastmod+"</url>";
 }).join("")+"</urlset>";
}

function buildHtmlSitemap(origin,rooms,countryEntries){
 let base=String(origin||"");while(base.endsWith("/"))base=base.slice(0,-1);
 const escapeHtml=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
 const sections=[
  {title:"Live room discovery",links:[["/live/","All live rooms"],["/popular/","Popular live rooms"],["/new/","New live rooms"],["/hd/","HD live rooms"]]},
  {title:"Browse by category",links:[["/female/","Female models"],["/male/","Male models"],["/trans/","Trans models"],["/couples/","Couple models"]]},
  {title:"For broadcasters",links:[["/broadcast","Become a broadcaster"]]},
  {title:"About NightCamFinds",links:[["/about","About us"],["/contact","Contact"],["/affiliate-disclosure","Affiliate disclosure"],["/privacy","Privacy policy"],["/terms","Terms and conditions"]]}
 ];
 const byCountry=new Map();
 for(const room of Array.isArray(rooms)?rooms:[]){
  if(!isValidCountryRoom(room))continue;
  const code=normalizeCountryCode(room.country);
  if(!byCountry.has(code))byCountry.set(code,new Map());
  byCountry.get(code).set(room.id.trim(),room);
 }
 const countries=(Array.isArray(countryEntries)?countryEntries:[])
  .filter(entry=>{
   const code=normalizeCountryCode(entry&&entry.code);
   const slug=String(entry&&entry.slug||"").toLowerCase();
   return !!code&&slug===code.toLowerCase()&&isIndexableCountryRooms([...(byCountry.get(code)||new Map()).values()]);
  })
  .sort((a,b)=>String(a.name||a.slug).localeCompare(String(b.name||b.slug)));
 const renderLinks=links=>"<ul>"+links.map(([href,label])=>'<li><a href="'+escapeHtml(href)+'">'+escapeHtml(label)+"</a></li>").join("")+"</ul>";
 const sectionMarkup=sections.map(section=>"<section><h2>"+escapeHtml(section.title)+"</h2>"+renderLinks(section.links)+"</section>").join("");
 const countryMarkup=countries.length?renderLinks(countries.map(country=>["/country/"+country.slug.toLowerCase()+"/",country.name||country.code])):"<p>No country pages currently meet the live-room availability threshold. Please check again later.</p>";
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site Map | NightCamFinds</title><meta name="description" content="Explore NightCamFinds live room categories, country directories and broadcaster information."><meta name="robots" content="index,follow"><link rel="canonical" href="'+escapeHtml(base+"/sitemap/")+'"><style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:960px;margin:0 auto;padding:24px;color:#20212a}a{color:#2455a4;text-decoration:none}a:hover{text-decoration:underline}.brand{font-weight:800;font-size:1.25rem;color:inherit}.intro{max-width:720px;color:#555}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:24px}section{border:1px solid #e5e7eb;border-radius:12px;padding:16px}h1{margin-bottom:4px}h2{font-size:1.05rem;margin-top:0}ul{padding-left:20px;margin-bottom:0}li{margin:6px 0}.note{font-size:.9rem;color:#666}@media(max-width:520px){body{padding:16px}}</style></head><body><a class="brand" href="/">NightCamFinds</a><h1>Site Map</h1><p class="intro">Find your way around NightCamFinds. Browse live room categories, explore countries with sufficient current room inventory, or learn about the directory.</p><main>'+sectionMarkup+'<section><h2>Discover by country</h2><ul><li><a href="/countries/">Browse all countries</a></li></ul>'+countryMarkup+'<p class="note">Country links appear when the partner feeds contain at least 10 distinct valid live rooms for that country. Availability can change.</p></section></main><p class="note">NightCamFinds is an independent 18+ discovery directory. Streams and broadcaster accounts are provided by partner platforms.</p></body></html>';
}

module.exports={normalizeCountryCode,resolveChaturbateCountry,normalizeRegion,normalizeLanguages,isValidCountryRoom,isIndexableCountryRooms,buildCountrySitemap,buildHtmlSitemap};
