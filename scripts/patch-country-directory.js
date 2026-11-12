"use strict";
const fs=require("fs");
const path=require("path");
const MARKER="NIGHTCAMFINDS_COUNTRY_DIRECTORY_V1";
function patchServerSource(input){
 let source=String(input||"");
 if(source.includes(MARKER))return source;
 const replaceOnce=(before,after,label)=>{
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`Country directory patch expected one ${label} match, found ${count}`);
  source=source.replace(before,after);
 };
 replaceOnce('const { getCountryPage } = require("./country-pages.js");',
  'const { COUNTRIES, getCountryPage } = require("./country-pages.js");\nconst { normalizeCountryCode, normalizeRegion, normalizeLanguages, isIndexableCountryRooms, buildCountrySitemap } = require("./src/services/country-directory.cjs");\nconst { summarizeCountryRouteHealth } = require("./src/services/country-route-health.cjs");\nconst { summarizeCountryFeedHealth } = require("./src/services/country-feed-health.cjs");',
  "country page import");
 const normalizers=/function normalizeChaturbateRoom\(room\) \{[^\n]*\}\nfunction bongaGender\(value\) \{[^\n]*\}\nfunction normalizeBongaRoom\(room\) \{[^\n]*\}/;
 if(!normalizers.test(source))throw new Error("Country directory patch could not locate both partner normalizers");
 const normalizedPartnerCode = [
  'function normalizeChaturbateRoom(room,apiRegion="") {',
  '  const country=normalizeCountryCode(room.country);',
  '  return {id:"chaturbate:"+room.username,platform:"chaturbate",platformName:"Chaturbate",username:room.username,',
  '   displayName:clean(room.display_name||room.username)||room.username,gender:normalizeRoomGender(room.gender),',
  '   country,countryName:NAMES[country]||country,',
  '   region:getDiscoveryRegion({country,partnerRegion:normalizeRegion(room.region||room.region_name||room.state||room.province),apiRegion}),',
  '   location:clean(room.location),viewerCount:Number(room.num_users||0),isHd:!!room.is_hd,isNew:!!room.is_new,',
  '   image:room.image_url_360x270||room.image_url||"",roomSubject:clean(room.room_subject),',
  '   languages:normalizeLanguages(room.spoken_languages||room.languages||room.language),',
  '   href:room.chat_room_url_revshare||room.chat_room_url||""};',
  '}',
  'function bongaGender(value) { return normalizeRoomGender(value); }',
  'function normalizeBongaRoom(room){',
  ' const username=clean(room.username||room.user_name||room.nickname||room.model||room.id);if(!username)return null;',
  ' const rawImages=room.profile_images||room.images||{};const images=typeof rawImages==="string"?{}:rawImages;',
  ' const age=Number(room.display_age||room.age||0);const tags=plainText(room.tags);if(Number.isFinite(age)&&age>0&&age<18)return null;',
  ' const country=normalizeCountryCode(room.homecountry||room.country||room.country_code);',
  ' const viewers=Number(room.members_count??room.num_users??room.viewers??room.viewer_count??0)||0;',
  ' const image=(typeof rawImages==="string"?rawImages:"")||images.profile_image||images.thumbnail_image_big||images.thumbnail_image_medium||images.thumbnail_image_small||images.thumbnail_image_big_live||images.thumbnail_image_medium_live||room.image_url||room.thumbnail||room.avatar||"";',
  ' return {id:"bongacams:"+username,platform:"bongacams",platformName:"BongaCams",username,',
  '  displayName:clean(room.display_name||room.name||username)||username,gender:bongaGender(room.gender||room.sex),',
  '  country,countryName:NAMES[country]||country,region:getDiscoveryRegion({country,partnerRegion:normalizeRegion(room.region||room.region_name||room.state||room.province)}),',
  '  location:clean(room.hometown||room.location||country),viewerCount:viewers,isHd:!!room.hd_cam||!!room.hd||/\\bhd\\b/i.test(tags),',
  '  isNew:!!room.is_new||!!room.new,image,roomSubject:clean(room.chat_topic||room.room_subject||room.topic||tags),',
  '  languages:normalizeLanguages([room.primary_language,room.secondary_language,room.language,room.languages]),',
  '  href:room.chat_url||room.direct_chat_url||room.room_url||room.url||""};',
  '}'
 ].join("\n");
 source=source.replace(normalizers,normalizedPartnerCode);
 const earlyStart=source.indexOf("  const countryMatch = pathname.match(");
 const earlyEnd=source.indexOf("  if(pages[pathname])",earlyStart);
 if(earlyStart<0||earlyEnd<0)throw new Error("Country directory patch could not locate the early duplicate country route");
 source=source.slice(0,earlyStart)+source.slice(earlyEnd);
 replaceOnce(' const entry={at:Date.now(),rooms:combined,notice:notices.length?notices.join(" · "):(combined.length?"":"Live rooms are temporarily unavailable. Please check again shortly.")};',
  '  const providerHealth={chaturbate:results[0].status==="fulfilled"?"available":"unavailable",bongacams:!BONGA_ENABLED?"disabled":results[1].status==="fulfilled"?"available":"unavailable"};\n  const entry={at:Date.now(),rooms:combined,providerHealth,notice:notices.length?notices.join(" · "):(combined.length?"":"Live rooms are temporarily unavailable. Please check again shortly.")};',
  "provider feed health");
 const oldSitemap=/function sitemap\(origin\)\{[^\n]*\}/;
 if(!oldSitemap.test(source))throw new Error("Country directory patch could not locate sitemap builder");
 source=source.replace(oldSitemap,'function sitemap(origin,feedRooms){return buildCountrySitemap(origin,feedRooms,Object.entries(COUNTRIES).map(([slug,country])=>({slug,code:country.code})),{});}');
 replaceOnce('  if(pathname==="/sitemap.xml")return send(res,200,sitemap(pageOrigin(req)),"application/xml");',
  '  if(pathname==="/sitemap.xml"){const feed=await rooms(req);return send(res,200,sitemap(pageOrigin(req),feed.rooms),"application/xml");}',
  "sitemap route");
 replaceOnce('    const countryRooms = rankRoomsByPreferredPlatform(feed.rooms.filter((room) => room.country === iso), null, "recommended").slice(0, 60);\n    const roomMarkup = renderRoomCards(countryRooms, { category: "all", pagePath: pathname });\n    const countryHtml = getCountryPage(countryRoute[1], pageOrigin(req), roomMarkup, countryRooms.length > 0);',
  '    const countryRooms = rankRoomsByPreferredPlatform(feed.rooms.filter((room) => room.country === iso), null, "recommended");\n    const routeHealth = summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms });\n    console.info("[country-route]", JSON.stringify({ country: iso, status: 200, feedHealth: routeHealth.feedHealth, roomCount: routeHealth.roomCount, qualifyingRoomCount: routeHealth.qualifyingRoomCount, indexable: routeHealth.indexable }));\n    const roomMarkup = renderRoomCards(countryRooms.slice(0, 60), { category: "all", pagePath: pathname });\n    const countryHtml = getCountryPage(countryRoute[1], pageOrigin(req), roomMarkup, routeHealth.indexable);',
  "country room threshold and route diagnostics");
 replaceOnce('  if (url.searchParams.get("summary") === "1") { const diagnostics = url.searchParams.get("diagnostics") === "1" ? { basis: "normalized_partner_feed_snapshot", rawProviderPayloadsAvailable: false, bongaRawFieldSchemaAvailable: Boolean(latestBongaRawDiagnostics), providers: summarizeProviderFeedQuality(feed.rooms), ...(latestBongaRawDiagnostics ? { bongaRawFieldSchema: latestBongaRawDiagnostics } : {}) } : null; return send(res,200,JSON.stringify({liveCount:list.length,platforms,regions,languages,notice:feed.notice,...(coverage?{coverage}:{}),...(diagnostics?{diagnostics}:{})}),"application/json"); }',
  '  if (url.searchParams.get("summary") === "1") { const diagnostics = url.searchParams.get("diagnostics") === "1" ? { basis: "normalized_partner_feed_snapshot", rawProviderPayloadsAvailable: false, bongaRawFieldSchemaAvailable: Boolean(latestBongaRawDiagnostics), providers: summarizeProviderFeedQuality(feed.rooms), countryFeedHealth: summarizeCountryFeedHealth({ countries: Object.entries(COUNTRIES).map(([slug,country])=>({slug,...country})), providerHealth: feed.providerHealth || {}, rooms: feed.rooms, refreshedAt: feed.at }), ...(latestBongaRawDiagnostics ? { bongaRawFieldSchema: latestBongaRawDiagnostics } : {}) } : null; return send(res,200,JSON.stringify({liveCount:list.length,platforms,regions,languages,notice:feed.notice,...(coverage?{coverage}:{}),...(diagnostics?{diagnostics}:{})}),"application/json"); }',
  "country feed health summary diagnostics");

 replaceOnce('    return send(res, 200, countryHtml, "text/html; charset=utf-8");',
  '    return send(res, 200, countryHtml, "text/html; charset=utf-8", visitCookieHeaders(req, pathname));',
  "active country route visit cookies");
 if (!source.includes('const region=(url.searchParams.get("region")||"").trim();') ||
     !source.includes('const language=(url.searchParams.get("language")||"").trim().toLowerCase();')) {
  replaceOnce('  const country=(url.searchParams.get("country")||"").toUpperCase();\n  const platform=(url.searchParams.get("platform")||"").toLowerCase();',
   '  const country=normalizeCountryCode(url.searchParams.get("country"));\n  const region=(url.searchParams.get("region")||"").trim().toLowerCase();\n  const language=(url.searchParams.get("language")||"").trim().toLowerCase();\n  const platform=(url.searchParams.get("platform")||"").toLowerCase();',
   "room API location filters");
 }
 if (!source.includes('if(region)list=list.filter') || !source.includes('if(language)list=list.filter')) {
  replaceOnce('  if(country)list=list.filter(r=>r.country===country);\n  if(["chaturbate","bongacams"].includes(platform))',
   '  if(country)list=list.filter(r=>r.country===country);\n  if(region)list=list.filter(r=>String(r.region||"").toLowerCase()===region);\n  if(language)list=list.filter(r=>String(r.languages||"").toLowerCase().split(/[,;|]/).some(item=>item.trim()===language));\n  if(["chaturbate","bongacams"].includes(platform))',
   "room API region and language filters");
 }
 if (!source.includes('const regions=')) {
  replaceOnce('  const platforms=[...new Set(feed.rooms.map(r=>r.platform).filter(Boolean))].sort();\n  if (url.searchParams.get("summary") === "1") return send(res,200,JSON.stringify({liveCount:list.length,platforms,notice:feed.notice}),"application/json");\n  return send(res,200,JSON.stringify({rooms:list.slice(0,60),liveCount:list.length,countries,platforms,notice:feed.notice,',
   '  const platforms=[...new Set(feed.rooms.map(r=>r.platform).filter(Boolean))].sort();\n  const regions=[...new Set(feed.rooms.map(r=>r.region).filter(Boolean))].sort();\n  const languages=[...new Set(feed.rooms.flatMap(r=>String(r.languages||"").split(/[,;|]/).map(v=>v.trim()).filter(Boolean)))].sort();\n  if (url.searchParams.get("summary") === "1") return send(res,200,JSON.stringify({liveCount:list.length,platforms,notice:feed.notice}),"application/json");\n  return send(res,200,JSON.stringify({rooms:list.slice(0,60),liveCount:list.length,countries,regions,languages,platforms,notice:feed.notice,',
   "room API discovery facets");
 }
 return "// "+MARKER+"\n"+source;
}
if(require.main===module){
 const file=path.join(__dirname,"..","server.js");const before=fs.readFileSync(file,"utf8");const after=patchServerSource(before);
 if(after!==before){fs.writeFileSync(file,after);console.log("NightCamFinds country directory patch applied");}
 else console.log("NightCamFinds country directory patch already applied");
}
module.exports={patchServerSource};
