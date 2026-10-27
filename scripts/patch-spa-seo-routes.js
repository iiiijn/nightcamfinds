const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V8";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route V8 patch already applied");
  process.exit(0);
}

const helper = `
// ${MARKER}
const NCF_SEO_PATHS_V8 = new Set([
  "/",
  "/live/",
  "/female/",
  "/male/",
  "/trans/",
  "/couples/",
  "/hd/",
  "/new/",
  "/popular/",
  "/countries/",
  "/broadcast"
]);

function ncfRedirectSeoNoSlashV8(req, res) {
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

function ncfRewriteSeoRequestV8(req) {
  try {
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    const pathname = current.pathname;
    if (NCF_SEO_PATHS_V8.has(pathname) || /^\\/country\\/[a-z]{2}\\/$/i.test(pathname)) {
      req.seoOriginalPathname = pathname;
      req.url = "/" + current.search;
    }
  } catch {}
}

function ncfApplySeoRouteMetadataV8(req, res) {
  const pathname = String(req.seoOriginalPathname || "");
  if (!pathname) return;

  const originalWrite = res.write;
  const originalEnd = res.end;
  const chunks = [];
  let ended = false;

  res.write = function seoBufferedWrite(chunk, encoding, callback) {
    if (ended) return false;
    if (chunk !== undefined && chunk !== null) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
    }
    return true;
  };

  res.end = function seoBufferedEnd(chunk, encoding, callback) {
    if (ended) return res;
    ended = true;

    if (chunk !== undefined && chunk !== null) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
    }

    try {
      const contentType = String(res.getHeader("content-type") || "").toLowerCase();
      if (!contentType || contentType.includes("text/html")) {
        const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
        const host = String(req.headers["x-forwarded-host"] || req.headers.host || "nightcamfinds.com").split(",")[0].trim();
        const origin = proto + "://" + host;
        const canonical = origin + (pathname.startsWith("/") ? pathname : "/" + pathname);
        let html = Buffer.concat(chunks).toString("utf8");

        html = html
          .replace(/<link\\s+rel=["']canonical["']\\s+href=["'][^"']*["'][^>]*>/i,
            '<link rel="canonical" href="' + canonical + '">')
          .replace(/(<meta\\s+property=["']og:url["']\\s+content=["'])[^"']*(["'][^>]*>)/i,
            '$1' + canonical + '$2')
          .replace(/__CANONICAL__/g, canonical)
          .replace(/__OG_URL__/g, canonical);

        return originalEnd.call(this, html, callback);
      }
    } catch (err) {
      console.error("SEO buffered route metadata rewrite failed:", err.message);
    }

    return originalEnd.call(this, Buffer.concat(chunks), callback);
  };

  void originalWrite;
}

`;

const listenerAnchor = '  return originalCreateServer.call(http, async (req, res) => {\n';
if (!s.includes(listenerAnchor)) {
  throw new Error("route.js server listener anchor not found");
}

s = s.replace(listenerAnchor, helper + listenerAnchor);

const listenerBodyAnchor = listenerAnchor +
  '    if (ncfRedirectSeoNoSlashV8(req, res)) return;\n' +
  '    ncfRewriteSeoRequestV8(req);\n' +
  '    ncfApplySeoRouteMetadataV8(req, res);\n';

if (!s.includes(listenerBodyAnchor)) {
  const insertion =
    '    if (ncfRedirectSeoNoSlashV8(req, res)) return;\n' +
    '    ncfRewriteSeoRequestV8(req);\n' +
    '    ncfApplySeoRouteMetadataV8(req, res);\n';
  s = s.replace(listenerAnchor, listenerAnchor + insertion);
}

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V8 with route rewriting and buffered metadata");
