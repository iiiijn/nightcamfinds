"use strict";
const { isIso3166Alpha2 } = require("./iso-country-codes.cjs");
const COUNTRY_NAME_CODES = new Map([
 ["UNITED STATES","US"],["UNITED STATES OF AMERICA","US"],["UNITED KINGDOM","GB"],["GREAT BRITAIN","GB"],["UK","GB"],
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
 ["REPUBLIC OF MOLDOVA","MD"],["MOLDOVA","MD"],["BOSNIA AND HERZEGOVINA","BA"],["BRAZIL","BR"],["EGYPT","EG"],["INDIA","IN"],["KENYA","KE"]
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
 const staticPaths=["/","/live/","/female/","/male/","/trans/","/couples/","/hd/","/new/","/popular/","/countries/","/broadcast","/about","/affiliate-disclosure","/privacy","/terms","/contact"];
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
module.exports={normalizeCountryCode,normalizeRegion,normalizeLanguages,isValidCountryRoom,isIndexableCountryRooms,buildCountrySitemap};
