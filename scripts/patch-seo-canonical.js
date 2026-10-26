const fs = require("fs");

const TEMPLATE_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_TEMPLATE_V2";
const SERVER_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_SERVER_V2";

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
  if (!s.includes("__CANONICAL__")) {
    throw new Error("public/index.html is missing the __CANONICAL__ placeholder");
  }
  if (s.includes(TEMPLATE_MARKER)) return s;
  return s + `\n<!-- ${TEMPLATE_MARKER} -->\n`;
});

patchFile("server.js", s => {
  if (s.includes(SERVER_MARKER)) return s;

  const helper = `function canonicalUrl(req, pathname) {\n  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();\n  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();\n  const configuredOrigin = String(process.env.PUBLIC_ORIGIN || "").replace(/\\/$/, "");\n  const origin = configuredOrigin || (forwardedHost ? \`${forwardedProto}://${forwardedHost}\` : ORIGIN);\n  return origin + (pathname === "/" ? "/" : pathname);\n}\n\n`;

  if (!s.includes("function canonicalUrl(req, pathname)")) {
    const anchor = "function visitorCountry(req) {";
    if (!s.includes(anchor)) throw new Error("visitorCountry anchor missing in server.js");
    s = s.replace(anchor, helper + anchor);
  }

  const oldCanonical = '.replaceAll("__CANONICAL__", pageOrigin(req) + (pathname === "/" ? "/" : pathname));';
  const newCanonical = '.replaceAll("__CANONICAL__", canonicalUrl(req, pathname));';
  if (s.includes(oldCanonical)) {
    s = s.replace(oldCanonical, newCanonical);
  } else {
    const anchor = /\.replace\("__LANG__",\s*langFor\(forced \? forced\[1\] : visitorCountry\(req\)\)\);/;
    if (!anchor.test(s)) throw new Error("server.js language replacement anchor missing");
    s = s.replace(anchor, `.replace("__LANG__", langFor(forced ? forced[1] : visitorCountry(req)))\n      ${newCanonical}`);
  }

  return s + `\n// ${SERVER_MARKER}\n`;
});

console.log("NightCamFinds SEO canonical patch V2 complete");
