"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { patchServerSource } = require("../scripts/patch-country-directory.js");
const {
  BASE_URL,
  isPublicIpv4,
  hasAuthenticatedOrigin,
  resolveTrustedClientIpv4,
  buildModelsOnlineUrl,
  buildDictionaryUrl,
  parseModelsOnlineResponse,
  normalizeTags,
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

test("BongaCash V2 requires an independent shared secret from the Cloudflare Worker", () => {
  const secret = "a".repeat(64);
  const req = { headers: { "x-ncf-origin-auth": secret } };
  assert.equal(hasAuthenticatedOrigin(req, secret), true);
  assert.equal(hasAuthenticatedOrigin({ headers: {} }, secret), false);
  assert.equal(hasAuthenticatedOrigin({ headers: { "x-ncf-origin-auth": "attacker-value" } }, secret), false);
  assert.equal(hasAuthenticatedOrigin(req, ""), false);
  assert.equal(hasAuthenticatedOrigin(req, "short"), false);
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

test("BongaCash V2 parser preserves provider metadata and the documented model shape", () => {
  const models = [{
    username: "LaraBrynn",
    profile_page_url: "https://bongacams.com/track?c=840970&csurl=https://bongacams.com/profile/LaraBrynn",
    chat_url: "https://bongacams.com/track?c=840970&csurl=https://bongacams.com/chat-popup/LaraBrynn",
    display_age: 23,
    profile_images: { profile_image: "https://images.example/profile.jpg" },
    live_images: { thumbnail_image_big: "https://images.example/live.jpg" },
    members_count: 4423,
    is_hd: false,
    primary_language: "english",
    homecountry: "US",
    region: "europe",
    tags: { "0": "blowjob", "1": "camshow", "3": "english" }
  }];
  const parsed = parseModelsOnlineResponse({
    online_models: 1139,
    random_chat_url: "https://bongacams.com/track?c=840970&csurl=https://bongacams.com/chat",
    popular_chat_url: "https://bongacams.com/track?c=840970&csurl=https://bongacams.com/popular-chat",
    models
  });
  assert.deepEqual(parsed.models, models);
  assert.equal(parsed.onlineModels, 1139);
  assert.match(parsed.randomChatUrl, /c=840970/);
  assert.match(parsed.popularChatUrl, /popular-chat/);
  assert.deepEqual(normalizeTags(models[0].tags), ["blowjob", "camshow", "english"]);
  assert.deepEqual(normalizeTags([" one ", "two", 3, "one"]), ["one", "two"]);
  assert.deepEqual(normalizeTags("one two,three"), ["one", "two", "three"]);
  assert.throws(() => parseModelsOnlineResponse({ results: models }));
  assert.throws(() => parseModelsOnlineResponse([]));
  assert.throws(() => parseModelsOnlineResponse({ online_models: -1, models }));
  assert.throws(() => parseModelsOnlineResponse({ online_models: 1, models: [null] }));
  assert.deepEqual(parseDictionaryResponse({ gender: { female: "Female" } }), { gender: { female: "Female" } });
  assert.throws(() => parseDictionaryResponse([]));
});

test("country startup patch preserves V2 HD, live-image and safe tags fields", () => {
  const serverPath = path.join(__dirname, "..", "server.js");
  const patched = patchServerSource(fs.readFileSync(serverPath, "utf8"));
  assert.match(patched, /isHd:!!room\.is_hd/);
  assert.match(patched, /liveImages\.thumbnail_image_big/);
  assert.match(patched, /normalizeTags\(room\.tags\)\.join\(" "\)/);
});

test("V2 remains opt-in and falls back to V1 in the server integration", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(serverSource, /BONGA_API_VERSION = process\.env\.BONGACAMS_API_VERSION === "2" \? "2" : "1"/);
  assert.match(serverSource, /BONGACAMS_TRUSTED_CLIENT_IP_HEADER/);
  assert.match(serverSource, /BONGACAMS_ORIGIN_AUTH_SECRET/);
  assert.match(serverSource, /hasAuthenticatedOrigin\(req,BONGA_ORIGIN_AUTH_SECRET\)/);
  assert.match(serverSource, /BongaCash V2 feed failed; falling back to V1/);
});
