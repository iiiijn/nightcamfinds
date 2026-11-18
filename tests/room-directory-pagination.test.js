"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
const loyalty = fs.readFileSync(path.join(__dirname, "../public/loyalty.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");

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
  assert.match(server, /tags:normalizeTags\(room\.tags\)\.map/);
  assert.match(server, /tags:tags\.map\(tag=>tag\.slice\(0,40\)\)/);
  assert.match(server, /normalizeTags\(room\.tags\)/);
  assert.match(server, /const popularTags=\[\.\.\.tagCounts\.entries\(\)\]/);
  assert.match(server, /if\(tag\)list=list\.filter/);
  assert.match(server, /notice:feed\.notice,popularTags/);
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

test("rooms API supports room-size filters with stable viewer-count bands", () => {
  assert.match(server, /roomSize=\(url\.searchParams\.get\("roomSize"\)/);
  assert.match(server, /roomSize==="intimate"\)list=list\.filter\(r=>Number\(r\.viewerCount\|\|0\)<=50\)/);
  assert.match(server, /roomSize==="mid-sized"\)list=list\.filter\(r=>Number\(r\.viewerCount\|\|0\)>50&&Number\(r\.viewerCount\|\|0\)<=500\)/);
  assert.match(server, /roomSize==="high-traffic"\)list=list\.filter\(r=>Number\(r\.viewerCount\|\|0\)>500\)/);
  assert.match(app, /params\.set\("roomSize", roomSizeSelect\.value\)/);
  assert.match(html, /id="room-size"/);
});
test("homepage uses one sidebar for broadcaster signup, regions, room size and tags", () => {
  assert.match(html, /class="broadcaster-sidebar"/);
  assert.match(html, /id="region"/);
  assert.match(html, /id="room-size"/);
  assert.match(html, /id="popular-tags"/);
  assert.doesNotMatch(html, /id="quick"/);
  assert.doesNotMatch(html, /id="country-hint"/);
  assert.doesNotMatch(html, /href="\/countries\/">Countries/);
});
test("room cards do not render save or favorite star controls", () => {
  assert.doesNotMatch(loyalty, /favorite-toggle|☆ Save|★ Saved/);
});


test("A1.25 mobile header keeps search, country, language and quick exit in a compact grid", () => {
  assert.match(css, /grid-template-areas:[\s\S]*"brand age age"[\s\S]*"search search search"[\s\S]*"country language exit"/);
  assert.match(css, /\.header-tools \{ display: contents; \}/);
  assert.match(css, /\.category-nav[\s\S]*overscroll-behavior-x: contain/);
  assert.match(html, /id="q"/);
  assert.match(html, /id="country"/);
  assert.match(html, /id="language"/);
  assert.match(html, /id="quick-exit"/);
});
test("A1.25 desktop room cards use five columns on wide screens and four on medium screens", () => {
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 901px\) and \(max-width: 1199px\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("A1.25 language selector is inside the responsive topbar grid", () => {
  const topbar = html.indexOf('<div class="topbar">');
  const language = html.indexOf('id="language"');
  const topbarEnd = html.indexOf('</div>', html.indexOf('id="quick-exit"'));
  assert.ok(topbar >= 0 && language > topbar && language < topbarEnd, "language selector must be a topbar grid item");
});


test("A1.26 desktop discovery cards retain readable four-column sizing until wide displays", () => {
  assert.match(css, /@media \(min-width: 901px\) and \(max-width: 1439px\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.directory-main \.category-row \.card[\s\S]*flex: 0 0 clamp\(170px, 19vw, 205px\)/);
});

test("A1.26 room-card metadata wraps instead of clipping on narrow screens", () => {
  assert.match(css, /\.directory-main \.card \.badges[\s\S]*flex-wrap: wrap/);
  assert.match(css, /\.directory-main \.card \.badge[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.directory-main \.card \.meta > strong[\s\S]*word-break: break-word/);
});

test("A1.26 mobile room rails remain horizontally scrollable without forcing page overflow", () => {
  assert.match(css, /\.directory-main \.category-row[\s\S]*overflow-x: auto/);
  assert.match(css, /overscroll-behavior-x: contain/);
  assert.match(css, /flex: 0 0 min\(72vw, 230px\)/);
});


test("A1.26.1 mobile room-card badge rows wrap within the card content width", () => {
  assert.match(css, /\.directory-main \.card \.badges[\s\S]*flex-flow: row wrap/);
  assert.match(css, /\.directory-main \.card \.badges[\s\S]*width: 100%/);
  assert.match(css, /\.directory-main \.card \.badge[\s\S]*flex: 0 1 auto/);
  assert.match(css, /\.directory-main \.card \.badge[\s\S]*max-width: 100%/);
});

test("A1.26.1 viewer-count badges and room names cannot exceed mobile card width", () => {
  assert.match(css, /\.directory-main \.card \.meta[\s\S]*overflow: hidden/);
  assert.match(css, /\.directory-main \.card \.subject[\s\S]*max-width: 100%/);
  assert.match(css, /\.directory-main \.card \.meta > strong[\s\S]*word-break: break-word/);
});
