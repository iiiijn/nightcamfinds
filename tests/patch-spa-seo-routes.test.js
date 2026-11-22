const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const patchScript = path.join(__dirname, "..", "scripts", "patch-spa-seo-routes.js");
const listenerAnchor = "  return originalCreateServer.call(http, async (req, res) => {";

for (const newline of ["\n", "\r\n"]) {
  test(`SPA SEO route patch migrates legacy V14 and remains idempotent with ${newline === "\r\n" ? "CRLF" : "LF"} line endings`, () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-seo-line-endings-"));
    try {
      const routePath = path.join(projectDir, "route.js");
      fs.writeFileSync(routePath, [
        "const http = require('http');",
        "const originalCreateServer = http.createServer;",
        "// NIGHTCAMFINDS_SPA_SEO_ROUTES_V14",
        "function ncfRedirectSeoNoSlashV14(req, res) { return false; }",
        "function ncfRewriteSeoRequestV14(req) {}",
        "function ncfApplySeoRouteMetadataV14(req, res) {}",
        "http.createServer = function routeDashboard(handler) {",
        listenerAnchor,
        "    if (ncfRedirectSeoNoSlashV14(req, res)) return;",
        "    ncfRewriteSeoRequestV14(req);",
        "    ncfApplySeoRouteMetadataV14(req, res);",
        "    return handler(req, res);",
        "  });",
        "};",
        ""
      ].join(newline), "utf8");

      execFileSync(process.execPath, [patchScript], { cwd: projectDir, stdio: "pipe" });
      const patched = fs.readFileSync(routePath, "utf8");
      assert.ok(patched.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V15"));
      assert.ok(patched.includes(listenerAnchor + newline));
      assert.ok(patched.includes("ncfRedirectSeoNoSlashV15(req, res)"));
      assert.ok(patched.includes("ncfRewriteSeoRequestV15(req)"));
      assert.ok(!patched.includes("NIGHTCAMFINDS_SPA_SEO_ROUTES_V14"));
      assert.ok(!patched.includes("ncfApplySeoRouteMetadataV14"));
      assert.ok(!patched.includes("ncfRewriteSeoRequestV14(req)"));
      assert.ok(!patched.includes("ncfRedirectSeoNoSlashV14(req, res)"));

      execFileSync(process.execPath, [patchScript], { cwd: projectDir, stdio: "pipe" });
      assert.equal(fs.readFileSync(routePath, "utf8"), patched);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
}
