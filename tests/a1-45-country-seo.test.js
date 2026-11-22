"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { COUNTRIES, getCountryPage } = require("../country-pages.js");
const { MARKET_PRIORITY_CODES, TIER1_SEO } = require("../src/config/market-countries.cjs");
const { isIndexableCountryRooms, buildCountrySitemap } = require("../src/services/country-directory.cjs");

test("all 18 Tier 1 markets have concise, unique search descriptions", () => {
  const descriptions = MARKET_PRIORITY_CODES.map((code) => {
    const slug = code.toLowerCase();
    const description = TIER1_SEO[slug]?.metaDescription;
    assert.equal(typeof description, "string", slug + " must have a meta description");
    assert.ok(description.length >= 70 && description.length <= 160, slug + " description length: " + description.length);
    const marketLabel = ({ gb: "UK", de: "Deutschland" })[slug] || COUNTRIES[slug].name.split(" ")[0];
    assert.ok(description.toLowerCase().includes(marketLabel.toLowerCase()), slug + " description should identify its market");
    return description;
  });
  assert.equal(new Set(descriptions).size, MARKET_PRIORITY_CODES.length, "Tier 1 descriptions must not be duplicated");
});

test("Tier 1 rendered pages retain their own self-referencing production canonicals", () => {
  for (const code of MARKET_PRIORITY_CODES) {
    const slug = code.toLowerCase();
    const html = getCountryPage(slug, "https://preview.example.test", "", true);
    assert.ok(html.includes('content="index,follow"'), slug + " should be indexable when the server confirms adequate rooms");
    assert.ok(html.includes('rel="canonical" href="https://nightcamfinds.com/country/' + slug + '/"'), slug + " canonical mismatch");
    assert.ok(html.includes('property="og:url" content="https://nightcamfinds.com/country/' + slug + '/"'), slug + " Open Graph URL mismatch");
    assert.doesNotMatch(html, /preview\.example\.test/);
  }
});

test("country pages without adequate live-room supply stay out of the index and sitemap", () => {
  const nineRooms = Array.from({ length: 9 }, (_, index) => ({
    id: "gb:" + index,
    platform: "chaturbate",
    country: "GB"
  }));
  const tenRooms = Array.from({ length: 10 }, (_, index) => ({
    id: "us:" + index,
    platform: "chaturbate",
    country: "US"
  }));
  assert.equal(isIndexableCountryRooms(nineRooms), false);
  assert.equal(isIndexableCountryRooms(tenRooms), true);
  const xml = buildCountrySitemap("https://nightcamfinds.com", [...nineRooms, ...tenRooms], [
    { slug: "gb", code: "GB" },
    { slug: "us", code: "US" }
  ]);
  assert.doesNotMatch(xml, /\/country\/gb\//);
  assert.match(xml, /\/country\/us\//);
  assert.match(getCountryPage("gb", "https://nightcamfinds.com", "", false), /<meta name="robots" content="noindex,follow">/);
});


test("Tier 1 country pages link to other priority markets in the same region", () => {
  const ukHtml = getCountryPage("gb", "https://preview.example.test", "", true);
  assert.match(ukHtml, /Explore other Europe markets/);
  assert.match(ukHtml, /href="\/country\/de\/">Germany live cams/);
  assert.match(ukHtml, /href="\/country\/fr\/">France live cams/);
  assert.doesNotMatch(ukHtml, /href="\/country\/gb\/">/);
  assert.doesNotMatch(ukHtml, /href="\/country\/ca\/">Canada live cams/);

  const usHtml = getCountryPage("us", "https://preview.example.test", "", true);
  assert.match(usHtml, /Explore other North America markets/);
  assert.match(usHtml, /href="\/country\/ca\/">Canada live cams/);
  assert.doesNotMatch(usHtml, /href="\/country\/us\/">/);
});

test("regional discovery links do not change canonical or low-inventory noindex behavior", () => {
  const noRooms = getCountryPage("gb", "https://nightcamfinds.com", "", false);
  assert.match(noRooms, /<meta name="robots" content="noindex,follow">/);
  assert.match(noRooms, /rel="canonical" href="https:\/\/nightcamfinds\.com\/country\/gb\/">/);
  assert.match(noRooms, /href="\/country\/de\/">Germany live cams/);
});
