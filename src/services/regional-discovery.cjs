"use strict";

const { normalizeCountryCode } = require("./country-directory.cjs");

const CHATURBATE_API_REGIONS = Object.freeze(["asia","europe_russia","northamerica","southamerica","other"]);
const REGION_ORDER = Object.freeze(["North America","Western Europe","Northern Europe","Central & Eastern Europe","Southern Europe","Europe & Asia","Asia-Pacific","Latin America","Africa","Middle East","Other"]);
const COUNTRY_REGION = Object.freeze({
 US:"North America",CA:"North America",
 GB:"Western Europe",IE:"Western Europe",FR:"Western Europe",NL:"Western Europe",BE:"Western Europe",CH:"Western Europe",AT:"Western Europe",LU:"Western Europe",
 SE:"Northern Europe",NO:"Northern Europe",DK:"Northern Europe",FI:"Northern Europe",IS:"Northern Europe",EE:"Northern Europe",LV:"Northern Europe",LT:"Northern Europe",
 DE:"Central & Eastern Europe",CZ:"Central & Eastern Europe",SK:"Central & Eastern Europe",SI:"Central & Eastern Europe",PL:"Central & Eastern Europe",RO:"Central & Eastern Europe",HU:"Central & Eastern Europe",BG:"Central & Eastern Europe",HR:"Central & Eastern Europe",RS:"Central & Eastern Europe",MK:"Central & Eastern Europe",UA:"Central & Eastern Europe",BY:"Central & Eastern Europe",MD:"Central & Eastern Europe",BA:"Central & Eastern Europe",
 GR:"Southern Europe",ES:"Southern Europe",IT:"Southern Europe",PT:"Southern Europe",CY:"Southern Europe",
 RU:"Europe & Asia",TR:"Europe & Asia",
 AU:"Asia-Pacific",NZ:"Asia-Pacific",JP:"Asia-Pacific",SG:"Asia-Pacific",KZ:"Asia-Pacific",CN:"Asia-Pacific",IN:"Asia-Pacific",
 AR:"Latin America",MX:"Latin America",BR:"Latin America",
 ZA:"Africa",EG:"Africa",KE:"Africa",
 IL:"Middle East",AE:"Middle East",BH:"Middle East",JO:"Middle East"
});
const API_REGION_FALLBACK = Object.freeze({northamerica:"North America",europe_russia:"Europe & Asia",asia:"Asia-Pacific",southamerica:"Latin America",other:"Other"});
const REGION_ALIASES = new Map([
 ["north america","North America"],["northamerica","North America"],
 ["western europe","Western Europe"],["northern europe","Northern Europe"],
 ["central europe","Central & Eastern Europe"],["eastern europe","Central & Eastern Europe"],["central and eastern europe","Central & Eastern Europe"],["central & eastern europe","Central & Eastern Europe"],
 ["southern europe","Southern Europe"],["europe","Europe & Asia"],["europe/russia","Europe & Asia"],["europe russia","Europe & Asia"],["europe & asia","Europe & Asia"],
 ["asia","Asia-Pacific"],["asia pacific","Asia-Pacific"],["south america","Latin America"],["southamerica","Latin America"],["latin america","Latin America"],
 ["africa","Africa"],["middle east","Middle East"],["other","Other"]
]);
function normalizePartnerCountry(value){return normalizeCountryCode(value);}
function normalizeKnownRegion(value){
 const key=String(value||"").trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
 return REGION_ALIASES.get(key)||"";
}
function getDiscoveryRegion({country,partnerRegion,apiRegion}={}){
 const code=normalizePartnerCountry(country);
 if(code&&COUNTRY_REGION[code])return COUNTRY_REGION[code];
 const known=normalizeKnownRegion(partnerRegion);
 if(known)return known;
 return API_REGION_FALLBACK[String(apiRegion||"").trim().toLowerCase()]||"Other";
}
function sortRooms(rooms,sort="recommended"){
 return (Array.isArray(rooms)?rooms:[]).slice().sort((a,b)=>{
  if(sort==="newest")return Number(!!b.isNew)-Number(!!a.isNew)||Number(b.viewerCount||0)-Number(a.viewerCount||0);
  return Number(b.viewerCount||0)-Number(a.viewerCount||0);
 });
}
function buildRegionalRoomGroups(rooms,sort="recommended",perRegion=8){
 const limit=Math.max(1,Math.min(20,Number(perRegion)||8));
 const grouped=new Map();
 for(const room of Array.isArray(rooms)?rooms:[]){
  const region=String(room.region||getDiscoveryRegion({country:room.country,partnerRegion:room.partnerRegion,apiRegion:room.apiRegion})||"Other");
  if(!grouped.has(region))grouped.set(region,[]);
  grouped.get(region).push(room);
 }
 const ordered=[...grouped.keys()].sort((a,b)=>{
  const ai=REGION_ORDER.indexOf(a),bi=REGION_ORDER.indexOf(b);
  return (ai<0?REGION_ORDER.length:ai)-(bi<0?REGION_ORDER.length:bi)||a.localeCompare(b);
 });
 const result={};
 for(const region of ordered)result[region]=sortRooms(grouped.get(region),sort).slice(0,limit);
 return result;
}
module.exports={CHATURBATE_API_REGIONS,REGION_ORDER,COUNTRY_REGION,normalizePartnerCountry,normalizeKnownRegion,getDiscoveryRegion,sortRooms,buildRegionalRoomGroups};
