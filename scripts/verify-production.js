const fs = require("fs");
const { spawnSync } = require("child_process");

const requiredFiles = [
  "route.js",
  "scripts/run-production-migrations.js",
  "scripts/fix-server-syntax.js",
  "scripts/patch-country-directory.js",
  "scripts/patch-chaturbate-api-region.js",
  "scripts/patch-spa-seo-routes.js",
  "scripts/patch-origin-auth.js",
  "src/services/origin-auth.cjs",
  "src/services/feed-health.cjs",
  "tests/feed-health.test.js",
  "tests/health-route-delegation.test.js",
  "tests/origin-auth.test.js",
  "docs/phase-a1-7-security-rollout.md",
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

for (const file of requiredFiles.filter(file => /\.(?:c?js)$/.test(file))) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    fail(`syntax error in ${file}`);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const start = String(pkg.scripts?.start || "");
const expectedStart = "node scripts/run-production-migrations.js && node scripts/fix-server-syntax.js && node scripts/patch-country-directory.js && node scripts/patch-chaturbate-api-region.js && node scripts/patch-spa-seo-routes.js && node route.js";
if (start !== expectedStart) fail(`production start command must be exactly: ${expectedStart}`);
if (/fix-bonga-affiliate|patch-seo-attribution-v2/.test(start)) fail("non-runtime build patches must not run at startup");

const render = fs.readFileSync("render.yaml", "utf8");
if (!render.includes("buildCommand: npm ci")) fail("Render build configuration must use npm ci");
if (!render.includes("scripts/patch-seo-attribution-v2.js")) fail("Render build must apply the SEO attribution patch");
if (!render.includes("scripts/patch-spa-seo-routes.js")) fail("Render build must apply the SPA SEO patch");
if (!render.includes("scripts/fix-bonga-affiliate.js")) fail("Render build must apply the Bonga affiliate patch");
if (!render.includes("scripts/patch-origin-auth.js")) fail("Render build must apply the staged origin-auth patch after the other route patches");
if (!render.includes("startCommand: npm start")) fail("Render must start through npm start");
if (!render.includes("healthCheckPath: /healthz")) fail("Render must use the lightweight /healthz liveness endpoint");

const route = fs.readFileSync("route.js", "utf8");
if (!route.includes('if (incoming.pathname === "/api/health") return handler(req, res);')) fail("dashboard middleware must delegate /api/health to the canonical feed-health handler");
if (/incoming\.pathname === "\/api\/health"[\s\S]{0,300}databaseConfigured/.test(route)) fail("legacy database-only /api/health response must not shadow feed diagnostics");
const originAuthPatch = require("./patch-origin-auth.js");
const patchedRoute = originAuthPatch.patchSource(route);
if (!patchedRoute.includes(originAuthPatch.MARKER)) fail("Cloudflare origin-auth guard is missing from the build output");
const originAuthSource = fs.readFileSync("src/services/origin-auth.cjs", "utf8");
if (!originAuthSource.includes('"/api/chaturbate/postback"') || !originAuthSource.includes('"/cb/postback"')) fail("origin-auth guard must preserve the independently authenticated Chaturbate callback paths");
if (!route.includes("NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6")) fail("route.js is missing the Chaturbate route marker");
if (!route.includes("NIGHTCAMFINDS_BONGA_REVSHARE_V1")) fail("route.js is missing BongaCash RevShare routing");
if (!route.includes('target.searchParams.set("c", BONGA_CAMPAIGN)')) fail("BongaCash campaign routing is missing");


const serverSource = fs.readFileSync("server.js", "utf8");
if (!serverSource.includes('pathname === "/healthz"')) fail("lightweight /healthz endpoint is missing");
if (!serverSource.includes('pathname === "/api/health"')) fail("feed diagnostics /api/health endpoint is missing");
if (!serverSource.includes("buildFeedHealthSnapshot")) fail("feed health snapshot helper is not integrated");
if (!serverSource.includes("fallbackUsed: true")) fail("Bonga V2 fallback state is not tracked");
const countryDirectoryPatch = require("./patch-country-directory.js");
const patchedServerSource = countryDirectoryPatch.patchServerSource(serverSource);
if (patchedServerSource !== serverSource) fail("modern country directory server must not require a legacy source rewrite");
const chaturbateRegionPatch = require("./patch-chaturbate-api-region.js");
const patchedRegionalServerSource = chaturbateRegionPatch.patchChaturbateApiRegion(patchedServerSource);
if (!patchedRegionalServerSource.includes("NIGHTCAMFINDS_CHATURBATE_API_REGION_V1")) fail("Chaturbate API region preservation patch marker is missing");
if (serverSource.includes("const countryMatch = pathname.match(")) fail("duplicate early country route remains in the server");
if (!serverSource.includes("summarizeCountryRouteHealth({ providerHealth: feed.providerHealth, rooms: countryRooms })") || !serverSource.includes("routeHealth.indexable")) fail("country pages must use the minimum indexable room threshold and provider-health diagnostics");
if (!serverSource.includes("getEligibleCountrySitemapSlugs") || !serverSource.includes("sitemap(pageOrigin(req), eligibleCountrySlugs)")) fail("dynamic country sitemap content and live-feed eligibility filtering are missing");
if (!serverSource.includes("buildHtmlSitemap") || !serverSource.includes('pathname === "/sitemap/"')) fail("feed-backed HTML sitemap route is missing");
if (!serverSource.includes("html = renderHeroCopy(html, copy)")) fail("server pages must render hero copy through the safe renderer");

const roomRenderer = require("../src/services/room-page-renderer.cjs");
const renderedHero = roomRenderer.renderHeroCopy(
  '<p id="kicker">Independent discovery</p><h1 id="page-title">Discover live cams right now</h1><p id="page-intro">Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.</p><title>NightCamFinds — Live cam directory</title><meta name="description" content="Browse live rooms by country from Chaturbate and BongaCams. NightCamFinds does not stream video.">',
  ["Directory", "Live rooms", "Browse rooms.", "Live rooms — NightCamFinds"]
);
const renderedCards = roomRenderer.renderRoomCards([
  { id: "bongacams:test", platform: "bongacams", gender: "female", username: "test", displayName: "Test", roomSubject: { description: "A readable description" } }
]);
for (const [label, html] of [["hero", renderedHero], ["room cards", renderedCards]]) {
  if (/\$\{[^}]+\}|\[object Object\]/.test(html)) fail(`${label} HTML contains an unrendered template or object placeholder`);
}
if (!renderedCards.includes("A readable description")) fail("object-valued room descriptions must render their text field");

const seoPatch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");
if (!seoPatch.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V15")) fail("SPA SEO patch marker V15 is missing");
if (!seoPatch.includes("ncfRedirectSeoCanonicalV16")) fail("SEO no-slash redirect helper V16 is missing");
if (!seoPatch.includes("ncfRewriteSeoRequestV16")) fail("SEO request rewrite helper V16 is missing");
if (!seoPatch.includes('const NCF_SEO_PATHS_V16 = new Set(["/", "/broadcast"]);')) fail("SEO SPA path allowlist must contain only / and /broadcast");
for (const path of ["/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/"]) {
  if (seoPatch.includes(JSON.stringify(path))) fail(`server-rendered category route must not be rewritten: ${path}`);
}
if (!seoPatch.includes('current.pathname === "/broadcast"')) fail("/broadcast rewrite condition is missing");
if (!seoPatch.includes('"/broadcast.html"')) fail("/broadcast standalone HTML target is missing");
if (!seoPatch.includes('if (req.method !== "GET" && req.method !== "HEAD") return false;')) fail("trailing-slash redirects must be limited to GET and HEAD");
if (/res\.write\s*=|res\.end\s*=/.test(seoPatch)) fail("SEO middleware must not replace or wrap response write/end methods");
if (/function\s+ncfApplySeoRouteMetadataV14\s*\(/.test(seoPatch)) fail("legacy V14 response metadata helper must not be defined");
if (/function\s+ncfRewriteSeoRequestV14\s*\(/.test(seoPatch)) fail("legacy V14 request rewrite helper must not be defined");
if (/function\s+ncfRedirectSeoNoSlashV14\s*\(/.test(seoPatch)) fail("legacy V14 redirect helper must not be defined");
if (/ncfApplySeoRouteMetadataV14\s*\(req,\s*res\)\s*;/.test(seoPatch)) fail("legacy V14 response metadata middleware must not be invoked");

const serverSourceForCanonical = fs.readFileSync("server.js", "utf8");
if (!serverSourceForCanonical.includes('function pageOrigin(_req) { return "https://nightcamfinds.com"; }')) fail("canonical page origin must be fixed to the production domain");
if (!serverSourceForCanonical.includes('const origin = "https://nightcamfinds.com";')) fail("legal page canonical origin must be fixed to the production domain");

if (failed) {
  console.error("Production verification failed.");
  process.exit(1);
}

console.log("Production verification passed: syntax, required files, deterministic install configuration, minimal runtime startup, affiliate routing, and SEO patch markers are intact.");
