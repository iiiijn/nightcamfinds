const fs = require("fs");
const { spawnSync } = require("child_process");

const requiredFiles = [
  "route.js",
  "scripts/run-production-migrations.js",
  "scripts/fix-server-syntax.js",
  "scripts/patch-country-directory.js",
  "scripts/patch-spa-seo-routes.js",
  ".github/workflows/verify-production.yml",
  "render.yaml",
  "public/index.html",
  "public/styles.css",
  "package.json"
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

for (const file of requiredFiles.filter(file => file.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    fail(`syntax error in ${file}`);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const start = String(pkg.scripts?.start || "");
const expectedStart = "node scripts/run-production-migrations.js && node scripts/fix-server-syntax.js && node scripts/patch-country-directory.js && node scripts/patch-spa-seo-routes.js && node route.js";
if (start !== expectedStart) fail(`production start command must be exactly: ${expectedStart}`);
if (/fix-bonga-affiliate|patch-seo-attribution-v2/.test(start)) fail("non-runtime build patches must not run at startup");

const render = fs.readFileSync("render.yaml", "utf8");
if (!render.includes("buildCommand: npm ci")) fail("Render build configuration must use npm ci");
if (!render.includes("scripts/patch-seo-attribution-v2.js")) fail("Render build must apply the SEO attribution patch");
if (!render.includes("scripts/patch-spa-seo-routes.js")) fail("Render build must apply the SPA SEO patch");
if (!render.includes("scripts/fix-bonga-affiliate.js")) fail("Render build must apply the Bonga affiliate patch");
if (!render.includes("startCommand: npm start")) fail("Render must start through npm start");

const route = fs.readFileSync("route.js", "utf8");
if (!route.includes("NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6")) fail("route.js is missing the Chaturbate route marker");
if (!route.includes("NIGHTCAMFINDS_BONGA_REVSHARE_V1")) fail("route.js is missing BongaCash RevShare routing");
if (!route.includes('target.searchParams.set("c", BONGA_CAMPAIGN)')) fail("BongaCash campaign routing is missing");


const serverSource = fs.readFileSync("server.js", "utf8");
const countryDirectoryPatch = require("./patch-country-directory.js");
const patchedServerSource = countryDirectoryPatch.patchServerSource(serverSource);
if (!patchedServerSource.includes("NIGHTCAMFINDS_COUNTRY_DIRECTORY_V1")) fail("country directory patch marker is missing");
if (patchedServerSource.includes("const countryMatch = pathname.match(")) fail("duplicate early country route remains after patch");
if (!patchedServerSource.includes("isIndexableCountryRooms(countryRooms)")) fail("country pages must use the minimum indexable room threshold");
if (!patchedServerSource.includes("buildCountrySitemap")) fail("dynamic country sitemap filtering is missing");
if (!serverSource.includes("html = renderHeroCopy(html, copy)")) fail("server pages must render hero copy through the safe renderer");
if (!serverSource.includes("plainText(room.homecountry||room.country||room.country_code||\"\")")) fail("Bonga country objects must be normalized without JavaScript object coercion");

const { normalizeCountryCode } = require("../src/services/country-directory.cjs");
if (normalizeCountryCode({ country_code: "GB", name: "United Kingdom" }) !== "GB") fail("Bonga country object codes must normalize to ISO country codes");

const roomRenderer = require("../src/services/room-page-renderer.cjs");
const renderedHero = roomRenderer.renderHeroCopy(
  '<p id="kicker">${copy[0]}</p><h1 id="page-title">${copy[1]}</h1><p id="page-intro">${copy[2]}</p><title>${copy[3]}</title><meta name="description" content="${copy[2]}">',
  ["Directory", "Live rooms", "Browse rooms.", "Live rooms — NightCamFinds"]
);
const renderedCards = roomRenderer.renderRoomCards([
  { id: "bongacams:test", platform: "bongacams", gender: "female", username: "test", displayName: { username: "Bonga model" }, countryName: { name: "United Kingdom" }, roomSubject: { description: "A readable description" } }
]);
for (const [label, html] of [["hero", renderedHero], ["room cards", renderedCards]]) {
  if (/\$\{[^}]+\}|\[object Object\]/.test(html)) fail(`${label} HTML contains an unrendered template or object placeholder`);
}
if (!renderedCards.includes("A readable description")) fail("object-valued room descriptions must render their text field");
if (!renderedCards.includes("Bonga model") || !renderedCards.includes("United Kingdom")) fail("object-valued Bonga card fields must render readable values");

const seoPatch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");
if (!seoPatch.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V14")) fail("SPA SEO patch marker V14 is missing");
if (!seoPatch.includes("ncfRedirectSeoNoSlashV14")) fail("SEO no-slash redirect helper is missing");
if (!seoPatch.includes("ncfApplySeoRouteMetadataV14")) fail("SEO metadata helper is missing");
const seoPathStart = seoPatch.indexOf("const NCF_SEO_PATHS_V14 = new Set([");
const seoPathEnd = seoPathStart >= 0 ? seoPatch.indexOf("]);", seoPathStart) : -1;
const seoPathSet = seoPathStart >= 0 && seoPathEnd > seoPathStart ? seoPatch.slice(seoPathStart, seoPathEnd) : "";
if (!seoPathSet) fail("SEO metadata path allowlist is missing");
else {
  for (const path of ["/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/"]) {
    if (seoPathSet.includes(JSON.stringify(path))) fail(`server-rendered category route must not be rewritten: ${path}`);
  }
  for (const path of ["/", "/broadcast"]) {
    if (!seoPathSet.includes(JSON.stringify(path))) fail(`SPA metadata route is missing: ${path}`);
  }
}

if (failed) {
  console.error("Production verification failed.");
  process.exit(1);
}

console.log("Production verification passed: syntax, required files, deterministic install configuration, minimal runtime startup, affiliate routing, and SEO patch markers are intact.");
