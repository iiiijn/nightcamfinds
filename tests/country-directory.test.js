"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {normalizeCountryCode,normalizeRegion,normalizeLanguages,isIndexableCountryRoomCount,buildCountrySitemap}=require("../src/services/country-directory.cjs");
const {patchServerSource}=require("../scripts/patch-country-directory.js");
test("country values normalize ISO codes and explicit country names only",()=>{
 assert.equal(normalizeCountryCode(" gb "),"GB");assert.equal(normalizeCountryCode("United States"),"US");
 assert.equal(normalizeCountryCode("The Netherlands"),"NL");assert.equal(normalizeCountryCode("Nairobi"),"");assert.equal(normalizeCountryCode(""),"");
});
test("region and language values normalize without inferring residence from language",()=>{
 assert.equal(normalizeRegion("  Bavaria  "),"Bavaria");assert.equal(normalizeLanguages(["English","German","English"]),"English, German");
 assert.equal(normalizeLanguages({name:"French"}),"French");assert.equal(normalizeRegion(""),"");
});
test("ten matching feed rooms are required for country-page indexing",()=>{
 assert.equal(isIndexableCountryRoomCount(9),false);assert.equal(isIndexableCountryRoomCount(10),true);
 assert.equal(isIndexableCountryRoomCount("10"),true);assert.equal(isIndexableCountryRoomCount("unknown"),false);
});
test("sitemap excludes thin and unknown country pages and includes lastmod",()=>{
 const rooms=[...Array.from({length:10},()=>({country:"US"})),...Array.from({length:9},()=>({country:"GB"})),...Array.from({length:12},()=>({country:"Germany"}))];
 const xml=buildCountrySitemap("https://nightcamfinds.com",rooms,[{slug:"us",code:"US"},{slug:"gb",code:"GB"},{slug:"de",code:"DE"}],"2026-11-05T20:00:00Z");
 assert.match(xml,/\/country\/us\//);assert.doesNotMatch(xml,/\/country\/gb\//);assert.match(xml,/\/country\/de\//);
 assert.equal((xml.match(/<lastmod>/g)||[]).length,(xml.match(/<url>/g)||[]).length);
});
test("server country patch removes early duplicate handler and adds threshold, feed facets and dynamic sitemap",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const patched=patchServerSource(source);
 assert.ok(patched.includes("NIGHTCAMFINDS_COUNTRY_DIRECTORY_V1"));
 assert.ok(!patched.includes("const countryMatch = pathname.match("));
 assert.ok(patched.includes("isIndexableCountryRoomCount(countryRooms.length)"));
 assert.ok(patched.includes("buildCountrySitemap"));
 assert.ok(patched.includes("normalizeLanguages(room.spoken_languages"));
 assert.ok(patched.includes("url.searchParams.get(\"region\")"));
 assert.equal(patchServerSource(patched),patched);
});
