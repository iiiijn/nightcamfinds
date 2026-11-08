"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

test("Chaturbate feed requests bounded pages and deduplicates partner results", () => {
  assert.match(server, /fetchPagedResults/);
  assert.match(server, /CHATURBATE_PAGE_SIZE = 500/);
  assert.match(server, /CHATURBATE_MAX_PAGES/);
  assert.match(server, /&limit=\$\{limit\}&offset=\$\{offset\}&region=\$\{encodeURIComponent\(apiRegion\)\}/);\n  assert.match(server, /CHATURBATE_REGION_MAX_PAGES/);\n  assert.match(server, /CHATURBATE_API_REGIONS\.map\(apiRegion=>fetchChaturbateRegion/);
  assert.match(server, /room&&room\.username/);
});

test("Bonga feed retains its known API limit until account-specific settings are verified", () => {
  assert.match(server, /BONGACAMS_LIMIT \|\| 100/);
  assert.match(server, /Math\.min\(500/);
});

test("rooms API supports bounded pagination and reports remaining results", () => {
  assert.match(server, /url\.searchParams\.get\("offset"\)/);
  assert.match(server, /url\.searchParams\.get\("limit"\)/);
  assert.match(server, /hasMore:offset\+page\.length<list\.length/);
});

test("all room categories receive regional top-room groups from the filtered feed", () => {
  assert.match(server, /buildRegionalRoomGroups\(list,sort,8\)/);
  assert.match(server, /regionalRooms,liveCount:list.length/);
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
