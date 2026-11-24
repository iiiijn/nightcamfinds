const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V16";
const LEGACY_MARKERS = [
  "NIGHTCAMFINDS_SPA_SEO_ROUTES_V15",
  "NIGHTCAMFINDS_SPA_SEO_ROUTES_V14"
];
let source = fs.readFileSync(FILE, "utf8");

if (source.includes(MARKER)) {
  console.log("SEO SPA route V16 patch already applied");
  process.exit(0);
}

const newline = source.includes("\r\n") ? "\r\n" : "\n";
const legacyMarker = LEGACY_MARKERS.find(marker => source.includes(marker));
if (legacyMarker) {
  const legacyStart = source.indexOf("// " + legacyMarker);
  const listenerStart = source.indexOf("  return originalCreateServer.call(http, async (req, res) => {", legacyStart);
  if (legacyStart < 0 || listenerStart < 0) throw new Error("legacy SEO middleware boundaries not found");
  source = source.slice(0, legacyStart) + source.slice(listenerStart);
  source = source
    .replace(/^[ \t]*if \(ncfRedirectSeoNoSlashV(?:14|15)\(req, res\)\) return;\r?\n/gm, "")
    .replace(/^[ \t]*ncfRewriteSeoRequestV(?:14|15)\(req\);\r?\n/gm, "")
    .replace(/^[ \t]*ncfApplySeoRouteMetadataV14\(req, res\);\r?\n/gm, "");
}
const listenerAnchor = "  return originalCreateServer.call(http, async (req, res) => {" + newline;
if (!source.includes(listenerAnchor)) throw new Error("route.js server listener anchor not found");

const helper = `
 // ${MARKER}
 // Only SPA entry points are rewritten. Category and country routes retain
 // their server-rendered content and canonical URL structure.
 const { canonicalSeoRedirectPath } = require("./src/services/seo-route-canonical.cjs");
 const NCF_SEO_PATHS_V16 = new Set(["/", "/broadcast"]);

 function ncfRedirectSeoCanonicalV16(req, res) {
   try {
     if (req.method !== "GET" && req.method !== "HEAD") return false;
     const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
     const targetPath = canonicalSeoRedirectPath(current.pathname);
     if (!targetPath) return false;
     current.pathname = targetPath;
     res.writeHead(301, {
       Location: current.pathname + current.search,
       "Cache-Control": "public, max-age=3600",
       "X-Content-Type-Options": "nosniff"
     });
     res.end();
     return true;
   } catch {
     return false;
   }
 }

 function ncfRewriteSeoRequestV16(req) {
   try {
     const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
     if (!NCF_SEO_PATHS_V16.has(current.pathname)) return;
     req.url = current.pathname === "/broadcast"
       ? "/broadcast.html" + current.search
       : "/" + current.search;
   } catch {}
 }

 // Canonical origin is fixed in server.js. This middleware intentionally does
 // not modify response bodies or wrap ServerResponse.write/end.

`;

source = source.replace(listenerAnchor, helper.replace(/^ /gm, "").replace(/\n/g, newline) + listenerAnchor);
const insertion = [
  "    if (ncfRedirectSeoCanonicalV16(req, res)) return;",
  "    ncfRewriteSeoRequestV16(req);"
].join(newline) + newline;
source = source.replace(listenerAnchor, listenerAnchor + insertion);
fs.writeFileSync(FILE, source);
console.log("Applied SEO SPA route patch V16");
