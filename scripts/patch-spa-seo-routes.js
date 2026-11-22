const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V15";
const LEGACY_MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V14";
let source = fs.readFileSync(FILE, "utf8");

if (source.includes(MARKER)) {
  console.log("SEO SPA route V15 patch already applied");
  process.exit(0);
}

const newline = source.includes("\r\n") ? "\r\n" : "\n";
if (source.includes(LEGACY_MARKER)) {
  const legacyStart = source.indexOf("// " + LEGACY_MARKER);
  const listenerStart = source.indexOf("  return originalCreateServer.call(http, async (req, res) => {", legacyStart);
  if (legacyStart < 0 || listenerStart < 0) throw new Error("legacy SEO middleware boundaries not found");
  source = source.slice(0, legacyStart) + source.slice(listenerStart);
  source = source
    .replace(/^[ \t]*if \(ncfRedirectSeoNoSlashV14\(req, res\)\) return;\r?\n/gm, "")
    .replace(/^[ \t]*ncfRewriteSeoRequestV14\(req\);\r?\n/gm, "")
    .replace(/^[ \t]*ncfApplySeoRouteMetadataV14\(req, res\);\r?\n/gm, "");
}
const listenerAnchor = "  return originalCreateServer.call(http, async (req, res) => {" + newline;
if (!source.includes(listenerAnchor)) throw new Error("route.js server listener anchor not found");

const helper = `
// ${MARKER}
// Only SPA entry points are rewritten. Server-rendered category and country
// routes keep their original paths and response bodies.
const NCF_SEO_PATHS_V15 = new Set(["/", "/broadcast"]);

function ncfRedirectSeoNoSlashV15(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    const pathname = current.pathname;
    const needsSlash =
      /^\\/(live|female|male|trans|couples|hd|new|popular|countries)$/.test(pathname) ||
      /^\\/country\\/[a-z]{2}$/i.test(pathname);
    if (!needsSlash) return false;
    current.pathname = pathname + "/";
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

function ncfRewriteSeoRequestV15(req) {
  try {
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    if (!NCF_SEO_PATHS_V15.has(current.pathname)) return;
    req.url = current.pathname === "/broadcast"
      ? "/broadcast.html" + current.search
      : "/" + current.search;
  } catch {}
}

// Canonical origin is fixed in server.js. This middleware intentionally does
// not modify response bodies or wrap ServerResponse.write/end.

`;

source = source.replace(listenerAnchor, helper.replace(/\n/g, newline) + listenerAnchor);
const insertion = [
  "    if (ncfRedirectSeoNoSlashV15(req, res)) return;",
  "    ncfRewriteSeoRequestV15(req);"
].join(newline) + newline;
source = source.replace(listenerAnchor, listenerAnchor + insertion);
fs.writeFileSync(FILE, source);
console.log("Applied SEO SPA route patch V15");
