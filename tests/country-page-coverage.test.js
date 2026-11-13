"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { COUNTRIES, getCountryPage } = require("../country-pages");

const expectedCountries = Object.entries(COUNTRIES).map(([slug, country]) => [slug, country.code]);

function introWordCount(html) {
  const match = html.match(/<header class="country-intro">([\s\S]*?)<\/header>/i);
  assert.ok(match, "country-specific introduction should be present");
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
}

test("all 56 supported country pages render distinct, substantive content", () => {
  assert.deepEqual(
    expectedCountries.map(([slug]) => slug).sort(),
    Object.keys(COUNTRIES).sort()
  );

  const rendered = expectedCountries.map(([slug]) => getCountryPage(slug));
  assert.ok(rendered.every(Boolean));
  assert.equal(new Set(rendered).size, expectedCountries.length);

  for (const [slug, code] of expectedCountries) {
    const country = COUNTRIES[slug];
    const html = getCountryPage(slug);
    assert.equal(country.code, code);
    const expectedLanguage = country.language || ({ DE: "de", FR: "fr", NL: "nl" }[code] || "en");
    assert.match(html, new RegExp("<h1>" + country.name + " Live Cams</h1>"));
    assert.ok(html.includes('rel="canonical" href="https://nightcamfinds.com/country/' + slug + '/"'));
    assert.ok(html.includes('<html lang="' + expectedLanguage + '">'));
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /aria-label="Breadcrumb"/);
    assert.match(html, /Frequently asked questions/);
    assert.equal((html.match(/<section class="country-faq-item">/g) || []).length, 3);
    assert.match(html, /href="\/female\/"/);
    assert.match(html, /href="\/male\/"/);
    assert.match(html, /href="\/live\/"/);
    const words = introWordCount(html);
    assert.ok(words >= 150 && words <= 300, slug + " introduction has " + words + " words");
  }
});

test("country pages remain noindex until the server confirms enough valid rooms", () => {
  const populated = getCountryPage(
    "ie",
    "https://nightcamfinds.com",
    '<a class="card" href="/go/example">Room</a>',
    true
  );
  const empty = getCountryPage(
    "ie",
    "https://nightcamfinds.com",
    '<p class="empty-state">No live rooms</p>',
    false
  );
  assert.match(populated, /<meta name="robots" content="index,follow">/);
  assert.match(empty, /<meta name="robots" content="noindex,follow">/);
});

test("unknown country slugs remain unsupported", () => {
  assert.equal(getCountryPage("xx"), null);
  assert.equal(getCountryPage(""), null);
});

test("country canonical and Open Graph URLs stay pinned to the production origin", () => {
  const html = getCountryPage("ie", "https://preview.example.test");
  assert.match(html, /<link rel="canonical" href="https:\/\/nightcamfinds\.com\/country\/ie\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/nightcamfinds\.com\/country\/ie\/">/);
  assert.doesNotMatch(html, /preview\.example\.test/);
});
