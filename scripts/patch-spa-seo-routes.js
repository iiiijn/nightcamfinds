const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V6";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route patch already applied");
  process.exit(0);
}

const helper = `
// ${MARKER}
const SEO_SPA_PATHS = new Set([
  "/", "/live/", "/female/", "/male/", "/trans/", "/couples/",
  "/hd/", "/new/", "/popular/", "/countries/",
  "/about", "/privacy", "/terms", "/contact", "/affiliate-disclosure", "/broadcast"
]);

function redirectSeoNoSlash(req, res) {
  try {
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

function rewriteSeoSpaRequest(req) {
  try {
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    const pathname = current.pathname;
    if (SEO_SPA_PATHS.has(pathname) || /^\\/country\\/[a-z]{2}\\/$/i.test(pathname)) {
      req.seoOriginalPathname = pathname;
      req.url = "/" + current.search;
    }
  } catch {}
}

function applySeoRouteMetadata(req, res) {
  const pathname = String(req.seoOriginalPathname || "");
  if (!pathname) return;

  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "nightcamfinds.com").split(",")[0].trim();
  const origin = `${proto}://${host}`.replace(/\\/$/, "");
  const canonical = origin + (pathname.startsWith("/") ? pathname : `/${pathname}`);

  const originalEnd = res.end;
  res.end = function seoMetadataEnd(chunk, encoding, callback) {
    try {
      const contentType = String(res.getHeader("content-type") || "").toLowerCase();
      if (chunk && (!contentType || contentType.includes("text/html"))) {
        let html = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        html = html
          .replace(/<link\\s+rel=["']canonical["']\\s+href=["'][^"']*["'][^>]*>/i,
            `<link rel="canonical" href="${canonical}">`)
          .replace(/(<meta\\s+property=["']og:url["']\\s+content=["'])[^"']*(["'][^>]*>)/i,
            `$1${canonical}$2`)
          .replace(/__CANONICAL__/g, canonical)
          .replace(/__OG_URL__/g, canonical);
        return originalEnd.call(this, html, encoding, callback);
      }
    } catch (err) {
      console.error("SEO route metadata rewrite failed:", err.message);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };
}

`;

const originalAnchor = 'const originalCreateServer = http.createServer;\\n';
if (!s.includes(originalAnchor)) {
  throw new Error("route.js createServer anchor not found");
}

s = s.replace(originalAnchor, originalAnchor + helper);

const listenerAnchor = '  return originalCreateServer.call(http, async (req, res) => {\\n';
if (!s.includes(listenerAnchor)) {
  throw new Error("route.js server listener anchor not found");
}

s = s.replace(listenerAnchor, listenerAnchor + '    if (redirectSeoNoSlash(req, res)) return;\\n    rewriteSeoSpaRequest(req);\\n    applySeoRouteMetadata(req, res);\\n');

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V6");
