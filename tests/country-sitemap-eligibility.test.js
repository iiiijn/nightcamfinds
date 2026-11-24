"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { countCountryContentWords, getEligibleCountrySitemapSlugs } = require("../src/services/country-sitemap-eligibility.cjs");

function content(wordCount) {
  return { name: "Sample", intro: Array(wordCount).fill("useful").join(" ") };
}

test("country sitemap includes only live Tier 1 and Tier 2 markets with adequate content", () => {
  const marketMeta = {
    us: { priority: "Tier 1" },
    de: { priority: "Tier 1" },
    pl: { priority: "Tier 2" },
    cz: { priority: "Tier 2" },
    ru: { priority: "Tier 3" }
  };
  const countryContent = {
    us: content(120), de: content(120), pl: content(120), cz: content(80), ru: content(220)
  };
  const rooms = [{ country: "US" }, { country: "PL" }, { country: "CZ" }, { country: "RU" }];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms }),
    ["pl", "ru", "us"]
  );
});

test("Tier 3 countries require stronger content and a live room", () => {
  const marketMeta = { br: { priority: "Tier 3" }, in: { priority: "Tier 3" } };
  const countryContent = { br: content(179), in: content(180) };
  const rooms = [{ country: "BR" }, { country: "IN" }];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms }),
    ["in"]
  );
});

test("empty countries and unsupported tiers are excluded", () => {
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({
      marketMeta: { au: { priority: "Tier 1" }, xx: { priority: "Tier 4" } },
      countryContent: { au: content(150), xx: content(500) },
      rooms: []
    }),
    []
  );
});

test("word count includes paragraph and FAQ content", () => {
  assert.equal(countCountryContentWords({
    name: "Sample",
    intro: "one two",
    paragraphs: ["three four"],
    faqs: [["five six", "seven eight"]]
  }), 9);
});
