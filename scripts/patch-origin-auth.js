"use strict";

const fs = require("node:fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_ORIGIN_AUTH_V1";
const REQUIRE_LINE = 'const { originRequestAllowed } = require("./src/services/origin-auth.cjs");';
const ANCHOR = '    const incoming = new URL(req.url, "http://localhost");';

function patchSource(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes('const http = require("http");')) {
    throw new Error("origin-auth patch could not find the route.js imports");
  }
  if (!source.includes(ANCHOR)) {
    throw new Error("origin-auth patch could not find the route request entry point");
  }

  let next = source.replace(
    'const http = require("http");',
    'const http = require("http");\n' + REQUIRE_LINE
  );
  const guard = `${ANCHOR}
    // ${MARKER}
    if (!originRequestAllowed({ headers: req.headers, pathname: incoming.pathname })) {
      return sendJson(res, 403, { error: "Origin verification failed." });
    }`;
  next = next.replace(ANCHOR, guard);
  if (!next.includes(MARKER) || !next.includes(REQUIRE_LINE)) {
    throw new Error("origin-auth patch did not apply cleanly");
  }
  return next;
}

if (require.main === module) {
  const source = fs.readFileSync(FILE, "utf8");
  const next = patchSource(source);
  if (next !== source) {
    fs.writeFileSync(FILE, next);
    console.log("NightCamFinds Cloudflare origin-auth guard applied");
  } else {
    console.log("NightCamFinds Cloudflare origin-auth guard already applied");
  }
}

module.exports = { patchSource, MARKER };
