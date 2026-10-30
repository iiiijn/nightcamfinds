const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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

function signedSession(username, secret) {
  const issuedAt = String(Date.now());
  const nonce = crypto.randomBytes(18).toString("hex");
  const payload = `${username}.${issuedAt}.${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Test server exited early with code ${child.exitCode}: ${child.testStderr || "no stderr captured"}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become ready");
}

test("country settings HTTP endpoints enforce session auth and return controlled no-database errors", async t => {
  const port = await freePort();
  const secret = crypto.randomBytes(32).toString("hex");
  const baseUrl = `http://127.0.0.1:${port}`;
  const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ncf-test-modules-"));
  const pgStub = path.join(stubRoot, "pg");
  fs.mkdirSync(pgStub, { recursive: true });
  fs.writeFileSync(path.join(pgStub, "index.js"), "class Pool { constructor() { throw new Error('Unexpected database pool creation in no-database test'); } } module.exports = { Pool };");
  const child = spawn(process.execPath, ["-e", "const cp=require('node:child_process'); for (const script of ['scripts/run-production-migrations.js','scripts/fix-server-syntax.js','scripts/patch-spa-seo-routes.js']) cp.execFileSync(process.execPath,[script],{stdio:'inherit'}); require('./route.js');"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_PATH: [stubRoot, process.env.NODE_PATH || ""].filter(Boolean).join(path.delimiter),
      PORT: String(port),
      SESSION_SECRET: secret,
      ADMIN_USER: "test-admin",
      ADMIN_PASSWORD: "test-only-password",
      DATABASE_URL: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.testStderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { stderr += chunk; child.testStderr += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  await waitForServer(baseUrl, child);

  const unauthenticatedGet = await fetch(`${baseUrl}/api/country-platform-settings`);
  assert.equal(unauthenticatedGet.status, 401);
  assert.deepEqual(await unauthenticatedGet.json(), { error: "Unauthorized" });

  const unauthenticatedPost = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      country: "DE",
      preferredPlatform: "bongacams",
      hypothesis: "Unverified test hypothesis"
    })
  });
  assert.equal(unauthenticatedPost.status, 401);
  assert.deepEqual(await unauthenticatedPost.json(), { error: "Unauthorized" });

  const cookie = `ncf_session=${encodeURIComponent(signedSession("test-admin", secret))}`;
  const authenticatedGet = await fetch(`${baseUrl}/api/country-platform-settings`, {
    headers: { Cookie: cookie }
  });
  assert.equal(authenticatedGet.status, 503);
  assert.match((await authenticatedGet.json()).error, /Database is not configured/);

  const authenticatedPost = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      country: "DE",
      preferredPlatform: "bongacams",
      hypothesis: "Unverified test hypothesis"
    })
  });
  assert.equal(authenticatedPost.status, 503);
  assert.match((await authenticatedPost.json()).error, /Database is not configured/);

  const invalidOrigin = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({
      country: "DE",
      preferredPlatform: "bongacams",
      hypothesis: "Unverified test hypothesis"
    })
  });
  assert.equal(invalidOrigin.status, 403);
  assert.deepEqual(await invalidOrigin.json(), { error: "Origin check failed." });

  const wrongContentType = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "text/plain", Origin: baseUrl },
    body: "not-json"
  });
  assert.equal(wrongContentType.status, 415);
  assert.deepEqual(await wrongContentType.json(), { error: "Use application/json." });

  const malformedJson = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", Origin: baseUrl },
    body: "{"
  });
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), { error: "Invalid JSON." });

  const unsupportedCountry = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      country: "KE",
      preferredPlatform: "bongacams",
      hypothesis: "Unverified test hypothesis"
    })
  });
  assert.equal(unsupportedCountry.status, 400);
  assert.deepEqual(await unsupportedCountry.json(), { error: "Unsupported country." });

  const unsupportedMethod = await fetch(`${baseUrl}/api/country-platform-settings`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
  assert.equal(unsupportedMethod.status, 405);
  assert.deepEqual(await unsupportedMethod.json(), { error: "Method not allowed." });

  assert.doesNotMatch(stderr, /test-only-password/);
});
