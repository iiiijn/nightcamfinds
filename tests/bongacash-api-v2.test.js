"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BASE_URL,
  isPublicIpv4,
  resolveTrustedClientIpv4,
  buildModelsOnlineUrl,
  buildDictionaryUrl,
  parseModelsOnlineResponse,
  parseDictionaryResponse
} = require("../src/services/bongacash-api-v2.cjs");

test("BongaCash V2 model URL includes campaign, real visitor IP and pagination", () => {
  const url = new URL(buildModelsOnlineUrl({
    campaignId: "840970",
    clientIp: "8.8.8.8",
    limit: 100,
    offset: 200,
    filters: { sort: "rank", region: "europe", section: "transsexual", username: "sample_model" }
  }));
  assert.equal(url.origin + url.pathname, BASE_URL + "models-online");
  assert.equal(url.searchParams.get("c"), "840970");
  assert.equal(url.searchParams.get("client_ip"), "8.8.8.8");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("offset"), "200");
  assert.equal(url.searchParams.get("sort"), "rank");
  assert.equal(url.searchParams.get("region"), "europe");
  assert.equal(url.searchParams.get("section"), "transsexual");
  assert.equal(url.searchParams.get("username"), "sample_model");
});

test("BongaCash V2 refuses missing, malformed, private or reserved visitor IPs", () => {
  for (const value of ["", "8.8.8", "999.1.1.1", "127.0.0.1", "10.0.0.1", "192.168.1.2", "169.254.1.2", "8.8.8.8, 1.1.1.1"]) {
    assert.equal(isPublicIpv4(value), false, value);
    assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: value }));
  }
  assert.equal(isPublicIpv4("8.8.8.8"), true);
});

test("BongaCash V2 only reads a single address from an explicitly configured proxy header", () => {
  const req = { headers: {
    "cf-connecting-ip": "8.8.4.4",
    "x-forwarded-for": "8.8.8.8, 10.0.0.1"
  } };
  assert.equal(resolveTrustedClientIpv4(req, "cf-connecting-ip"), "8.8.4.4");
  assert.equal(resolveTrustedClientIpv4(req, "x-forwarded-for"), null);
  assert.equal(resolveTrustedClientIpv4(req, "x-real-ip"), null);
  assert.equal(resolveTrustedClientIpv4(req, "host"), null);
  assert.equal(resolveTrustedClientIpv4(req, ""), null);
});

test("BongaCash V2 validates supported scalar filters and rejects unknown values", () => {
  assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: "8.8.8.8", filters: { region: "africa" } }));
  assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: "8.8.8.8", filters: { section: "unknown" } }));
  assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: "8.8.8.8", filters: { sort: "random" } }));
  assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: "8.8.8.8", filters: { categories: ["female"] } }));
  assert.throws(() => buildModelsOnlineUrl({ campaignId: "840970", clientIp: "8.8.8.8", filters: { tags: ["english"] } }));
});

test("BongaCash V2 validates the provider base URL", () => {
  assert.throws(() => buildModelsOnlineUrl({
    baseUrl: "http://bngprm.com/api/v2/",
    campaignId: "840970",
    clientIp: "8.8.8.8"
  }));
  assert.throws(() => buildModelsOnlineUrl({
    baseUrl: "https://example.com/api/v2/",
    campaignId: "840970",
    clientIp: "8.8.8.8"
  }));
});

test("BongaCash V2 dictionary URL validates documented key and language", () => {
  const url = new URL(buildDictionaryUrl({ key: "language", lang: "en" }));
  assert.equal(url.origin + url.pathname, BASE_URL + "dict");
  assert.equal(url.searchParams.get("key"), "language");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.throws(() => buildDictionaryUrl({ key: "unknown", lang: "en" }));
  assert.throws(() => buildDictionaryUrl({ key: "language", lang: "xx" }));
});

test("BongaCash V2 response parsers require the documented JSON shapes", () => {
  const models = [{ username: "sample", homecountry: "US", is_hd: true }];
  assert.deepEqual(parseModelsOnlineResponse({ online_models: 1, models }), models);
  assert.throws(() => parseModelsOnlineResponse({ results: models }));
  assert.throws(() => parseModelsOnlineResponse([]));
  assert.deepEqual(parseDictionaryResponse({ gender: { female: "Female" } }), { gender: { female: "Female" } });
  assert.throws(() => parseDictionaryResponse([]));
});
