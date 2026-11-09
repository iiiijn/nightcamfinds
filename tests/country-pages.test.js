"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { COUNTRIES, getCountryPage } = require("../country-pages");

const slugs = ["us", "gb", "ca", "au", "de", "fr", "nl", "no", "ch", "is", "lu", "cz", "ae", "za", "br", "md"];

function introWords(html) {
  const match = html.match(/<header class="country-intro">([\s\S]*?)<\/header>/i);
  assert.ok(match, "country intro should be present");
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
}

test("all priority country pages render distinct content and canonical URLs", () => {
  const pages = slugs.map((slug) => getCountryPage(slug));
  assert.equal(pages.length, 16);
  assert.ok(pages.every(Boolean));
  assert.equal(new Set(pages).size, 16);

  for (const slug of slugs) {
    const html = getCountryPage(slug);
    const country = COUNTRIES[slug];
    assert.match(html, new RegExp("<h1>" + country.name + " Live Cams</h1>"));
    assert.match(html, new RegExp('rel="canonical" href="https://nightcamfinds\\.com/country/' + slug + '/"'));
    assert.match(html, /aria-label="Breadcrumb"/);
    assert.ok(html.includes(`<a href="/">Home</a>`));
    assert.match(html, /Frequently asked questions/);
    assert.equal((html.match(/<section class="country-faq-item">/g) || []).length, 3);
    assert.match(html, /href="\/female\/"/);
    assert.match(html, /href="\/live\/"/);
    const words = introWords(html);
    assert.ok(words >= 150 && words <= 300, slug + " main country copy has " + words + " words");
  }
});

test("unknown country slugs do not create a country page", () => {
  assert.equal(getCountryPage("xx"), null);
  assert.equal(getCountryPage(""), null);
});

test("country page output escapes an untrusted origin value", () => {
  const html = getCountryPage("us", 'https://nightcamfinds.com/" onmouseover="alert(1)');
  assert.ok(!html.includes('href="https://nightcamfinds.com/" onmouseover='));
});

test("country pages index only when server-rendered rooms are available", () => {
  const populated = getCountryPage("us", "https://nightcamfinds.com", '<a class="card" href="/go/example">Room</a>', true);
  const empty = getCountryPage("us", "https://nightcamfinds.com", '<p class="empty-state">No live rooms</p>', false);
  assert.match(populated, /<meta name="robots" content="index,follow">/);
  assert.match(populated, /country-live-rooms/);
  assert.match(populated, /href="\/go\/example"/);
  assert.match(empty, /<meta name="robots" content="noindex,follow">/);
});

test("new market pages render unique metadata and preserve noindex until enough rooms exist",()=>{
 for(const slug of ["is","lu","cz","ae","za","br","md"]){
  const country=COUNTRIES[slug];
  assert.ok(country,slug+" config should exist");
  assert.ok(country.regionGroup);
  assert.ok(country.priority);
  const html=getCountryPage(slug,"https://nightcamfinds.com","",false);
  assert.match(html,new RegExp("<h1>"+country.name+" Live Cams</h1>"));
  assert.match(html,/content="noindex,follow"/);
  assert.match(html,new RegExp("More "+country.regionGroup+" markets"));
 }
});

test("all 18 Tier 1 pages have distinct SEO titles and descriptions", () => {
  const tierOne = require("../src/config/market-countries.cjs").MARKET_PRIORITY_CODES.map((code) => code.toLowerCase());
  const titles = [];
  const descriptions = [];
  for (const slug of tierOne) {
    const country = COUNTRIES[slug];
    const html = getCountryPage(slug, "https://nightcamfinds.com", "", false);
    assert.ok(country.seoTitle, slug + " should define an SEO title");
    assert.ok(country.metaDescription, slug + " should define a meta description");
    titles.push(country.seoTitle);
    descriptions.push(country.metaDescription);
    assert.ok(html.includes("<title>" + country.seoTitle + "</title>"));
    const escapedDescription = country.metaDescription.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    assert.ok(html.includes('name="description" content="' + escapedDescription + '"'));
  }
  assert.equal(new Set(titles).size, 18);
  assert.equal(new Set(descriptions).size, 18);
});

test("country landing pages create privacy-conscious engagement and preserve landing attribution on partner links", () => {
  const html = getCountryPage("is", "https://nightcamfinds.com", '<a href="/go/chaturbate:sample">Room</a>', true);
  assert.match(html, /sessionStorage\.getItem\("ncf_visit_id"\)/);
  assert.match(html, /sendEngagement\("active_10s"\)/);
  assert.match(html, /sendEngagement\("scroll_50"\)/);
  assert.match(html, /fetch\("\/api\/engage"/);
  assert.match(html, /landingPath,\s*platform: "directory"/);
  assert.match(html, /trackParams/);
  assert.match(html, /vid: visitId/);
  assert.match(html, /lp: landingPath\.slice\(0, 255\)/);
  assert.match(html, /const placement = "country-" \+ countrySlug/);
});
