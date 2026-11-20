"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../public/index.html"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../public/styles.css"),"utf8");
const loyalty=fs.readFileSync(path.join(__dirname,"../public/loyalty.js"),"utf8");
test("homepage keeps the live directory first and does not render the removed loyalty panel",()=>{assert.match(html,/class="directory-section"/);assert.doesNotMatch(html,/id="favorite-rooms"|id="recent-rooms"|id="share-site"/);assert.equal(html.includes('src="/loyalty.js" defer'),false);});
test("favorites and recently viewed are local and bounded",()=>{assert.match(loyalty,/ncf_favorites_v1/);assert.match(loyalty,/ncf_recent_v1/);assert.match(loyalty,/MAX_FAVORITES = 24/);assert.match(loyalty,/MAX_RECENT = 8/);assert.match(loyalty,/localStorage\.setItem/);});
test("saved room links use the correct partner redirect and sharing is supported",()=>{assert.match(loyalty,/room.platform==="bongacams"\?"\/bgo\/":"\/go\//);assert.match(loyalty,/sponsored nofollow noopener/);assert.match(loyalty,/navigator.share/);});
test("loyalty controls are keyboard-operable and responsive",()=>{assert.match(loyalty,/button.type="button"/);assert.match(css,/\.favorite-toggle/);assert.match(css,/@media\(max-width:640px\)/);});