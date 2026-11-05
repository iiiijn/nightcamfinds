"use strict";
const COUNTRY_NAME_CODES = new Map([
 ["UNITED STATES","US"],["UNITED STATES OF AMERICA","US"],["UNITED KINGDOM","GB"],["GREAT BRITAIN","GB"],["UK","GB"],
 ["CANADA","CA"],["AUSTRALIA","AU"],["GERMANY","DE"],["FRANCE","FR"],["NETHERLANDS","NL"],["THE NETHERLANDS","NL"],
 ["IRELAND","IE"],["NEW ZEALAND","NZ"],["SWEDEN","SE"],["NORWAY","NO"],["DENMARK","DK"],["FINLAND","FI"],
 ["SWITZERLAND","CH"],["AUSTRIA","AT"],["BELGIUM","BE"]
]);
function textValue(value) {
 if (typeof value==="string"||typeof value==="number") return String(value).trim();
 if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
 if (value&&typeof value==="object") for (const key of ["name","language","label","title","value","code","text"]) if(value[key]!=null){const s=textValue(value[key]);if(s)return s;}
 return "";
}
function normalizeCountryCode(value) {
 const raw=textValue(value);
 if(/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
 return COUNTRY_NAME_CODES.get(raw.toUpperCase())||"";
}
function normalizeRegion(value){return textValue(value).replace(/\s+/g," ").slice(0,80);}
function normalizeLanguages(value){
 const values=(Array.isArray(value)?value:[value]).map(textValue).flatMap(v=>v.split(/[,;|]/)).map(v=>v.trim()).filter(Boolean);
 return [...new Set(values)].slice(0,8).join(", ");
}
function isIndexableCountryRoomCount(count,minimum=10){const total=Number(count);return Number.isFinite(total)&&total>=minimum;}
function buildCountrySitemap(origin,rooms,countryEntries,lastmod){
 const base=String(origin||"").replace(/\/$/,"");const updated=new Date(lastmod);
 if(!Number.isFinite(updated.getTime()))throw new TypeError("A valid sitemap lastmod date is required");
 const date=updated.toISOString();
 const staticPaths=["/","/live/","/female/","/male/","/trans/","/couples/","/hd/","/new/","/popular/","/countries/","/broadcast","/about","/affiliate-disclosure","/privacy","/terms","/contact"];
 const counts=new Map();
 for(const room of Array.isArray(rooms)?rooms:[]){const code=normalizeCountryCode(room?.country);if(code)counts.set(code,(counts.get(code)||0)+1);}
 const countryPaths=(Array.isArray(countryEntries)?countryEntries:[]).filter(e=>isIndexableCountryRoomCount(counts.get(e.code)||0)).map(e=>`/country/${String(e.slug).toLowerCase()}/`);
 const esc=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticPaths,...countryPaths].map(p=>`<url><loc>${esc(base+p)}</loc><lastmod>${date}</lastmod></url>`).join("")}</urlset>`;
}
module.exports={normalizeCountryCode,normalizeRegion,normalizeLanguages,isIndexableCountryRoomCount,buildCountrySitemap};
