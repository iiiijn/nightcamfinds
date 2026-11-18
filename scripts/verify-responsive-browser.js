"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
    catch { res.writeHead(400).end("Bad request"); return; }
    const file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory()
      ? path.join(file, "index.html") : file;
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end("Not found"); return; }
      res.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

(async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const failures = [];
    page.on("pageerror", error => failures.push("Page error: " + error.message));
    const address = server.address();
    await page.goto("http://127.0.0.1:" + address.port + "/", { waitUntil: "networkidle" });

    for (const viewport of [
      { name: "mobile-small", width: 320, height: 740 },
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1366, height: 900 }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const title = document.querySelector("h1");
        const header = document.querySelector(".topbar");
        const grid = document.querySelector("#grid");
        const sidebar = document.querySelector(".bonga-promo-sidebar");
        const rect = element => {
          if (!element) return null;
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        };
        return {
          viewportWidth: window.innerWidth,
          documentWidth: Math.max(doc.scrollWidth, body.scrollWidth),
          title: title?.textContent?.trim() || "",
          titleRect: rect(title),
          headerRect: rect(header),
          gridRect: rect(grid),
          sidebarRect: rect(sidebar),
          roomSizeFilter: !!document.querySelector("#room-size"),
          regionFilter: !!document.querySelector("#region"),
          featuredRoom: !!document.querySelector("#featured-room"),
          countryShortcuts: !!document.querySelector("#quick")
        };
      });
      if (result.documentWidth > viewport.width) failures.push(viewport.name + ": horizontal overflow (" + result.documentWidth + "px > " + viewport.width + "px)");
      if (!result.title.includes("Who's live in your country")) failures.push(viewport.name + ": homepage heading missing");
      if (!result.roomSizeFilter || !result.regionFilter) failures.push(viewport.name + ": directory filters missing");
      if (!result.featuredRoom || !result.countryShortcuts) failures.push(viewport.name + ": featured room or country shortcuts missing");
      console.log(JSON.stringify({ viewport: viewport.name, ...result }));
      await page.screenshot({ path: "responsive-" + viewport.name + ".png", fullPage: true });
    }

    if (failures.length) {
      console.error("Responsive browser verification failed:\n- " + failures.join("\n- "));
      process.exitCode = 1;
    } else {
      console.log("Responsive browser verification passed at 320, 390, 768 and 1366 pixels.");
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
