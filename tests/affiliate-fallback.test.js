const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
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

test("affiliate redirects survive database write failures and fall back to local click storage", async t => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-fallback-stats-"));
  const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-fallback-modules-"));
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-fallback-project-"));
  fs.cpSync(process.cwd(), projectDir, {
    recursive: true,
    filter: source => !source.split(path.sep).includes(".git") && !source.split(path.sep).includes("node_modules")
  });

  const pgStub = path.join(stubRoot, "pg");
  fs.mkdirSync(pgStub, { recursive: true });
  fs.writeFileSync(
    path.join(pgStub, "index.js"),
    "class Pool { constructor() {} async query() { throw new Error('Simulated database outage'); } end() {} } module.exports = { Pool };"
  );

  execFileSync(process.execPath, ["scripts/fix-server-syntax.js"], { cwd: projectDir, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/patch-spa-seo-routes.js"], { cwd: projectDir, stdio: "pipe" });

  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["-e", "require('./route.js')"], {
    cwd: projectDir,
    env: {
      ...process.env,
      NODE_PATH: [stubRoot, process.env.NODE_PATH || ""].filter(Boolean).join(path.delimiter),
      PORT: String(port),
      DATA_DIR: dataDir,
      DATABASE_URL: "postgres://test.invalid/nightcamfinds",
      CB_TOUR: "fallbackTour",
      CB_CAMPAIGN: "fallbackCampaign",
      BONGACAMS_CAMPAIGN: "fallbackBongaCampaign",
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

  const response = await fetch(
    `${baseUrl}/go/fallbackmodel?utm_source=fallback-test&utm_campaign=db-down&src=fallback-card&cat=female`,
    { redirect: "manual", headers: { "cf-ipcountry": "CA", "user-agent": "NightCamFinds fallback test" } }
  );
  assert.equal(response.status, 302);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.hostname, "chaturbate.com");
  assert.equal(target.searchParams.get("room"), "fallbackmodel");
  assert.equal(target.searchParams.get("source"), "fallback-test");
  assert.equal(target.searchParams.get("campaign"), "db-down");
  assert.match(target.searchParams.get("click_id") || "", /^ncf_[a-z0-9]+_[a-f0-9]+$/);

  const stats = JSON.parse(fs.readFileSync(path.join(dataDir, "clicks.json"), "utf8"));
  assert.equal(stats.total, 1);
  assert.equal(stats.byPlatform.chaturbate, 1);
  assert.equal(stats.countries.CA, 1);
  assert.equal(stats.bySource["fallback-test"], 1);
  assert.equal(stats.byPlacement["chaturbate:fallback-card"], 1);
  assert.match(child.testStderr, /falling back to local storage/i);
});
