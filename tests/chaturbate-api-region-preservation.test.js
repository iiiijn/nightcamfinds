"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { patchServerSource } = require("../scripts/patch-country-directory.js");
const { patchChaturbateApiRegion } = require("../scripts/patch-chaturbate-api-region.js");
const { resolveChaturbateCountry } = require("../src/services/country-directory.cjs");
const { getDiscoveryRegion, CHATURBATE_API_REGIONS } = require("../src/services/regional-discovery.cjs");

test("Chaturbate startup normalization preserves both provider region sources", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const countryPatched = patchServerSource(server);
  const patched = patchChaturbateApiRegion(countryPatched);

  assert.ok(patched.includes("NIGHTCAMFINDS_CHATURBATE_API_REGION_V1"));
  assert.match(patched, /partnerRegion:normalizeRegion\(room\.region\|\|room\.region_name\|\|room\.state\|\|room\.province\)/);
  assert.match(patched, /apiRegion:normalizeRegion\(apiRegion\)/);
  assert.match(patched, /region:getDiscoveryRegion\(\{country,partnerRegion:normalizeRegion\(room\.region\|\|room\.region_name\|\|room\.state\|\|room\.province\),apiRegion\}\)/);
  assert.equal(patchChaturbateApiRegion(patched), patched, "the API-region patch must be idempotent");
});

test("all Chaturbate API regions map to deliberate visitor-facing fallbacks", () => {
  assert.deepEqual(CHATURBATE_API_REGIONS, ["asia", "europe_russia", "northamerica", "southamerica", "other"]);
  const expected = {
    asia: "Asia-Pacific",
    europe_russia: "Europe & Asia",
    northamerica: "North America",
    southamerica: "Latin America",
    other: "Other"
  };
  for (const [apiRegion, region] of Object.entries(expected)) {
    assert.equal(getDiscoveryRegion({ country: "", partnerRegion: "", apiRegion }), region, apiRegion);
  }
});

test("API-region fallback never invents a country when Chaturbate omits country and location", () => {
  assert.equal(resolveChaturbateCountry("", ""), "");
  assert.equal(getDiscoveryRegion({ country: "", partnerRegion: "", apiRegion: "europe_russia" }), "Europe & Asia");
});

test("recognized country remains more authoritative than provider API region", () => {
  assert.equal(getDiscoveryRegion({ country: "Germany", partnerRegion: "", apiRegion: "northamerica" }), "Central & Eastern Europe");
  assert.equal(getDiscoveryRegion({ country: "", partnerRegion: "Western Europe", apiRegion: "northamerica" }), "Western Europe");
});
