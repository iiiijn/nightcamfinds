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

const helper = `\n// ${MARKER}\nconst SEO_SPA_PATHS = new Set([\n  "/", "/live/", "/female/", "/male/", "/trans/", "/couples/",\n  "/hd/", "/new/", "/popular/", "/countries/",\n  "/about", "/privacy", "/terms", "/contact", "/affiliate-disclosure", "/broadcast"\n]);\n\nfunction isSeoSpaPath(urlValue) {\n  try {\n    const pathname = new URL(String(urlValue || "/"), "http://nightcamfinds.local").pathname;\n    if (SEO_SPA_PATHS.has(pathname)) return true;\n    return /^\\/country\\/[a-z]{2}\\/?$/i.test(pathname);\n  } catch {\n    return false;\n  }\n}\n\nfunction rewriteSeoSpaRequest(req) {\n  if (!isSeoSpaPath(req.url)) return;\n  const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");\n  req.url = "/" + current.search;\n}\n\nfunction createSeoAwareServer(...args) {\n  if (typeof args[0] !== "function") return originalCreateServer(...args);\n  const listener = args[0];\n  args[0] = (req, res) => {\n    rewriteSeoSpaRequest(req);\n    return listener(req, res);\n  };\n  return originalCreateServer(...args);\n}\n`;

s = s.replace(anchor, anchor + helper);
s = s.replace(/\boriginalCreateServer\(/g, "createSeoAwareServer(");
s = s.replace("const originalCreateServer = http.createServer;\n// " + MARKER, "const originalCreateServer = http.createServer;\n// " + MARKER);

// The wrapper itself must still call the original server constructor.
s = s.replace("return createSeoAwareServer(...args);\n  const listener", "return originalCreateServer(...args);\n  const listener");
s = s.replace("return createSeoAwareServer(...args);\n  };\n  return createSeoAwareServer(...args);", "return originalCreateServer(...args);\n  };\n  return originalCreateServer(...args);");

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch");
