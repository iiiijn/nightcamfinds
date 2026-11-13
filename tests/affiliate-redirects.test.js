const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited early with code ${child.exitCode}: ${child.testStderr || "no stderr captured"}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become ready");
}

test("affiliate redirect endpoints return tracked provider URLs and record click attribution", async t => {
  const port = await freePort();
  const bongaFeedPort = await freePort();
  let bongaFeedRequests = 0;
  const bongaFeed = http.createServer((req, res) => {
    bongaFeedRequests += 1;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ username: "testbongamodel", display_name: "Test Bonga Model", gender: "male", room_url: "https://www.bongacams.com/testbongamodel" }]));
  });
  await new Promise(resolve => bongaFeed.listen(bongaFeedPort, "127.0.0.1", resolve));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-redirect-stats-"));
  const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-redirect-modules-"));
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-redirect-project-"));
  fs.cpSync(process.cwd(), projectDir, {
    recursive: true,
    filter: source => !source.split(path.sep).includes(".git") && !source.split(path.sep).includes("node_modules")
  });
  const pgStub = path.join(stubRoot, "pg");
  fs.mkdirSync(pgStub, { recursive: true });
  fs.writeFileSync(path.join(pgStub, "index.js"), "class Pool { constructor() { throw new Error('Unexpected database pool creation in redirect test'); } } module.exports = { Pool };");
  const baseUrl = `http://127.0.0.1:${port}`;
  execFileSync(process.execPath, ["scripts/fix-server-syntax.js"], { cwd: projectDir, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/patch-country-directory.js"], { cwd: projectDir, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/patch-spa-seo-routes.js"], { cwd: projectDir, stdio: "pipe" });
  const child = spawn(process.execPath, ["-e", "require('./route.js')"], {
    cwd: projectDir,
    env: {
      ...process.env,
      NODE_PATH: [stubRoot, process.env.NODE_PATH || ""].filter(Boolean).join(path.delimiter),
      PORT: String(port),
      DATA_DIR: dataDir,
      DATABASE_URL: "",
      CB_TOUR: "testTour",
      CB_CAMPAIGN: "testCampaign",
      BONGACAMS_CAMPAIGN: "testBongaCampaign",
      BONGACAMS_API_BASE: `http://127.0.0.1:${bongaFeedPort}/promo.php`,
      BONGACAMS_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.testStdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => { child.testStdout += chunk; });
  child.testStderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { child.testStderr += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
    bongaFeed.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(stubRoot, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, child);

  const chaturbateResponse = await fetch(
    `${baseUrl}/go/testmodel?utm_source=redirect-test&utm_medium=unit-test&utm_campaign=cb-check&src=cb-test-card&cat=female`,
    { redirect: "manual", headers: { "cf-ipcountry": "US", "user-agent": "NightCamFinds redirect test" } }
  );
  assert.equal(chaturbateResponse.status, 302, `Chaturbate redirect returned ${chaturbateResponse.status}: ${await chaturbateResponse.text()}\\nstdout: ${child.testStdout}\\nstderr: ${child.testStderr}`);
  const chaturbateTarget = new URL(chaturbateResponse.headers.get("location"));
  assert.equal(chaturbateTarget.hostname, "chaturbate.com");
  assert.equal(chaturbateTarget.pathname, "/in/");
  assert.equal(chaturbateTarget.searchParams.get("tour"), "testTour");
  assert.equal(chaturbateTarget.searchParams.get("campaign"), "testCampaign");
  assert.equal(chaturbateTarget.searchParams.get("utm_campaign"), "cb-check");
  assert.equal(chaturbateTarget.searchParams.get("room"), "testmodel");
  assert.equal(chaturbateTarget.searchParams.get("track"), "cb-test-card");
  assert.equal(chaturbateTarget.searchParams.get("source"), "redirect-test");
  assert.equal(chaturbateTarget.searchParams.get("utm_medium"), "unit-test");
  assert.match(chaturbateTarget.searchParams.get("click_id") || "", /^ncf_[a-z0-9]+_[a-f0-9]+$/);
  assert.equal(chaturbateTarget.searchParams.get("sid"), chaturbateTarget.searchParams.get("click_id"));

  const placeholderResponse = await fetch(
    `${baseUrl}/go/directory?src=placeholder-test`,
    { redirect: "manual", headers: { "user-agent": "NightCamFinds redirect test" } }
  );
  assert.equal(placeholderResponse.status, 404);

  const bongaResponse = await fetch(
    `${baseUrl}/bgo/testbongamodel?utm_source=redirect-test&utm_medium=unit-test&utm_campaign=bonga-check&src=bonga-test-card&cat=male`,
    { redirect: "manual", headers: { "cf-ipcountry": "GB", "user-agent": "NightCamFinds redirect test" } }
  );
  assert.equal(bongaResponse.status, 302, `BongaCams redirect returned ${bongaResponse.status}: ${await bongaResponse.text()}\\nmock feed requests: ${bongaFeedRequests}\\nstdout: ${child.testStdout}\\nstderr: ${child.testStderr}`);
  const bongaTarget = new URL(bongaResponse.headers.get("location"));
  assert.equal(bongaTarget.hostname, "bngprm.com");
  assert.equal(bongaTarget.pathname, "/promo.php");
  assert.equal(bongaTarget.searchParams.get("type"), "direct_link");
  assert.equal(bongaTarget.searchParams.get("v"), "2");
  assert.equal(bongaTarget.searchParams.get("c"), "testBongaCampaign");
  assert.equal(bongaTarget.searchParams.get("models[]"), "testbongamodel");

  const statsPath = path.join(dataDir, "clicks.json");
  const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
  assert.equal(stats.total, 2);
  assert.equal(stats.byPlatform.chaturbate, 1);
  assert.equal(stats.byPlatform.bongacams, 1);
  assert.equal(stats.countries.US, 1);
  assert.equal(stats.countries.GB, 1);
  assert.equal(stats.bySource["redirect-test"], 2);
  assert.equal(stats.byPlacement["chaturbate:cb-test-card"], 1);
  assert.equal(stats.byPlacement["bongacams:bonga-test-card"], 1);
  assert.equal(stats.byRoom["chaturbate:testmodel"], 1);
  assert.equal(stats.byRoom["bongacams:testbongamodel"], 1);
});
