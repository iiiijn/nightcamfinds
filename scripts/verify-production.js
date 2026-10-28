const fs = require("fs");
const { spawnSync } = require("child_process");

const requiredFiles = [
  "route.js",
  "scripts/run-production-migrations.js",
  "scripts/patch-seo-attribution-v2.js",
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
const expectedStart = "node scripts/run-production-migrations.js && node route.js";
if (start !== expectedStart) fail(`production start command must be exactly: ${expectedStart}`);
if (/patch-|fix-server-syntax/.test(start)) fail("production start command must not run build-time patch scripts");

const render = fs.readFileSync("render.yaml", "utf8");
if (!render.includes("buildCommand: npm ci")) fail("Render must use npm ci for deterministic installs");
if (!render.includes("scripts/patch-seo-attribution-v2.js")) fail("Render build must apply the SEO attribution patch");
if (!render.includes("scripts/patch-spa-seo-routes.js")) fail("Render build must apply the SPA SEO patch");
if (!render.includes("scripts/fix-bonga-affiliate.js")) fail("Render build must apply the Bonga affiliate patch");
if (!render.includes("startCommand: npm start")) fail("Render must start through npm start");

const route = fs.readFileSync("route.js", "utf8");
if (!route.includes("NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6")) fail("route.js is missing the Chaturbate route marker");
if (!route.includes("NIGHTCAMFINDS_BONGA_REVSHARE_V1")) fail("route.js is missing BongaCash RevShare routing");
if (!route.includes('target.searchParams.set("c", BONGA_CAMPAIGN)')) fail("BongaCash campaign routing is missing");

const seoPatch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");
if (!seoPatch.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V13")) fail("SPA SEO patch marker V13 is missing");
if (!seoPatch.includes("ncfRedirectSeoNoSlashV13")) fail("SEO no-slash redirect helper is missing");
if (!seoPatch.includes("ncfApplySeoRouteMetadataV13")) fail("SEO metadata helper is missing");

if (failed) {
  console.error("Production verification failed.");
  process.exit(1);
}

console.log("Production verification passed: syntax, required files, deterministic Render build, clean startup wiring, affiliate routing, and SEO patch markers are intact.");
