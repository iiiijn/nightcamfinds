"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {normalizeCountryCode,normalizeRegion,normalizeLanguages,isValidCountryRoom,isIndexableCountryRooms,buildCountrySitemap}=require("../src/services/country-directory.cjs");
const {patchServerSource}=require("../scripts/patch-country-directory.js");
const {COUNTRIES}=require("../country-pages.js");
const {MARKET_META,MARKET_PRIORITY_CODES,REGION_GROUPS}=require("../src/config/market-countries.cjs");
test("country values normalize ISO codes and explicit country names only",()=>{
 assert.equal(normalizeCountryCode(" gb "),"GB");assert.equal(normalizeCountryCode("United States"),"US");
 assert.equal(normalizeCountryCode("The Netherlands"),"NL");assert.equal(normalizeCountryCode("Nairobi"),"");assert.equal(normalizeCountryCode(""),"");
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
test("server patch preserves region and language discovery facets in the rooms API",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");const patched=patchServerSource(source);
 assert.match(patched,/const regions=\[\.\.\.new Set\(feed\.rooms\.map\(r=>r\.region\|\|regionFor\(r\.country\)\)\)\]\.sort\(\)/);
 assert.match(patched,/const languages=\[\.\.\.new Set\(feed\.rooms\.flatMap/);
 assert.match(patched,/rooms:page,liveCount:list\.length,offset,limit,hasMore:offset\+page\.length<list\.length,countries,platforms,regions,languages,notice:feed\.notice/);
 assert.match(patched,/url\.searchParams\.get\("summary"\)\s*===\s*"1"/);
});
test("server patch uses room-quality checks and does not invent sitemap modification dates",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");const patched=patchServerSource(source);
 assert.ok(patched.includes("NIGHTCAMFINDS_COUNTRY_DIRECTORY_V1"));
 assert.ok(!patched.includes("const countryMatch = pathname.match("));
 assert.ok(patched.includes("isIndexableCountryRooms(countryRooms)"));
 assert.ok(patched.includes("buildCountrySitemap"));
 assert.ok(patched.includes("normalizeLanguages(room.spoken_languages"));
 assert.ok(patched.includes('url.searchParams.get("region")'));
 assert.ok(!patched.includes("new Date().toISOString());"));
 assert.equal(patchServerSource(patched),patched);
});

test("all worldwide market landing pages have unique slugs, ISO codes, region groups and priorities",()=>{
 const entries=Object.entries(COUNTRIES);
 assert.equal(entries.length,56,"the worldwide directory should contain all 56 requested countries");
 const slugs=entries.map(([slug])=>slug);
 const codes=entries.map(([,country])=>country.code);
 assert.equal(new Set(slugs).size,56,"market slugs must be unique");
 assert.equal(new Set(codes).size,56,"market country codes must be unique");
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
 assert.equal(new Set(grouped).size,56);
 assert.equal(grouped.length,56);
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
