const fs = require("fs");

const SERVER = "server.js";
const ROUTE = "route.js";
const MARKER = "NIGHTCAMFINDS_SEO_FINAL_V2";

function patchServer() {
  let s = fs.readFileSync(SERVER, "utf8");

  if (!s.includes("function ncfCanonicalUrl(req, pathname)")) {
    const anchor = "function pageOrigin(req) {";
    if (!s.includes(anchor)) throw new Error("server.js pageOrigin anchor missing");
    const helper = `function ncfCanonicalUrl(req, pathname) {\n  const configuredOrigin = String(process.env.PUBLIC_ORIGIN || "").replace(/\\/$/, "");\n  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();\n  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "nightcamfinds.com").split(",")[0].trim();\n  const origin = configuredOrigin || (host ? proto + "://" + host : "https://nightcamfinds.com");\n  const original = String(req.seoOriginalPathname || pathname || "/");\n  return origin + (original.startsWith("/") ? original : "/" + original);\n}\n\n`;
    s = s.replace(anchor, helper + anchor);
  }

  const htmlAnchor = '    let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")';
  if (!s.includes(htmlAnchor)) throw new Error("server.js HTML route anchor missing");

  if (!s.includes("NIGHTCAMFINDS_SEO_FINAL_V2_HTML")) {
    const marker = '    /* NIGHTCAMFINDS_SEO_FINAL_V2_HTML */\n';
    s = s.replace(htmlAnchor, marker + htmlAnchor);
  }

  const originLine = '      .replaceAll("__ORIGIN__", pageOrigin(req))';
  if (!s.includes(originLine)) throw new Error("server.js origin replacement missing");

  if (!s.includes('.replaceAll("__CANONICAL__", ncfCanonicalUrl(req, pathname))')) {
    s = s.replace(originLine, originLine + '\n      .replaceAll("__CANONICAL__", ncfCanonicalUrl(req, pathname))\n      .replaceAll("__OG_URL__", ncfCanonicalUrl(req, pathname))');
  }

  fs.writeFileSync(SERVER, s);
}

function verifyRoutePatch() {
  const s = fs.readFileSync(ROUTE, "utf8");
  const hasSeoRouter = s.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V8") || s.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V6") || s.includes("NIGHTCAMFINDS_SEO_FINAL_V2");
  const hasOriginalPath = s.includes("req.seoOriginalPathname");
  if (!hasSeoRouter || !hasOriginalPath) {
    throw new Error("route.js is missing the route-aware SEO rewrite; patch-spa-seo-routes.js must run before patch-seo-final.js");
  }
}

patchServer();
verifyRoutePatch();
console.log("NightCamFinds final SEO route patch V2 applied");
