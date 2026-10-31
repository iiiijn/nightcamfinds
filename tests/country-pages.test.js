"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { COUNTRIES, getCountryPage } = require("../country-pages");

const slugs = ["us", "gb", "ca", "au", "de", "fr", "nl"];

function introWords(html) {
  const match = html.match(/<header class="country-intro">([\\s\\S]*?)<\\/header>/i);
  assert.ok(match, "country intro should be present");
  return match[1].replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().split(" ").length;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

test("all priority country pages render distinct content and canonical URLs", () => {
  const pages = slugs.map((slug) => getCountryPage(slug));
  assert.equal(pages.length, 7);
  assert.ok(pages.every(Boolean));
  assert.equal(new Set(pages).size, 7);

  for (const slug of slugs) {
    const html = getCountryPage(slug);
    const country = COUNTRIES[slug];
    assert.match(html, new RegExp("<h1>" + country.name + " Live Cams</h1>"));
    assert.match(html, new RegExp('rel="canonical" href="https://nightcamfinds\\.com/country/' + slug + '/"'));
    assert.match(html, /aria-label="Breadcrumb"/);
    assert.match(html, /<a href="/">Home<\/a>/);
    assert.match(html, /Frequently asked questions/);
    assert.equal((html.match(/<section class="country-faq-item">/g) || []).length, 3);
    assert.match(html, /href="\/female\/"/);
    assert.match(html, /href="\/live\/"/);
    const words = visibleText(html).split(/\s+/).length;
    assert.ok(words >= 150 && words <= 300, slug + " page has " + words + " visible words");
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
