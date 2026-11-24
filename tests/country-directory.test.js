"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {normalizeCountryCode,resolveChaturbateCountry,normalizeRegion,normalizeLanguages,isValidCountryRoom,isIndexableCountryRooms,buildCountrySitemap}=require("../src/services/country-directory.cjs");
const {patchServerSource}=require("../scripts/patch-country-directory.js");
const {COUNTRIES,getCountryPage}=require("../country-pages.js");
const {MARKET_META,MARKET_PRIORITY_CODES,REGION_GROUPS}=require("../src/config/market-countries.cjs");
test("country values normalize ISO codes and explicit country names only",()=>{
 assert.equal(normalizeCountryCode(" gb "),"GB");assert.equal(normalizeCountryCode("United States"),"US");
 assert.equal(normalizeCountryCode("USA"),"US");assert.equal(normalizeCountryCode("usa"),"US");
 assert.equal(normalizeCountryCode("Colombia"),"CO");assert.equal(normalizeCountryCode("colombia"),"CO");
 assert.equal(normalizeCountryCode("The Netherlands"),"NL");
 assert.equal(normalizeCountryCode("россия"),"RU");
 assert.equal(normalizeCountryCode("РОССИЯ"),"RU");assert.equal(normalizeCountryCode("Nairobi"),"");assert.equal(normalizeCountryCode(""),"");
});
test("Chaturbate startup normalizer uses explicit country and conservative location resolution",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","scripts","patch-country-directory.js"),"utf8");
 assert.match(source,/const country=resolveChaturbateCountry\(room\.country,room\.location\);/);
 assert.match(source,/countryName:NAMES\[country\]\|\|country/);
});
test("Chaturbate country resolution accepts explicit country names and unambiguous final location components",()=>{
 assert.equal(resolveChaturbateCountry("Germany",""),"DE");
 assert.equal(resolveChaturbateCountry("","Berlin, Germany"),"DE");
 assert.equal(resolveChaturbateCountry("","Nairobi, Kenya"),"KE");
 assert.equal(resolveChaturbateCountry("","Paris, France / Berlin, Germany"),"");
 assert.equal(resolveChaturbateCountry("","Paris / France, Germany"),"");
 assert.equal(resolveChaturbateCountry("","Paris, France / Germany"),"");
 assert.equal(resolveChaturbateCountry("","Berlin"),"");
});
test("region and language values normalize without inferring residence from language",()=>{
 assert.equal(normalizeRegion("  Bavaria  "),"Bavaria");assert.equal(normalizeLanguages(["English","German","English"]),"English, German");
 assert.equal(normalizeLanguages({name:"French"}),"French");assert.equal(normalizeRegion(""),"");
});
test("country indexability requires ten distinct valid feed rooms",()=>{
 const rooms=Array.from({length:10},(_,i)=>({id:"chaturbate:"+i,platform:"chaturbate",country:"US"}));
 assert.equal(isValidCountryRoom(rooms[0]),true);assert.equal(isIndexableCountryRooms(rooms),true);
 assert.equal(isIndexableCountryRooms(rooms.slice(0,9)),false);
 assert.equal(isIndexableCountryRooms([...rooms,{...rooms[0]}]),true);
 assert.equal(isIndexableCountryRooms(rooms.map(r=>({...r,platform:"unknown"}))),false);
 assert.equal(isIndexableCountryRooms(rooms.map(r=>({...r,country:""}))),false);
});
test("sitemap excludes thin, duplicate, invalid and unknown-country rooms",()=>{
 const rooms=[...Array.from({length:10},(_,i)=>({id:"us:"+i,platform:"chaturbate",country:"US"})),...Array.from({length:9},(_,i)=>({id:"gb:"+i,platform:"bongacams",country:"GB"})),...Array.from({length:12},(_,i)=>({id:"de:"+i,platform:"bongacams",country:"Germany"})),{id:"us:0",platform:"chaturbate",country:"US"},{id:"invalid",platform:"unknown",country:"US"}];
 const xml=buildCountrySitemap("https://nightcamfinds.com",rooms,[{slug:"us",code:"US"},{slug:"gb",code:"GB"},{slug:"de",code:"DE"}]);
 assert.match(xml,/\/country\/us\//);assert.doesNotMatch(xml,/\/country\/gb\//);assert.match(xml,/\/country\/de\//);
 assert.doesNotMatch(xml,/<lastmod>/);
});
test("sitemap includes lastmod only when an explicit valid page modification date is supplied",()=>{
 const xml=buildCountrySitemap("https://nightcamfinds.com",[],[],{"/about":"2026-11-01T10:00:00Z","/privacy":"not-a-date"});
 assert.match(xml,/<loc>https:\/\/nightcamfinds\.com\/about<\/loc><lastmod>2026-11-01T10:00:00\.000Z<\/lastmod>/);
 assert.match(xml,/<loc>https:\/\/nightcamfinds\.com\/privacy<\/loc><\/url>/);
});
test("server patch normalizes partner countries and regions for regional discovery",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");const patched=patchServerSource(source);
 assert.match(patched,/partnerRegion=normalizeRegion\(room\.region\|\|room\.region_name\|\|room\.state\|\|room\.province\)/);
  assert.match(patched,/region:getDiscoveryRegion\(\{country,partnerRegion,apiRegion\}\)/);
 assert.ok(patched.includes('const country=normalizeBongaCountry(room);'));
});
test("server patch preserves region and language discovery facets in the rooms API",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");const patched=patchServerSource(source);
 assert.match(patched,/const regions=\[\.\.\.new Set\(feed\.rooms\.map\(r=>r\.region\|\|regionFor\(r\)\)\)\]\.sort\(/);
 assert.match(patched,/const languages=\[\.\.\.new Set\(feed\.rooms\.flatMap/);
 assert.match(patched,/rooms:page,regionalRooms,topChaturbateByCategory,topBongaByCategory,liveCount:list\.length,offset,limit,hasMore:offset\+page\.length<list\.length,countries,platforms,regions,languages,notice:feed\.notice/);
 assert.match(patched,/url\.searchParams\.get\("summary"\)\s*===\s*"1"/);
});
test("server patch uses room-quality checks and does not invent sitemap modification dates",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");const patched=patchServerSource(source);
 assert.ok(patched.includes("summarizeCountryRouteHealth"));
 assert.ok(!patched.includes("const countryMatch = pathname.match("));
 assert.ok(patched.includes("summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms })"));
 assert.ok(patched.includes("routeHealth.indexable"));
 assert.ok(patched.includes("getEligibleCountrySitemapSlugs"));
 assert.ok(patched.includes("normalizeLanguages(room.spoken_languages"));
 assert.ok(patched.includes('url.searchParams.get("region")'));
 assert.ok(!patched.includes("new Date().toISOString());"));
 assert.equal(patchServerSource(patched),patched);
});

test("all worldwide market landing pages have unique slugs, ISO codes, region groups and priorities",()=>{
 const entries=Object.entries(COUNTRIES);
 assert.equal(entries.length,57,"the worldwide directory should contain all 56 requested countries");
 const slugs=entries.map(([slug])=>slug);
 const codes=entries.map(([,country])=>country.code);
 assert.equal(new Set(slugs).size,57,"market slugs must be unique");
 assert.equal(new Set(codes).size,57,"market country codes must be unique");
 for(const [slug,country] of entries){
  assert.match(slug,/^[a-z]{2}$/);
  assert.match(country.code,/^[A-Z]{2}$/);
  assert.equal(slug,country.code.toLowerCase());
  assert.ok(country.regionGroup, slug + " must have a region group");
  assert.ok(country.priority, slug + " must have a market priority");
 }
});

test("dynamic sitemap can publish every configured market when each has enough valid rooms",()=>{
 const entries=Object.entries(COUNTRIES).map(([slug,country])=>({slug,code:country.code}));
 const rooms=entries.flatMap(({code,slug})=>Array.from({length:10},(_,i)=>({
  id:slug+":"+i,platform:i%2?"bongacams":"chaturbate",country:code
 })));
 const xml=buildCountrySitemap("https://nightcamfinds.com",rooms,entries);
 for(const {slug} of entries)assert.ok(xml.includes("/country/"+slug+"/"),"missing sitemap URL for "+slug);
});

test("priority markets and regional groups are explicit and non-overlapping",()=>{
 assert.equal(MARKET_PRIORITY_CODES.length,18);
 assert.equal(new Set(MARKET_PRIORITY_CODES).size,18);
 assert.ok(MARKET_PRIORITY_CODES.includes("NO"));
 assert.ok(MARKET_PRIORITY_CODES.includes("CH"));
 assert.ok(MARKET_PRIORITY_CODES.includes("IS"));
 assert.ok(MARKET_PRIORITY_CODES.includes("LU"));
 const grouped=Object.values(REGION_GROUPS).flat();
 assert.equal(new Set(grouped).size,57);
 assert.equal(grouped.length,57);
 for(const [slug,meta] of Object.entries(MARKET_META)){
  assert.ok(["Tier 1","Tier 2","Tier 3"].includes(meta.priority),slug);
  assert.ok(meta.regionGroup,slug);
 }
});
test("country-name normalization covers newly added markets and official long-form names",()=>{
 for(const [name,code] of [["Norway","NO"],["Switzerland","CH"],["Czechia","CZ"],["Estonia","EE"],["United Arab Emirates","AE"],["Hashemite Kingdom of Jordan","JO"],["Republic of Moldova","MD"],["Bosnia and Herzegovina","BA"],["North Macedonia","MK"]]){
  assert.equal(normalizeCountryCode(name),code,name);
 }
});

test("server sitemap market list exactly follows the canonical 18 Tier 1 markets",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 assert.match(source,/const MARKETS = MARKET_PRIORITY_CODES\.map\(\(code\) => \[code\.toLowerCase\(\), code, MARKET_NAMES\[code\]\]\);/);
 const names=source.match(/const MARKET_NAMES = Object\.freeze\(\{([\s\S]*?)\}\);/);
 assert.ok(names,"server must define display names for every priority market");
 const configuredCodes=[...names[1].matchAll(/\b([A-Z]{2}):\s*"/g)].map(match=>match[1]);
 assert.deepEqual(configuredCodes,MARKET_PRIORITY_CODES);
 assert.ok(!configuredCodes.includes("JP"));
 assert.ok(!configuredCodes.includes("SG"));
 assert.ok(configuredCodes.includes("IS"));
 assert.ok(configuredCodes.includes("LU"));
});


test("country page robots directives follow the live-room quality threshold",()=>{
 const indexed=getCountryPage("us","https://nightcamfinds.com",'<a href="/go/chaturbate%3Aone">Room</a>',true);
 const thin=getCountryPage("us","https://nightcamfinds.com","",false);
 assert.match(indexed,/<meta name="robots" content="index,follow">/);
 assert.ok(indexed.includes('href="/sitemap/">Site map</a>'));
 assert.match(indexed,/<a href="\/go\/chaturbate%3Aone">Room<\/a>/);
 assert.match(thin,/<meta name="robots" content="noindex,follow">/);
 assert.match(indexed,/<link rel="canonical" href="https:\/\/nightcamfinds\.com\/country\/us\/">/);
});

test("country pages publish valid FAQPage structured data from their visible FAQs",()=>{
 const html=getCountryPage("is","https://nightcamfinds.com","",true);
 const match=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(match,"country page should include JSON-LD FAQ data");
 const schema=JSON.parse(match[1]);
 assert.equal(schema["@context"],"https://schema.org");
 assert.equal(schema["@type"],"FAQPage");
 assert.equal(schema.mainEntity.length,COUNTRIES.is.faqs.length);
 for(const [index,[question,answer]] of COUNTRIES.is.faqs.entries()){
  assert.equal(schema.mainEntity[index]["@type"],"Question");
  assert.equal(schema.mainEntity[index].name,question);
  assert.equal(schema.mainEntity[index].acceptedAnswer.text,answer);
 }
});

test("country startup patch renders live room cards, applies the ten-room robots gate and builds a feed-backed sitemap",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","scripts","patch-country-directory.js"),"utf8");
 assert.match(source,/rankRoomsByPreferredPlatform\(feed\.rooms\.filter\(\(room\) => room\.country === iso\)/);
 assert.match(source,/renderRoomCards\(countryRooms\.slice\(0, 60\)/);
 assert.match(source,/summarizeCountryRouteHealth\(\{ providerHealth: feed\.providerHealth, rooms: countryRooms \}\)/);
 assert.match(source,/getCountryPage\(countryRoute\[1\], pageOrigin\(req\), roomMarkup, routeHealth\.indexable, eligibleCountrySlugs\)/);
 assert.match(source,/function sitemap\(origin,feedRooms\)\{return buildCountrySitemap/);
 assert.match(source,/const feed=await rooms\(req\);return send\(res,200,sitemap\(pageOrigin\(req\),feed\.rooms\)/);
});

test("production startup applies country SEO and SPA route patches before serving traffic",()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,"..","package.json"),"utf8"));
 assert.match(pkg.scripts.start,/patch-country-directory\.js/);
 assert.match(pkg.scripts.start,/patch-spa-seo-routes\.js/);
 assert.ok(pkg.scripts.start.indexOf("patch-country-directory.js")<pkg.scripts.start.indexOf("route.js"));
 assert.ok(pkg.scripts.start.indexOf("patch-spa-seo-routes.js")<pkg.scripts.start.indexOf("route.js"));
});


test("country code normalization accepts assigned ISO alpha-2 codes and rejects unassigned two-letter values",()=>{
 assert.equal(normalizeCountryCode("US"),"US");
 assert.equal(normalizeCountryCode("gb"),"GB");
 assert.equal(normalizeCountryCode("KE"),"KE");
 assert.equal(normalizeCountryCode("NY"),"");
 assert.equal(normalizeCountryCode("ZZ"),"");
 assert.equal(normalizeCountryCode("XX"),"");
 assert.equal(normalizeCountryCode("United States"),"US");
});

test("production entry point routes through start.js into the room server",()=>{
 const route=fs.readFileSync(path.join(__dirname,"..","route.js"),"utf8");
 const start=fs.readFileSync(path.join(__dirname,"..","start.js"),"utf8");
 assert.match(route,/require\(["']\.\/start\.js["']\)/);
 assert.match(start,/require\(["']\.\/server\.js["']\)/);
});

test("country startup patch removes the shadowing handler and leaves one feed-backed route",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const patched=patchServerSource(source);
 assert.equal((patched.match(/const countryRoute = pathname\.match\(/g)||[]).length,1);
 assert.ok(!patched.includes("const countryMatch = pathname.match("));
 const start=patched.indexOf("const countryRoute = pathname.match(");
 const end=patched.indexOf("const file=pathname",start);
 const route=patched.slice(start,end);
 assert.ok(route.includes("const feed = await rooms(req);"));
 assert.ok(route.includes("summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms })"));
 assert.ok(route.includes("routeHealth.indexable"));
 assert.ok(route.includes('console.info("[country-route]"'));
 assert.ok(route.includes("visitCookieHeaders(req, pathname)"));
 assert.ok(route.includes("visitCookieHeaders(req, pathname)"));
 assert.ok(route.indexOf("await rooms(req)")<route.indexOf("summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms })"));
 assert.equal(patchServerSource(patched),patched,"the startup patch must remain idempotent");
});

test("country route health distinguishes healthy, partial, unavailable and thin feeds",()=>{
 const {summarizeCountryRouteHealth}=require("../src/services/country-route-health.cjs");
 const ten=Array.from({length:10},(_,i)=>({id:"chaturbate:"+i,platform:"chaturbate",country:"US"}));
 const healthy=summarizeCountryRouteHealth({providerHealth:{chaturbate:"available",bongacams:"available"},rooms:ten});
 assert.equal(healthy.feedHealth,"healthy");assert.equal(healthy.roomCount,10);assert.equal(healthy.qualifyingRoomCount,10);assert.equal(healthy.indexable,true);
 const partial=summarizeCountryRouteHealth({providerHealth:{chaturbate:"available",bongacams:"unavailable"},rooms:ten});
 assert.equal(partial.feedHealth,"partial");assert.equal(partial.indexable,true);
 const unavailable=summarizeCountryRouteHealth({providerHealth:{chaturbate:"unavailable",bongacams:"unavailable"},rooms:[]});
 assert.equal(unavailable.feedHealth,"unavailable");assert.equal(unavailable.indexable,false);
 const disabled=summarizeCountryRouteHealth({providerHealth:{chaturbate:"available",bongacams:"disabled"},rooms:ten});
 assert.equal(disabled.feedHealth,"healthy");
 const thin=summarizeCountryRouteHealth({providerHealth:{chaturbate:"available",bongacams:"disabled"},rooms:ten.slice(0,9)});
 assert.equal(thin.feedHealth,"healthy");assert.equal(thin.indexable,false);assert.equal(thin.qualifyingRoomCount,9);
});

test("Chaturbate country fallback accepts only an explicit recognized country at the end of location",()=>{
 assert.equal(resolveChaturbateCountry("GB","Paris, France"),"GB","a valid country field takes precedence");
 assert.equal(resolveChaturbateCountry("","London, United Kingdom"),"GB");
 assert.equal(resolveChaturbateCountry("","Paris, France"),"FR");
 assert.equal(resolveChaturbateCountry("","Paris; France"),"FR");
 assert.equal(resolveChaturbateCountry("","Paris | France"),"FR");
 assert.equal(resolveChaturbateCountry("","Paris; Ile-de-France; France"),"FR");
 assert.equal(resolveChaturbateCountry("","Paris, France | Europe"),"");
 assert.equal(resolveChaturbateCountry("","New York, NY, United States"),"US");
 assert.equal(resolveChaturbateCountry("","Berlin, DE"),"DE");
 assert.equal(resolveChaturbateCountry("","Kenya"),"KE");
 assert.equal(resolveChaturbateCountry("","Nairobi"),"");
 assert.equal(resolveChaturbateCountry("","Springfield, Unknownland"),"");
 assert.equal(resolveChaturbateCountry("","Paris, France, Europe"),"");
 assert.equal(resolveChaturbateCountry("","Paris, France (near centre)"),"");
 assert.equal(resolveChaturbateCountry("",""),"");
 assert.equal(resolveChaturbateCountry("","London, NY"),"");
 assert.equal(resolveChaturbateCountry("","Paris, France".split(",")),"");
});
test("country startup patch uses strict Chaturbate country fallback and remains idempotent",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const patched=patchServerSource(source);
 assert.ok(patched.includes('resolveChaturbateCountry(room.country,room.location)'));
 assert.ok(patched.includes('const { resolveChaturbateCountry, normalizeRegion'));
 assert.ok(patched.includes('const { normalizeBongaCountry } = require("./src/services/bonga-country-normalizer.cjs");'));
 assert.ok(patched.includes('const country=normalizeBongaCountry(room);'));
 assert.ok(patched.includes('createFeedSnapshotCache'));
 assert.ok(patched.includes('room_feed_snapshots'));
 assert.ok(patched.includes('cacheable:results[0].status!=="rejected"'));
 assert.ok(patched.includes('createHash("sha256")'));
 assert.equal(patchServerSource(patched),patched);
});

test("HTML sitemap lists real discovery pages and only countries meeting the ten-room threshold",()=>{
 const {buildHtmlSitemap}=require("../src/services/country-directory.cjs");
 const rooms=[
  ...Array.from({length:10},(_,i)=>({id:"us:"+i,platform:"chaturbate",country:"US"})),
  ...Array.from({length:9},(_,i)=>({id:"gb:"+i,platform:"bongacams",country:"GB"}))
 ];
 const html=buildHtmlSitemap("https://nightcamfinds.com",rooms,[
  {slug:"us",code:"US",name:"United States"},
  {slug:"gb",code:"GB",name:"United Kingdom"}
 ]);
 assert.ok(html.includes("<title>Site Map | NightCamFinds</title>"));
 assert.ok(html.includes('href="/male/">Male models'));
 assert.ok(html.includes('href="/country/us/">United States'));
 assert.ok(!html.includes('href="/country/gb/">'));
 assert.ok(html.includes("at least 10 distinct valid live rooms"));
 assert.ok(!html.includes("/guides/"));
});
test("country startup patch adds the HTML sitemap and keeps runtime robots exclusions synchronized",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const patched=patchServerSource(source);
 assert.ok(patched.includes("buildHtmlSitemap"));
 assert.match(patched,/pathname === "\/sitemap\/"/);
 assert.ok(patched.includes("Disallow: /dashboard.html"));
 assert.ok(patched.includes("Disallow: /promotools.html"));
 assert.equal(patchServerSource(patched),patched);
});
test("checked-in sitemap fallback excludes nonexistent guide URLs and advertises the HTML sitemap",()=>{
 const xml=fs.readFileSync(path.join(__dirname,"..","public","sitemap.xml"),"utf8");
 assert.ok(xml.includes("https://nightcamfinds.com/sitemap/"));
 assert.ok(!xml.includes("/guides/"));
});

test("homepage discovery footer links to the HTML sitemap",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
 assert.ok(html.includes('<a href="/sitemap/">Site map</a>'));
});


test("static public SEO assets use unique canonical sitemap URLs and protect private routes",()=>{
 const root=path.join(__dirname,"..");
 const sitemap=fs.readFileSync(path.join(root,"public","sitemap.xml"),"utf8");
 const robots=fs.readFileSync(path.join(root,"public","robots.txt"),"utf8");
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 assert.ok(urls.length>0,"static sitemap fallback must contain public URLs");
 assert.equal(new Set(urls).size,urls.length,"static sitemap URLs must be unique");
 for(const url of urls){
  assert.match(url,/^https:\/\/nightcamfinds\.com\//,"sitemap URLs must use the canonical HTTPS origin");
  assert.doesNotMatch(url,/\/(go|bgo|api)\//,"affiliate redirects and APIs must not be indexed");
 }
 assert.ok(urls.includes("https://nightcamfinds.com/"));
 assert.ok(urls.includes("https://nightcamfinds.com/sitemap/"));
 const directives=robots.split(/\r?\n/).filter(line=>/^Disallow:/.test(line));
 assert.equal(new Set(directives).size,directives.length,"robots exclusions must not be duplicated");
 for(const route of ["/admin.html","/dashboard.html","/dashboard-v2.html","/dashboard-ui.html","/analytics-dashboard.html","/campaign-center.html","/promotools.html","/revenue.html","/go/","/bgo/","/api/"]){
  assert.ok(directives.includes("Disallow: "+route),"missing private or non-indexable route exclusion: "+route);
 }
 assert.match(robots,/^Sitemap: https:\/\/nightcamfinds\.com\/sitemap\.xml$/m);
});


test("XML sitemap contains curated discovery and trust pages, not unverified thin routes",()=>{
 const xml=buildCountrySitemap("https://nightcamfinds.com",[],[]);
 for(const path of ["/","/female/","/male/","/trans/","/couples/","/hd/","/new/","/countries/","/sitemap/","/about","/affiliate-disclosure","/privacy","/terms","/contact"]){
  assert.ok(xml.includes("<loc>https://nightcamfinds.com"+path+"</loc>"),"missing curated sitemap path "+path);
 }
 for(const path of ["/live/","/popular/","/broadcast"]){
  assert.ok(!xml.includes("<loc>https://nightcamfinds.com"+path+"</loc>"),"unverified route must stay out of XML sitemap: "+path);
 }
});

test("country sitemap rejects malformed or mismatched country slugs",()=>{
 const rooms=Array.from({length:10},(_,i)=>({id:"us:"+i,platform:"chaturbate",country:"US"}));
 const xml=buildCountrySitemap("https://nightcamfinds.com",rooms,[
  {slug:"us",code:"US"},{slug:"gb",code:"US"},{slug:"../us",code:"US"}
 ]);
 assert.match(xml,/\/country\/us\//);
 assert.doesNotMatch(xml,/\/country\/gb\//);
 assert.doesNotMatch(xml,/\.\.\/us/);
});

test("priority country pages retain distinct hand-written content and self canonicals",()=>{
 const intros=MARKET_PRIORITY_CODES.map(code=>{
  const slug=code.toLowerCase();
  const country=COUNTRIES[slug];
  assert.ok(country&&country.intro&&country.paragraphs&&country.paragraphs.length>=3&&country.faqs&&country.faqs.length>=3,slug+" must retain dedicated country content");
  const html=getCountryPage(slug,"https://preview.example.test","",true);
  assert.ok(html.includes('rel="canonical" href="https://nightcamfinds.com/country/'+slug+'/"'),slug+" canonical must remain self-referencing");
  assert.ok(html.includes('property="og:url" content="https://nightcamfinds.com/country/'+slug+'/"'),slug+" Open Graph URL must remain self-referencing");
  assert.ok(!html.includes("preview.example.test"));
  return country.intro;
 });
 assert.equal(new Set(intros).size,MARKET_PRIORITY_CODES.length,"priority-market introductions must remain distinct");
});

test("static fallback sitemap matches the curated discovery set",()=>{
 const sitemap=fs.readFileSync(path.join(__dirname,"..","public","sitemap.xml"),"utf8");
 assert.match(sitemap,/https:\/\/nightcamfinds\.com\/female\//);
 assert.match(sitemap,/https:\/\/nightcamfinds\.com\/countries\//);
 for(const path of ["/live/","/popular/","/broadcast"]){
  assert.ok(!sitemap.includes("https://nightcamfinds.com"+path),"static fallback must omit "+path);
 }
});


test("country route passes only currently indexable markets into related links",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","scripts","patch-country-directory.js"),"utf8");
 assert.match(source,/const eligibleCountrySlugs = Object\.entries\(COUNTRIES\)\.filter\(\(\[slug, country\]\) => isIndexableCountryRooms\(feed\.rooms\.filter\(\(room\) => room\.country === country\.code\)\)\)\.map\(\(\[slug\]\) => slug\);/);
 assert.match(source,/getCountryPage\(countryRoute\[1\], pageOrigin\(req\), roomMarkup, routeHealth\.indexable, eligibleCountrySlugs\)/);
});
