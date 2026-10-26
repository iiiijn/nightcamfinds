const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V2";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route patch already applied");
  process.exit(0);
}

const anchor = 'http.createServer = function routeDashboard(handler) {';
if (!s.includes(anchor)) {
  throw new Error("route.js routeDashboard anchor not found");
}

const helper = `
// ${MARKER}
const SEO_SPA_PATHS = new Set([
  "/", "/live/", "/female/", "/male/", "/trans/", "/couples/",
  "/hd/", "/new/", "/popular/", "/countries/",
  "/about", "/privacy", "/terms", "/contact", "/affiliate-disclosure", "/broadcast"
]);

function isSeoSpaPath(urlValue) {
  try {
    const pathname = new URL(String(urlValue || "/"), "http://nightcamfinds.local").pathname;
    if (SEO_SPA_PATHS.has(pathname)) return true;
    return /^\\/country\\/[a-z]{2}\\/?$/i.test(pathname);
  } catch {
    return false;
  }
}

function rewriteSeoSpaRequest(req) {
  if (!isSeoSpaPath(req.url)) return;
  const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
  req.url = "/" + current.search;
}

`;

s = s.replace('const originalCreateServer = http.createServer;\n', 'const originalCreateServer = http.createServer;\n' + helper);

const listenerAnchor = '  return originalCreateServer.call(http, async (req, res) => {';
if (!s.includes(listenerAnchor)) {
  throw new Error("route.js server listener anchor not found");
}

s = s.replace(listenerAnchor, `  return originalCreateServer.call(http, async (req, res) => {
    rewriteSeoSpaRequest(req);`);

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V2");
