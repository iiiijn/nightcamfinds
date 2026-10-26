const fs = require("fs");

const TEMPLATE_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_TEMPLATE_V1";
const SERVER_MARKER = "NIGHTCAMFINDS_SEO_CANONICAL_SERVER_V1";

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

// public/index.html is already using the __CANONICAL__ placeholder in the repository.
// Accept that state instead of looking for the old __ORIGIN__/ anchors.
patchFile("public/index.html", s => {
  if (!s.includes("__CANONICAL__")) {
    throw new Error("public/index.html is missing the __CANONICAL__ placeholder");
  }
  if (s.includes(TEMPLATE_MARKER)) return s;
  return s + `\n<!-- ${TEMPLATE_MARKER} -->\n`;
});

// Replace the canonical placeholder at request time so every trailing-slash
// landing page gets its own self-referencing canonical URL.
patchFile("server.js", s => {
  if (s.includes(SERVER_MARKER)) return s;

  const anchor = /\.replace\("__LANG__",\s*langFor\(forced \? forced\[1\] : visitorCountry\(req\)\)\);/;
  if (!anchor.test(s)) {
    throw new Error("server.js canonical replacement anchor missing");
  }

  const replacement = `.replace("__LANG__", langFor(forced ? forced[1] : visitorCountry(req)))\n      .replaceAll("__CANONICAL__", pageOrigin(req) + (pathname === "/" ? "/" : pathname));`;

  return s.replace(anchor, replacement) + `\n// ${SERVER_MARKER}\n`;
});

console.log("NightCamFinds SEO canonical patch complete");
