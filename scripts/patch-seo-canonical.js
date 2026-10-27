const fs = require("fs");

const TEMPLATE_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_TEMPLATE_V6";
const SERVER_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_SERVER_V6";

function patchFile(file, apply) {
  const current = fs.readFileSync(file, "utf8");
  const next = apply(current);
  if (next !== current) {
    fs.writeFileSync(file, next);
    console.log(`Applied SEO canonical patch to ${file}`);
  } else {
    console.log(`SEO canonical patch already applied to ${file}`);
  }
}

patchFile("public/index.html", s => {
  if (!s.includes("__CANONICAL__")) throw new Error("public/index.html is missing the __CANONICAL__ placeholder");
  if (s.includes(TEMPLATE_MARKER)) return s;
  return s + `\n<!-- ${TEMPLATE_MARKER} -->\n`;
});

patchFile("server.js", s => {
  const helper = `function canonicalUrl(req, pathname) {
  const configuredOrigin = String(process.env.PUBLIC_ORIGIN || "").replace(/\\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const origin = configuredOrigin || (forwardedHost ? forwardedProto + "://" + forwardedHost : ORIGIN);
  const originalPath = String(req.seoOriginalPathname || pathname || "/");
  return origin + (originalPath.startsWith("/") ? originalPath : "/" + originalPath);
}

`;
  if (!s.includes("function canonicalUrl(req, pathname)")) {
    const anchor = "function pageOrigin(req) {";
    if (!s.includes(anchor)) throw new Error("server.js pageOrigin anchor missing");
    s = s.replace(anchor, helper + anchor);
  }

  const anchor = '    let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")';
  if (!s.includes(anchor)) throw new Error("server.js HTML route anchor missing");
  const routeCanonical = '    const canonical = canonicalUrl(req, pathname);\n';
  if (!s.includes(routeCanonical + anchor)) {
    s = s.replace(anchor, routeCanonical + anchor);
  }
  if (!s.includes('.replaceAll("__CANONICAL__", canonical)')) {
    const originAnchor = '.replaceAll("__ORIGIN__", pageOrigin(req))';
    if (!s.includes(originAnchor)) throw new Error("server.js origin replacement anchor missing");
    s = s.replace(originAnchor, originAnchor + '\n      .replaceAll("__CANONICAL__", canonical)');
  }
  if (!s.includes('.replaceAll("__OG_URL__", canonical)')) {
    const originAnchor = '.replaceAll("__ORIGIN__", pageOrigin(req))';
    s = s.replace(originAnchor, originAnchor + '\n      .replaceAll("__OG_URL__", canonical)');
  }
  if (s.includes(SERVER_MARKER)) return s;
  return s + `\n// ${SERVER_MARKER}\n`;
});

console.log("NightCamFinds SEO canonical patch V6 complete");
