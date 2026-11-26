"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  countCountryContentWords,
  getEligibleCountrySitemapSlugs,
  MINIMUM_INDEXABLE_COUNTRY_ROOMS
} = require("../src/services/country-sitemap-eligibility.cjs");
const { summarizeCountryRouteHealth } = require("../src/services/country-route-health.cjs");

function content(wordCount) {
  return { name: "Sample", intro: Array(wordCount).fill("useful").join(" ") };
}

function rooms(count, country, platform = "chaturbate") {
  return Array.from({ length: count }, (_, index) => ({
    id: platform + ":" + country.toLowerCase() + ":" + index,
    platform,
    country
  }));
}

test("country sitemap includes only Tier 1 and Tier 2 markets with adequate content and ten distinct valid rooms", () => {
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
  const feedRooms = [
    ...rooms(10, "US"),
    ...rooms(10, "PL"),
    ...rooms(10, "CZ"),
    ...rooms(10, "RU")
  ];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms: feedRooms }),
    ["pl", "ru", "us"]
  );
});

test("Tier 3 countries require stronger content and the same ten-room inventory threshold", () => {
  const marketMeta = { br: { priority: "Tier 3" }, in: { priority: "Tier 3" } };
  const countryContent = { br: content(220), in: content(220) };
  const feedRooms = [...rooms(9, "BR"), ...rooms(10, "IN")];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms: feedRooms }),
    ["in"]
  );
});

test("countries with zero through nine valid distinct rooms stay out of the sitemap", () => {
  for (let count = 0; count < MINIMUM_INDEXABLE_COUNTRY_ROOMS; count += 1) {
    const result = getEligibleCountrySitemapSlugs({
      marketMeta: { us: { priority: "Tier 1" } },
      countryContent: { us: content(150) },
      rooms: rooms(count, "US")
    });
    assert.deepEqual(result, [], "room count " + count + " must not qualify");
  }
});

test("duplicate IDs and invalid room records do not inflate sitemap eligibility", () => {
  const nine = rooms(9, "US");
  const invalid = [
    { id: "other-platform", platform: "unknown", country: "US" },
    { id: "", platform: "chaturbate", country: "US" },
    { id: "bad-country", platform: "chaturbate", country: "ZZ" }
  ];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({
      marketMeta: { us: { priority: "Tier 1" } },
      countryContent: { us: content(150) },
      rooms: [...nine, nine[0], ...invalid]
    }),
    []
  );
});

test("two providers can contribute distinct valid rooms to the ten-room threshold", () => {
  const feedRooms = [...rooms(5, "US", "chaturbate"), ...rooms(5, "US", "bongacams")];
  assert.deepEqual(
    getEligibleCountrySitemapSlugs({
      marketMeta: { us: { priority: "Tier 1" } },
      countryContent: { us: content(150) },
      rooms: feedRooms
    }),
    ["us"]
  );
});

test("country route indexability and sitemap eligibility share the same ten-room threshold", () => {
  const marketMeta = { us: { priority: "Tier 1" } };
  const countryContent = { us: content(150) };
  const nine = rooms(9, "US");
  const ten = rooms(MINIMUM_INDEXABLE_COUNTRY_ROOMS, "US");

  assert.equal(summarizeCountryRouteHealth({ rooms: nine }).indexable, false);
  assert.deepEqual(getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms: nine }), []);

  assert.equal(summarizeCountryRouteHealth({ rooms: ten }).indexable, true);
  assert.deepEqual(getEligibleCountrySitemapSlugs({ marketMeta, countryContent, rooms: ten }), ["us"]);
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

test("production sitemap route uses the shared eligibility helper and live feed", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(server, /getEligibleCountrySitemapSlugs\(\s*\{\s*marketMeta:\s*MARKET_META,\s*countryContent:\s*COUNTRY_PAGE_CONTENT,\s*rooms:\s*feed\.rooms\s*\}\s*\)/);
  assert.ok(server.includes('if (pathname === "/sitemap.xml") {'));
  assert.ok(server.includes('sitemap(pageOrigin(req), eligibleCountrySlugs)'));
});
