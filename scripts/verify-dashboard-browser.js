"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const dashboardPath = path.resolve(__dirname, "../public/dashboard.html");
const requests = [];

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/dashboard.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(dashboardPath));
        return;
      }
      if (url.pathname === "/dashboard-business.js") {
        const businessScriptPath = path.resolve(__dirname, "../public/dashboard-business.js");
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        res.end(fs.readFileSync(businessScriptPath));
        return;
      }
      if (url.pathname === "/organic-landing-revenue.js") {
        const organicScriptPath = path.resolve(__dirname, "../public/organic-landing-revenue.js");
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        res.end(fs.readFileSync(organicScriptPath));
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        requests.push({ path: url.pathname, from: url.searchParams.get("from"), to: url.searchParams.get("to") });
        const body = url.pathname === "/api/auth/me"
          ? { authenticated: true, username: "browser-test" }
          : url.pathname === "/api/bongacash-reconciliation"
            ? { error: "Reconciliation unavailable in this test" }
            : url.pathname === "/api/dashboard-stats"
              ? { chaturbateClicks: null, bongacamsClicks: 0, totalClicks: 0, tier1Clicks: 0, bongaTier1Clicks: 0, registrations: null, purchases: null, earnings: null, bongacamsRegistrations: null, bongacamsPurchases: null, bongacamsEarnings: null }
              : {};
        res.writeHead(url.pathname === "/api/bongacash-reconciliation" ? 503 : 200, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
        return;
      }
      res.writeHead(404).end("Not found");
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  let browser;
  const failures = [];
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on("pageerror", error => failures.push("Page error: " + error.message));
    page.on("console", message => {
      // The reconciliation endpoint deliberately returns 503 in this fixture.
      // Its browser console message is expected and is asserted through API state.
      if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) {
        failures.push("Console error: " + message.text());
      }
    });
    page.on("requestfailed", request => failures.push("Request failed: " + request.method() + " " + request.url() + " (" + (request.failure()?.errorText || "unknown") + ")"));
    // The local server records inbound requests. Do not mix response events into
    // that list: a response is not a second request and can obscure ordering.
    const address = server.address();
    // Exercise the real dashboard authentication bootstrap against the local mock API.
    const initialStatsResponse = page.waitForResponse(response =>
      response.url().includes("/api/dashboard-stats") && response.request().method() === "GET");
    await page.goto("http://127.0.0.1:" + address.port + "/dashboard.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector("#dashboard")?.classList.contains("hidden"));
    await initialStatsResponse;
    // Wait for the dashboard loader to leave its initial state. If it reports an
    // error, fail immediately with the visible state and the API traffic that led to it.
    try {
      await page.waitForFunction(() => {
        const status = document.querySelector("#monthlyOverviewStatus")?.textContent?.trim();
        return Boolean(status) && status !== "Loading...";
      }, { timeout: 10000 });
    } catch {
      const state = await page.evaluate(() => ({
        dashboardVisible: !document.querySelector("#dashboard")?.classList.contains("hidden"),
        status: document.querySelector("#monthlyOverviewStatus")?.textContent,
        loginStatus: document.querySelector("#loginStatus")?.textContent
      }));
      throw new Error("Dashboard did not finish loading within 10 seconds. State: " + JSON.stringify(state) +
        ". API responses: " + JSON.stringify(requests) + ". Browser errors: " + JSON.stringify(failures));
    }
    const visibleStatus = await page.locator("#monthlyOverviewStatus").textContent();
    if (!visibleStatus?.startsWith("Updated ")) {
      const state = await page.evaluate(() => ({
        status: document.querySelector("#status")?.textContent,
      }));
      throw new Error("Dashboard loader reported an error instead of completing. State: " + JSON.stringify(state) +
        ". API responses: " + JSON.stringify(requests) + ". Browser errors: " + JSON.stringify(failures));
    }
    const dashboardSource = fs.readFileSync(dashboardPath, "utf8");
    if (!dashboardSource.includes("v===null||v===undefined?'Unavailable':Number(v).toLocaleString()")) failures.push("Missing numeric values are not guarded as Unavailable.");
    if (!dashboardSource.includes("v===null||v===undefined?'Unavailable':'$'+Number(v).toFixed(2)")) failures.push("Missing currency values are not guarded as Unavailable.");
    if (!dashboardSource.includes("const metric=v=>v===null||v===undefined?null:Number(v)")) failures.push("Dashboard API metrics are still coerced to zero when absent.");
    if (!dashboardSource.includes("const pct=(part,total)=>part===null||part===undefined||total===null||total===undefined?\'Unavailable\'")) failures.push("Missing percentage formatter or null guard.");
    if (!dashboardSource.includes("const conversionCount=regs===null||pur===null?null:regs+pur")) failures.push("Conversion count does not preserve unavailable inputs.");
    if (dashboardSource.includes("n(m.registrations||0)") || dashboardSource.includes("n(m.purchases||0)")) failures.push("BongaCash funnel still converts unavailable values to zero.");

    const expectedTabs = ["overview", "traffic", "investigation", "revenue", "health", "organic"];
    const visibleTabs = await page.locator("[data-dashboard-tab]").evaluateAll(nodes => nodes.map(node => node.dataset.dashboardTab));
    if (JSON.stringify(visibleTabs) !== JSON.stringify(expectedTabs)) failures.push("Expected only the two supported dashboard tabs; found " + visibleTabs.join(", "));
    for (const tab of expectedTabs) {
      const button = page.locator('[data-dashboard-tab="' + tab + '"]');
      if (await button.count() !== 1) {
        failures.push("Missing dashboard tab: " + tab);
        continue;
      }
      await button.click();
      await page.waitForFunction(value => {
        const selected = document.querySelector('[data-dashboard-tab="' + value + '"]');
        return selected?.getAttribute("aria-selected") === "true" &&
          [...document.querySelectorAll("[data-nav-group]")].every(panel => {
            const shouldBeHidden = panel.dataset.navGroup !== value;
            return panel.classList.contains("nav-hidden") === shouldBeHidden;
          });
      }, tab);
    }

    const viewports = [
      { name: "mobile", width: 320, height: 740 },
      { name: "mobile-large", width: 390, height: 844 },
      { name: "desktop", width: 1366, height: 900 }
    ];
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        nav: document.querySelector("#dashboardNav")?.getBoundingClientRect().toJSON()
      }));
      if (layout.document > viewport.width) failures.push(viewport.name + ": horizontal overflow (" + layout.document + "px)");
      if (!layout.nav || layout.nav.width <= 0) failures.push(viewport.name + ": dashboard navigation is not visible");
    }

    const displayedMetrics = await page.evaluate(() => ({
      totalEarnings: document.querySelector("#totalEarnings")?.textContent,
      conversion: document.querySelector("#conversion")?.textContent
    }));
    for (const [name, value] of Object.entries(displayedMetrics)) {
      if (value !== "Unavailable") failures.push(name + " should display Unavailable, received " + value);
    }
    // The global date-range controls refresh the active five-section dashboard panel.
    await page.locator('[data-dashboard-tab="overview"]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-dashboard-tab="overview"]')?.getAttribute("aria-selected") === "true");

    for (const range of ["today", "7", "30", "all"]) {
      await page.locator("#from").fill("");
      await page.locator("#to").fill("");
      // Wait for the response caused by this exact UI action. A fixed sleep can
      // accidentally inspect the preceding request when the browser is busy.
      const responsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === "/api/dashboard-stats" && response.request().method() === "GET";
      });
      await page.locator("#range").selectOption(range);
      const response = await responsePromise;
      const requestUrl = new URL(response.url());
      const from = requestUrl.searchParams.get("from");
      const to = requestUrl.searchParams.get("to");
      if (range === "all" && (from !== null || to !== null)) failures.push("All-time range unexpectedly sent date bounds: " + requestUrl.search);
      else if (range !== "all" && (!from || !to)) failures.push("Range " + range + " did not send both date bounds: " + requestUrl.search);
    }
    await page.locator("#from").fill("2026-11-01");
    await page.locator("#to").fill("2026-11-12");
    const customResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/dashboard-stats" && response.request().method() === "GET";
    });
    await page.locator("#apply").click();
    const customResponse = await customResponsePromise;
    const customUrl = new URL(customResponse.url());
    if (customUrl.searchParams.get("from") !== "2026-11-01" || customUrl.searchParams.get("to") !== "2026-11-12") {
      failures.push("Custom date range was not sent to dashboard-stats as the selected from/to period: " + customUrl.search);
    }

    if (failures.length) {
      console.error("Dashboard browser verification failed:\n- " + failures.join("\n- "));
      process.exitCode = 1;
    } else {
      console.log("Dashboard browser verification passed: all tabs, mobile/desktop layouts and custom date range.");
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
