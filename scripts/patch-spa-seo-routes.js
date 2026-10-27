const fs = require("fs");

const FILE = "route.js";
const OLD_MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V6";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V7";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route V7 patch already applied");
  process.exit(0);
}

const helper = `
// ${MARKER}
function applySeoRouteMetadataBuffered(req, res) {
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
        const origin = `${proto}://${host}`.replace(/\\/$/, "");
        const canonical = origin + (pathname.startsWith("/") ? pathname : `/${pathname}`);
        let html = Buffer.concat(chunks).toString("utf8");

        html = html
          .replace(/<link\\s+rel=["']canonical["']\\s+href=["'][^"']*["'][^>]*>/i,
            `<link rel="canonical" href="${canonical}">`)
          .replace(/(<meta\\s+property=["']og:url["']\\s+content=["'])[^"']*(["'][^>]*>)/i,
            `$1${canonical}$2`)
          .replace(/__CANONICAL__/g, canonical)
          .replace(/__OG_URL__/g, canonical);

        return originalEnd.call(this, html, callback);
      }
    } catch (err) {
      console.error("SEO buffered route metadata rewrite failed:", err.message);
    }

    return originalEnd.call(this, Buffer.concat(chunks), callback);
  };

  // Keep the original write reference available for diagnostics and avoid an unused-variable warning.
  void originalWrite;
}

`;

const listenerAnchor = '  return originalCreateServer.call(http, async (req, res) => {\\n';
if (!s.includes(listenerAnchor)) {
  throw new Error("route.js server listener anchor not found");
}

if (!s.includes("function applySeoRouteMetadataBuffered(req, res)")) {
  s = s.replace(listenerAnchor, helper + listenerAnchor);
}

const callAnchor = "    applySeoRouteMetadata(req, res);\n";
if (s.includes(callAnchor) && !s.includes("applySeoRouteMetadataBuffered(req, res);")) {
  s = s.replace(callAnchor, callAnchor + "    applySeoRouteMetadataBuffered(req, res);\n");
} else if (!s.includes("applySeoRouteMetadataBuffered(req, res);")) {
  const rewriteAnchor = "    rewriteSeoSpaRequest(req);\n";
  if (!s.includes(rewriteAnchor)) throw new Error("route.js SEO rewrite anchor not found");
  s = s.replace(rewriteAnchor, rewriteAnchor + "    applySeoRouteMetadataBuffered(req, res);\n");
}

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V7 with response buffering");
