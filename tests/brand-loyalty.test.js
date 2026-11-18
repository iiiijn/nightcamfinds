"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../public/index.html"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../public/styles.css"),"utf8");
const loyalty=fs.readFileSync(path.join(__dirname,"../public/loyalty.js"),"utf8");
test("loyalty UI exposes favorites, recent rooms, and share action",()=>{assert.match(html,/id="favorite-rooms"/);assert.match(html,/id="recent-rooms"/);assert.match(html,/id="share-site"/);assert.match(html,/src="\/loyalty\.js" defer/);});
test("favorites and recently viewed are local and bounded",()=>{assert.match(loyalty,/ncf_favorites_v1/);assert.match(loyalty,/ncf_recent_v1/);assert.match(loyalty,/MAX_FAVORITES = 24/);assert.match(loyalty,/MAX_RECENT = 8/);assert.match(loyalty,/localStorage\.setItem/);});
test("saved room links use the correct partner redirect and sharing is supported",()=>{assert.match(loyalty,/room.platform==="bongacams"\?"\/bgo\/":"\/go\//);assert.match(loyalty,/sponsored nofollow noopener/);assert.match(loyalty,/navigator.share/);});
test("recent-room controls are keyboard-operable and responsive without Save overlays",()=>{assert.match(loyalty,/remove.type="button"/);assert.doesNotMatch(loyalty,/favorite-toggle|☆ Save|★ Saved/);assert.match(css,/@media\(max-width:640px\)/);});