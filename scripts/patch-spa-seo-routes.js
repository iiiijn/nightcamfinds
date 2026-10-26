const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V4";
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
      req.url = "/" + current.search;
    }
  } catch {}
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

s = s.replace(listenerAnchor, listenerAnchor + '    if (redirectSeoNoSlash(req, res)) return;\\n    rewriteSeoSpaRequest(req);\\n');

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V4");
