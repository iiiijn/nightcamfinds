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

const mockRoom = (id, platform, gender, displayName, viewerCount) => ({
  id, platform, gender, displayName, viewerCount, roomSubject: "Responsive test room",
  country: "US", countryName: "United States", isHd: true, isNew: false, image: ""
});

const roomFeed = {
  rooms: [
    mockRoom("mock-cb-female", "chaturbate", "female", "Mock Chaturbate Room", 245),
    mockRoom("mock-bonga-male", "bongacams", "male", "Mock BongaCams Room", 128)
  ],
  countries: ["US", "GB", "CA"],
  regions: ["North America"],
  languages: ["English"],
  popularTags: [{ tag: "test", count: 2 }],
  liveCount: 2,
  hasMore: false,
  notice: "",
  topChaturbateByCategory: {
    female: [mockRoom("mock-top-female", "chaturbate", "female", "Popular Female Test Room", 245)]
  },
  topBongaByCategory: {},
  regionalRooms: {
    "North America": [
      mockRoom("mock-regional-cb", "chaturbate", "female", "Regional Chaturbate Test", 245),
      mockRoom("mock-regional-bonga", "bongacams", "male", "Regional BongaCams Test", 128)
    ]
  }
};

(async () => {
  const server = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const failures = [];
    page.on("pageerror", error => failures.push("Page error: " + error.message));
    await page.addInitScript(() => localStorage.setItem("ncf18", "1"));
    await page.route("**/api/rooms**", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(roomFeed)
    }));
    const address = server.address();
    await page.goto("http://127.0.0.1:" + address.port + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("#category-rows .card");

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
        const directoryLayout = document.querySelector(".directory-layout");
        const directoryMain = document.querySelector(".directory-main");
        const categoryRows = document.querySelector("#category-rows");
        const featuredPanel = document.querySelector(".featured-panel");
        const nav = document.querySelector(".category-nav");
        const categoryCards = [...document.querySelectorAll("#category-rows .card")];
        const featuredCards = [...document.querySelectorAll(".featured-panel .card")];
        const watchActions = [...document.querySelectorAll("#category-rows .card .btn")]
          .filter(element => /Watch on (Chaturbate|BongaCams)/.test(element.textContent));
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
          directoryLayoutRect: rect(directoryLayout),
          directoryMainRect: rect(directoryMain),
          categoryRowsRect: rect(categoryRows),
          featuredPanelRect: rect(featuredPanel),
          featuredPanelParent: featuredPanel?.parentElement?.className || "",
          navRect: rect(nav),
          topbarRect: rect(header),
          roomSizeFilter: !!document.querySelector("#room-size"),
          regionFilter: !!document.querySelector("#region"),
          featuredRoom: featuredCards.length > 0,
          countryShortcuts: !!document.querySelector("#quick"),
          categoryCardCount: categoryCards.length,
          watchActionCount: watchActions.length,
          categoryCardsVisible: categoryCards.every(card => {
            const r = card.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
        };
      });
      if (result.documentWidth > viewport.width) failures.push(viewport.name + ": horizontal overflow (" + result.documentWidth + "px > " + viewport.width + "px)");
      if (!result.title.includes("Who's live in your country")) failures.push(viewport.name + ": homepage heading missing");
      if (!result.roomSizeFilter || !result.regionFilter) failures.push(viewport.name + ": directory filters missing");
      if (!result.featuredRoom || !result.countryShortcuts) failures.push(viewport.name + ": featured room or country shortcuts missing");
      if (!result.featuredPanelRect || result.featuredPanelRect.width <= 0 || result.featuredPanelRect.height <= 0) failures.push(viewport.name + ": featured panel is not visibly laid out");
      if (!result.directoryLayoutRect || result.directoryLayoutRect.width < viewport.width * 0.8) failures.push(viewport.name + ": directory layout does not use the available page width");
      if (!result.directoryMainRect || result.directoryMainRect.width < viewport.width * 0.45) failures.push(viewport.name + ": main room directory is too narrow");
      if (!result.categoryRowsRect || result.categoryRowsRect.width <= 0 || result.categoryRowsRect.height <= 0) failures.push(viewport.name + ": category room rows are not visibly laid out");
      if (viewport.width > 980 && result.sidebarRect && result.directoryMainRect && result.sidebarRect.left < result.directoryMainRect.right - 2) failures.push(viewport.name + ": desktop sidebar overlaps the main directory");
      if (result.navRect && result.topbarRect && viewport.width <= 640 && result.navRect.top < result.topbarRect.bottom - 2) failures.push(viewport.name + ": category navigation overlaps the topbar");
      if (result.categoryCardCount < 2 || result.watchActionCount < 2 || !result.categoryCardsVisible) {
        failures.push(viewport.name + ": mock room cards or Watch actions did not render visibly");
      }
      console.log(JSON.stringify({ viewport: viewport.name, ...result }));
      await page.screenshot({ path: "responsive-" + viewport.name + ".png", fullPage: true });
    }

    if (failures.length) {
      console.error("Responsive browser verification failed:\\n- " + failures.join("\\n- "));
      process.exitCode = 1;
    } else {
      console.log("Responsive browser verification passed with mock room cards at 320, 390, 768 and 1366 pixels.");
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
