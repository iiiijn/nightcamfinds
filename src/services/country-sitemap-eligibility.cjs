"use strict";

const MIN_WORDS_BY_TIER = Object.freeze({
  "Tier 1": 100,
  "Tier 2": 100,
  "Tier 3": 180
});

function countCountryContentWords(country) {
  if (!country || typeof country !== "object") return 0;
  const parts = [country.name, country.intro];
  if (Array.isArray(country.paragraphs)) parts.push(...country.paragraphs);
  if (Array.isArray(country.faqs)) {
    for (const faq of country.faqs) {
      if (Array.isArray(faq)) parts.push(...faq);
    }
  }
  return parts.filter((part) => typeof part === "string")
    .join(" ")
    .trim()
    .split(/\\s+/)
    .filter(Boolean).length;
}

function getEligibleCountrySitemapSlugs({ marketMeta = {}, countryContent = {}, rooms = [] } = {}) {
  const liveCountries = new Set(
    (Array.isArray(rooms) ? rooms : [])
      .map((room) => String(room && room.country || "").trim().toLowerCase())
      .filter((code) => /^[a-z]{2}$/.test(code))
  );
  return Object.keys(marketMeta)
    .map((slug) => String(slug).toLowerCase())
    .filter((slug) => {
      const priority = marketMeta[slug] && marketMeta[slug].priority;
      const minimumWords = MIN_WORDS_BY_TIER[priority];
      if (!minimumWords || !liveCountries.has(slug)) return false;
      return countCountryContentWords(countryContent[slug]) >= minimumWords;
    })
    .sort();
}

module.exports = { countCountryContentWords, getEligibleCountrySitemapSlugs, MIN_WORDS_BY_TIER };
