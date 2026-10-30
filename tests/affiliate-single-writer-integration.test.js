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
    if (child.exitCode !== null) throw new Error(`Test server exited early: ${child.testStderr}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become ready");
}

test("each production affiliate redirect writes one click and one matching platform ledger row", async t => {
  const port = await freePort();
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-single-writer-project-"));
  const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-single-writer-modules-"));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-single-writer-data-"));
  const queryLog = path.join(dataDir, "queries.jsonl");
  fs.cpSync(process.cwd(), projectDir, {
    recursive: true,
    filter: source => !source.split(path.sep).includes(".git") && !source.split(path.sep).includes("node_modules")
  });

  const pgStub = path.join(stubRoot, "pg");
  fs.mkdirSync(pgStub, { recursive: true });
  fs.writeFileSync(path.join(pgStub, "index.js"), `
const fs = require("node:fs");
class Pool {
  async query(sql, params = []) {
    const text = String(sql);
    fs.appendFileSync(process.env.PG_QUERY_LOG, JSON.stringify({ sql: text, params }) + "\\n");
    if (/INSERT INTO affiliate_clicks/i.test(text)) return { rows: [{ id: 101 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  }
  async end() {}
}
module.exports = { Pool };
`);

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
      PG_QUERY_LOG: queryLog,
      CB_TOUR: "testTour",
      CB_CAMPAIGN: "testCampaign",
      BONGACAMS_CAMPAIGN: "840970",
      BONGACAMS_ENABLED: "false"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.testStderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { child.testStderr += chunk; });

  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(stubRoot, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, child);

  const cb = await fetch(`${baseUrl}/go/cbtestmodel?src=cb-single-writer&source=regression-test`, {
    redirect: "manual", headers: { "cf-ipcountry": "US", "user-agent": "single-writer-test" }
  });
  assert.equal(cb.status, 302);

  const bonga = await fetch(`${baseUrl}/bgo/bongatestmodel?src=bonga-single-writer&source=regression-test`, {
    redirect: "manual", headers: { "cf-ipcountry": "GB", "user-agent": "single-writer-test" }
  });
  assert.equal(bonga.status, 302);

  await new Promise(resolve => setTimeout(resolve, 150));
  const queries = fs.readFileSync(queryLog, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  const inserts = queries.filter(q => /INSERT INTO affiliate_clicks/i.test(q.sql));
  const cbLedger = queries.filter(q => /INSERT INTO cb_clicks/i.test(q.sql));
  const bongaLedger = queries.filter(q => /INSERT INTO bonga_clicks/i.test(q.sql));

  assert.equal(inserts.length, 2, "two redirects must produce exactly two primary click rows");
  assert.equal(cbLedger.length, 1, "the Chaturbate redirect must produce one Chaturbate ledger row");
  assert.equal(bongaLedger.length, 1, "the BongaCams redirect must produce one Bonga ledger row");
  assert.equal(inserts[0].params[9], cbLedger[0].params[0], "Chaturbate ledger must reuse the primary click ID");
  assert.equal(inserts[1].params[9], bongaLedger[0].params[1], "Bonga ledger must reuse the primary click ID");
});
