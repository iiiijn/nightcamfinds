const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

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
  const child = spawn(process.execPath, ["-e", "require('./scripts/fix-server-syntax.js'); require('./scripts/patch-spa-seo-routes.js'); require('./route.js')"], {
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
      BONGACAMS_ENABLED: "false"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.testStderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { child.testStderr += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(stubRoot, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, child);

  const chaturbateResponse = await fetch(
    `${baseUrl}/go/testmodel?utm_source=redirect-test&utm_medium=unit-test&utm_campaign=cb-check&src=cb-test-card&cat=female`,
    { redirect: "manual", headers: { "cf-ipcountry": "US", "user-agent": "NightCamFinds redirect test" } }
  );
  assert.equal(chaturbateResponse.status, 302);
  const chaturbateTarget = new URL(chaturbateResponse.headers.get("location"));
  assert.equal(chaturbateTarget.hostname, "chaturbate.com");
  assert.equal(chaturbateTarget.pathname, "/in/");
  assert.equal(chaturbateTarget.searchParams.get("tour"), "testTour");
  assert.equal(chaturbateTarget.searchParams.get("campaign"), "testCampaign");
  assert.equal(chaturbateTarget.searchParams.get("room"), "testmodel");
  assert.equal(chaturbateTarget.searchParams.get("track"), "cb-test-card");
  assert.equal(chaturbateTarget.searchParams.get("source"), "redirect-test");
  assert.equal(chaturbateTarget.searchParams.get("medium"), "unit-test");
  assert.match(chaturbateTarget.searchParams.get("click_id") || "", /^ncf_[a-z0-9]+_[a-f0-9]+$/);

  const bongaResponse = await fetch(
    `${baseUrl}/bgo/testbongamodel?utm_source=redirect-test&utm_medium=unit-test&utm_campaign=bonga-check&src=bonga-test-card&cat=male`,
    { redirect: "manual", headers: { "cf-ipcountry": "GB", "user-agent": "NightCamFinds redirect test" } }
  );
  assert.equal(bongaResponse.status, 302);
  const bongaTarget = new URL(bongaResponse.headers.get("location"));
  assert.equal(bongaTarget.hostname, "bongacams4.com");
  assert.equal(bongaTarget.pathname, "/track");
  assert.equal(bongaTarget.searchParams.get("c"), "testBongaCampaign");
  assert.equal(bongaTarget.searchParams.get("track"), "bonga-test-card");
  assert.match(bongaTarget.searchParams.get("click_id") || "", /^ncf_[a-z0-9]+_[a-f0-9]+$/);

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
});
