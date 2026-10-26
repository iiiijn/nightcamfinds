const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V1";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route patch already applied");
  process.exit(0);
}

const anchor = "const originalCreateServer = http.createServer;";
if (!s.includes(anchor)) {
  throw new Error("route.js createServer anchor not found");
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

function createSeoAwareServer(...args) {
  if (typeof args[0] !== "function") return originalCreateServer(...args);
  const listener = args[0];
  args[0] = (req, res) => {
    rewriteSeoSpaRequest(req);
    return listener(req, res);
  };
  return originalCreateServer(...args);
}
`;

s = s.replace(anchor, anchor + helper);

// Wrap every application call to originalCreateServer, while leaving the wrapper's
// own calls pointed at the real Node constructor.
s = s.replace(/\\boriginalCreateServer\\(/g, "createSeoAwareServer(");
s = s.replace(/function createSeoAwareServer\\(\.\.\.args\\) \\{([\\s\\S]*?)\\n\\}/, (match, body) => {
  const fixed = body.replace(/createSeoAwareServer\\(\.\.\.args\\)/g, "originalCreateServer(...args)");
  return `function createSeoAwareServer(...args) {${fixed}\n}`;
});

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch");
