const fs = require("fs");
const { spawnSync } = require("child_process");

const root = process.cwd();
const requiredFiles = [
  "route.js",
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
const patchSpa = "scripts/patch-spa-seo-routes.js";
if (!start.includes(patchSpa)) fail("production start command is missing the SPA SEO patch");
if ((start.match(new RegExp(patchSpa.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "g")) || []).length !== 1) {
  fail("SPA SEO patch must be invoked exactly once at startup");
}
if (!start.trim().endsWith("node route.js")) fail("production start command must launch route.js");

const route = fs.readFileSync("route.js", "utf8");
if (!route.includes("NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6")) fail("route.js is missing the Chaturbate route marker");

const seoPatch = fs.readFileSync(patchSpa, "utf8");
if (!seoPatch.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V13")) fail("SPA SEO patch marker V13 is missing");
if (!seoPatch.includes("ncfRedirectSeoNoSlashV13")) fail("SEO no-slash redirect helper is missing");
if (!seoPatch.includes("ncfApplySeoRouteMetadataV13")) fail("SEO metadata helper is missing");

if (failed) {
  console.error("Production verification failed.");
  process.exit(1);
}

console.log("Production verification passed: syntax, required files, Render configuration, startup wiring, and SEO patch markers are intact.");
