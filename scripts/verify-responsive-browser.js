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
    await page.waitForSelector("#grid .card, #category-rows .card");

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
        const header = document.querySelector(".topbar");
        const grid = document.querySelector("#grid");
        const sidebar = document.querySelector(".bonga-promo-sidebar");
        const directoryLayout = document.querySelector(".directory-layout");
        const directoryMain = document.querySelector(".directory-main");
        const categoryRows = document.querySelector("#category-rows");
        const nav = document.querySelector(".category-nav");
        const shortcuts = document.querySelector("#quick");
        const directoryHeading = document.querySelector(".directory-section .section-heading");
        const heroCategories = document.querySelector(".hero-categories");
        const heroCategoryLinks = [...document.querySelectorAll(".hero-categories a")];
        const categoryCards = [...document.querySelectorAll("#grid .card, #category-rows .card")];
        const watchActions = [...document.querySelectorAll("#grid .card .btn, #category-rows .card .btn")]
          .filter(element => /Watch on (Chaturbate|BongaCams)/.test(element.textContent));
        const rect = element => {
          if (!element) return null;
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        };
        return {
          viewportWidth: window.innerWidth,
          documentWidth: Math.max(doc.scrollWidth, body.scrollWidth),
          headerRect: rect(header),
          gridRect: rect(grid),
          sidebarRect: rect(sidebar),
          directoryLayoutRect: rect(directoryLayout),
          directoryMainRect: rect(directoryMain),
          categoryRowsRect: rect(categoryRows),
          firstCategoryCardRect: rect(categoryCards[0]),
          navRect: rect(nav),
          navScrollWidth: nav?.scrollWidth || 0,
          navClientWidth: nav?.clientWidth || 0,
          shortcutsRect: rect(shortcuts),
          shortcutsScrollWidth: shortcuts?.scrollWidth || 0,
          shortcutsClientWidth: shortcuts?.clientWidth || 0,
          directoryHeadingRect: rect(directoryHeading),
          heroCategoriesRect: rect(heroCategories),
          heroCategoriesScrollWidth: heroCategories?.scrollWidth || 0,
          heroCategoriesClientWidth: heroCategories?.clientWidth || 0,
          heroCategoryLinksSingleLine: heroCategoryLinks.every(link => getComputedStyle(link).whiteSpace === "nowrap"),
          topbarRect: rect(header),
          roomSizeFilter: !!document.querySelector("#room-size"),
          regionFilter: !!document.querySelector("#region"),
          homepageHeadlineVisible: (() => { const el=document.querySelector(".directory-section .section-heading h2"); const r=el?.getBoundingClientRect(); return !!r && r.width>0 && r.height>0; })(),
          recruitmentBannerVisible: (() => { const el=document.querySelector(".broadcaster-sidebar"); const r=el?.getBoundingClientRect(); return !!r && r.width>0 && r.height>0 && !!el.querySelector(".creator-banner-art img") && !!el.querySelector(".creator-primary-cta") && !!el.querySelector('a[href="/broadcast/#platform-chaturbate"]') && !!el.querySelector('a[href="/broadcast/#platform-bongacams"]'); })(),
          directoryColumnCount: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
          headerControlsInsideViewport: [...document.querySelectorAll(".topbar .logo, .topbar #q, .topbar #country, .topbar .quick-exit")].every(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.left>=-1 && r.right<=window.innerWidth+1; }),
          countryHintRemoved: !document.querySelector("#country-hint, #quick"),
          modelFlagsVisible: [...document.querySelectorAll("#grid .model-country-flag, #category-rows .model-country-flag")].length > 0,
          saveButtonsRemoved: [...document.querySelectorAll(".favorite-toggle")].every(button => getComputedStyle(button).display === "none"),
          featuredPanelRemoved: !document.querySelector(".featured-panel"),
          independentDiscoveryVisible: !!document.querySelector(".directory-section .section-heading h2") && document.querySelector(".directory-section .section-heading h2").textContent.trim() === "Discover live models",
          heroLeadVisible: (() => { const el = document.querySelector("#top > .hero"); const r=el?.getBoundingClientRect(); return !!r && getComputedStyle(el).display !== "none" && r.width>0 && r.height>0; })(),
          heroPathsVisible: ["viewer","model"].every(path => { const el=document.querySelector(".hero-choice[data-ncf-path=\"" + path + "\"]"); const r=el?.getBoundingClientRect(); return !!r && r.width>0 && r.height>0; }),
          heroActionsVisible: (() => { const cards=[...document.querySelectorAll(".sidebar-filter-group")]; const titles=cards.map(el=>el.querySelector("h3")?.textContent.trim()); return titles.indexOf("Browse by region") < titles.indexOf("Room size") && titles.indexOf("Room size") < titles.indexOf("Popular tags"); })(),
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
      if (!result.homepageHeadlineVisible) failures.push(viewport.name + ": homepage headline is missing or hidden");
      if (!result.recruitmentBannerVisible) failures.push(viewport.name + ": creator artwork, primary CTA or platform signup links are missing");
      if (!result.headerControlsInsideViewport) failures.push(viewport.name + ": header controls are clipped outside the viewport");
      const expectedColumns = viewport.width > 980 ? 4 : viewport.width > 640 ? 3 : 2;
      if (result.directoryColumnCount !== expectedColumns) failures.push(viewport.name + ": expected " + expectedColumns + " directory columns but found " + result.directoryColumnCount);
      if (!result.roomSizeFilter || !result.regionFilter) failures.push(viewport.name + ": directory filters missing");
      if (!result.featuredPanelRemoved || !result.independentDiscoveryVisible) failures.push(viewport.name + ": expected homepage discovery label is missing or a removed featured panel returned");
      if (!result.heroActionsVisible) failures.push(viewport.name + ": ordered sidebar filter flow is not visible");
      if (!result.countryHintRemoved) failures.push(viewport.name + ": country hint or shortcut row remains");
      if (!result.modelFlagsVisible) failures.push(viewport.name + ": partner country flags are missing from model cards");
      if (!result.saveButtonsRemoved) failures.push(viewport.name + ": model Save controls are still present");
      if (!result.firstCategoryCardRect || result.firstCategoryCardRect.width <= 0 || result.firstCategoryCardRect.height <= 0) failures.push(viewport.name + ": first category room card has no visible footprint");
      if (!result.directoryLayoutRect || result.directoryLayoutRect.width < viewport.width * 0.8) failures.push(viewport.name + ": directory layout does not use the available page width");
      if (!result.directoryMainRect || result.directoryMainRect.width < viewport.width * 0.45) failures.push(viewport.name + ": main room directory is too narrow");
      
      if (viewport.width > 980 && result.sidebarRect && result.directoryMainRect && result.sidebarRect.left < result.directoryMainRect.right - 2) failures.push(viewport.name + ": desktop sidebar overlaps the main directory");
      if (result.navRect && result.topbarRect && viewport.width <= 640 && result.navRect.top < result.topbarRect.bottom - 2) failures.push(viewport.name + ": category navigation overlaps the topbar");
      if (viewport.width <= 640 && result.navScrollWidth > result.navClientWidth && result.navRect.height < 24) failures.push(viewport.name + ": scrollable category navigation has no usable touch height");
      if (viewport.width <= 640 && result.shortcutsScrollWidth > result.shortcutsClientWidth && result.shortcutsRect?.height <= 0) failures.push(viewport.name + ": country shortcuts are horizontally clipped without a visible row");
      
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
