const fs = require("fs");

const SERVER = "server.js";
const ROUTE = "route.js";
const MARKER = "NIGHTCAMFINDS_SEO_FINAL_V1";

function patchServer() {
  let s = fs.readFileSync(SERVER, "utf8");

  if (!s.includes("function ncfCanonicalUrl(req, pathname)")) {
    const anchor = "function pageOrigin(req) {";
    if (!s.includes(anchor)) throw new Error("server.js pageOrigin anchor missing");
    const helper = `function ncfCanonicalUrl(req, pathname) {\n  const configuredOrigin = String(process.env.PUBLIC_ORIGIN || \"\").replace(/\\/$/, \"\");\n  const proto = String(req.headers[\"x-forwarded-proto\"] || \"https\").split(\",\")[0].trim();\n  const host = String(req.headers[\"x-forwarded-host\"] || req.headers.host || \"nightcamfinds.com\").split(\",\")[0].trim();\n  const origin = configuredOrigin || (host ? proto + \"://\" + host : \"https://nightcamfinds.com\");\n  const original = String(req.seoOriginalPathname || pathname || \"/\");\n  return origin + (original.startsWith(\"/\") ? original : \"/\" + original);\n}\n\n`;
    s = s.replace(anchor, helper + anchor);
  }

  const htmlAnchor = '    let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")';
  if (!s.includes(htmlAnchor)) throw new Error("server.js HTML route anchor missing");

  if (!s.includes("NIGHTCAMFINDS_SEO_FINAL_V1_HTML")) {
    const marker = '    /* NIGHTCAMFINDS_SEO_FINAL_V1_HTML */\n';
    s = s.replace(htmlAnchor, marker + htmlAnchor);
  }

  if (!s.includes('.replaceAll("__CANONICAL__", ncfCanonicalUrl(req, pathname))')) {
    const originLine = '      .replaceAll("__ORIGIN__", pageOrigin(req))';
    if (!s.includes(originLine)) throw new Error("server.js origin replacement missing");
    s = s.replace(originLine, originLine + '\n      .replaceAll("__CANONICAL__", ncfCanonicalUrl(req, pathname))\n      .replaceAll("__OG_URL__", ncfCanonicalUrl(req, pathname))');
  }

  fs.writeFileSync(SERVER, s);
}

function patchRoute() {
  let s = fs.readFileSync(ROUTE, "utf8");

  if (s.includes(MARKER)) return;

  const anchor = 'const originalCreateServer = http.createServer;\n';
  if (!s.includes(anchor)) throw new Error("route.js createServer anchor missing");

  const helper = `\n// ${MARKER}\nconst NCF_SEO_PATHS = new Set([\n  "/", "/live/", "/female/", "/male/", "/trans/", "/couples/",\n  "/hd/", "/new/", "/popular/", "/countries/", "/broadcast"\n]);\n\nfunction ncfRedirectNoSlash(req, res) {\n  const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");\n  const p = current.pathname;\n  const needsSlash = /^\\/(live|female|male|trans|couples|hd|new|popular|countries)$/.test(p) || /^\\/country\\/[a-z]{2}$/i.test(p);\n  if (!needsSlash) return false;\n  current.pathname = p + "/";\n  res.writeHead(301, { Location: current.pathname + current.search, "Cache-Control": "public, max-age=3600" });\n  res.end();\n  return true;\n}\n\nfunction ncfRewriteSeoRequest(req) {\n  const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");\n  const p = current.pathname;\n  if (NCF_SEO_PATHS.has(p) || /^\\/country\\/[a-z]{2}\\/$/i.test(p)) {\n    req.seoOriginalPathname = p;\n    req.url = "/" + current.search;\n  }\n}\n\n`;
  s = s.replace(anchor, anchor + helper);

  const listener = '  return originalCreateServer.call(http, async (req, res) => {\n';
  if (!s.includes(listener)) throw new Error("route.js server listener anchor missing");
  s = s.replace(listener, listener + '    if (ncfRedirectNoSlash(req, res)) return;\n    ncfRewriteSeoRequest(req);\n');

  fs.writeFileSync(ROUTE, s);
}

patchServer();
patchRoute();
console.log("NightCamFinds final SEO route patch applied");
