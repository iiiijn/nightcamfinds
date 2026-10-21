const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const originalCreateServer = http.createServer;

http.createServer = function routeDashboard(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");

    if (incoming.pathname === "/dashboard" || incoming.pathname === "/dashboard/") {
      const html = fs.readFileSync(path.join(__dirname, "public", "dashboard.html"), "utf8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      return res.end(html);
    }

    return handler(req, res);
  });
};

require("./start.js");
