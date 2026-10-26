const fs = require("fs");

function patchFile(file, marker, apply) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) return;
  const next = apply(s);
  if (!next || next === s) throw new Error(`SEO canonical anchor not found in ${file}`);
  fs.writeFileSync(file, next);
  console.log(`Applied ${marker} to ${file}`);
}

patchFile("public/index.html", "NIGHTCAMFINDS_SEO_CANONICAL_TEMPLATE_V1", s => {
  const next = s
    .replaceAll('href="__ORIGIN__/"', 'href="__CANONICAL__"')
    .replaceAll('content="__ORIGIN__/"', 'content="__CANONICAL__"')
    .replaceAll('"url":"__ORIGIN__/"', '"url":"__CANONICAL__"');
  if (next === s) throw new Error("public/index.html canonical anchors missing");
  return next + "\n<!-- NIGHTCAMFINDS_SEO_CANONICAL_TEMPLATE_V1 -->\n";
});

patchFile("server.js", "NIGHTCAMFINDS_SEO_CANONICAL_SERVER_V1", s => {
  const anchor = '.replace("__LANG__", langFor(forced ? forced[1] : visitorCountry(req)));';
  const replacement = '.replace("__LANG__", langFor(forced ? forced[1] : visitorCountry(req)))\n      .replaceAll("__CANONICAL__", pageOrigin(req) + (pathname === "/" ? "/" : pathname));';
  if (!s.includes(anchor)) throw new Error("server index template anchor missing");
  return s.replace(anchor, replacement) + "\n// NIGHTCAMFINDS_SEO_CANONICAL_SERVER_V1\n";
});

console.log("NightCamFinds SEO canonical patch complete");
