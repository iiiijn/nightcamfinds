"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

test("Chaturbate feed requests bounded regional pages and deduplicates partner results", () => {
  assert.match(server, /fetchPagedResults/);
  assert.match(server, /CHATURBATE_PAGE_SIZE = 500/);
  assert.match(server, /CHATURBATE_MAX_PAGES/);
  assert.match(server, /CHATURBATE_REGION_MAX_PAGES/);
  assert.match(server, /&limit=\$\{limit\}&offset=\$\{offset\}&region=\$\{encodeURIComponent\(apiRegion\)\}/);
  assert.match(server, /CHATURBATE_API_REGIONS\.map\(apiRegion=>fetchChaturbateRegion/);
  assert.match(server, /room&&room\.username/);
});

test("Bonga feed retains its known API limit until account-specific settings are verified", () => {
  assert.match(server, /BONGACAMS_LIMIT \|\| 100/);
  assert.match(server, /Math\.min\(500/);
});

test("provider-supplied tags are normalized, safety-screened, counted and filterable", () => {
  assert.match(server, /tags:normalizeTags\(room\.tags\)/);
  assert.match(server, /tags:tags\.map\(tag=>tag\.slice\(0,40\)\)/);
  assert.match(server, /normalizeTags\(room\.tags\)/);
  assert.match(server, /const popularTags=\[\.\.\.tagCounts\.entries\(\)\]/);
  assert.match(server, /if\(tag\)list=list\.filter/);
  assert.match(server, /popularTags,liveCount:list\.length/);
  assert.match(server, /rawText:\[room\.username,room\.display_name,room\.room_subject,\.\.\.normalizeTags\(room\.tags\)\]/);
  assert.match(app, /params\.set\("tag", selectedTag\)/);
  assert.match(html, /id="popular-tags"/);
});

test("rooms API supports bounded pagination and reports remaining results", () => {
  assert.match(server, /url\.searchParams\.get\("offset"\)/);
  assert.match(server, /url\.searchParams\.get\("limit"\)/);
  assert.match(server, /hasMore:offset\+page\.length<list\.length/);
});

test("all room categories receive regional top-room groups from the filtered feed", () => {
  assert.match(server, /buildRegionalRoomGroups\(list,sort,8\)/);
  assert.match(server, /regionalRooms,topChaturbateByCategory,topBongaByCategory,liveCount:list.length/);
  assert.match(app, /renderRegionalSections\(data\.regionalRooms/);
  assert.match(app, /\["all","live","female","male","trans","couples","hd","new","popular"\]\.includes\(category\)/);
});

test("region and language selectors are backed by server-side filtering and options", () => {
  assert.match(server, /if\(region\)list=list\.filter/);
  assert.match(server, /if\(language\)list=list\.filter/);
  assert.match(server, /regions,languages,notice/);
  assert.match(app, /params\.set\("region",\s*regionSelect\.value\)/);
  assert.match(app, /params\.set\("language",\s*languageSelect\.value\)/);
});

test("directory UI exposes a working load-more control for additional room pages", () => {
  assert.match(html, /id="load-more"/);
  assert.match(app, /loadMoreButton\?\.addEventListener\("click"/);
  assert.match(app, /load\(currentOffset, true\)/);
  assert.match(app, /grid\.append/);
});

test("homepage global category picks are sourced from each partner feed and ranked by viewers", () => {
  assert.match(server, /topChaturbateByCategory\[gender\] = feed\.rooms[\s\S]*?room\.platform === "chaturbate" && room\.gender === gender/);
  assert.match(server, /topBongaByCategory\[gender\] = feed\.rooms[\s\S]*?room\.platform === "bongacams" && room\.gender === gender/);
  assert.match(server, /Number\(roomB\.viewerCount \|\| 0\) - Number\(roomA\.viewerCount \|\| 0\)/);
  assert.match(server, /topChaturbateByCategory,topBongaByCategory,liveCount:list\.length/);
  assert.match(app, /Popular " \+ platformLabel \+ " " \+ label \+ " Rooms/);
  assert.match(app, /window\.__ncfTopBongaByCategory = data\.topBongaByCategory \|\| \{\}/);
});

test("homepage is global by default while explicit country landing pages retain their country filter", () => {
  assert.match(app, /if \(!countrySelect\.value && forced && \(data\.countries \|\| \[\]\)\.includes\(forced\)\)/);
  assert.doesNotMatch(app, /if \(!countrySelect\.value && \(forced \|\| hinted\)/);
});

test("global Chaturbate category links use supported platform filtering and preserve viewer sorting", () => {
  assert.match(app, /more\.href = "\/" \+ gender \+ "\/\?ncf_platform=" \+ platformKey \+ "&sort=viewers"/);
  assert.match(app, /const campaignPlatform = \["chaturbate", "bongacams"\]/);
  assert.match(app, /if \(category === "popular" \|\| queryParams\.get\("sort"\) === "viewers"\) sort\.value = "viewers"/);
});

test("URL query parameters are initialized before their first use during directory startup", () => {
  const declaration = app.indexOf("const queryParams = new URLSearchParams(location.search);");
  const firstUse = app.indexOf("queryParams.get(");
  assert.notEqual(declaration, -1);
  assert.notEqual(firstUse, -1);
  assert.ok(declaration < firstUse, "queryParams must be initialized before any query string is read");
  assert.equal(app.split("const queryParams = new URLSearchParams(location.search);").length - 1, 1);
});
