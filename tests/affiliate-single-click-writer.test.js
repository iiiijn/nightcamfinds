const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const start = fs.readFileSync(path.join(__dirname, "../start.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

test("affiliate redirects have exactly one click attribution writer", () => {
  assert.doesNotMatch(start, /saveClick\s*\(|parseAttribution\s*\(/);
  assert.doesNotMatch(start, /path\.startsWith\(["']\/bgo\/["']\).*path\.startsWith\(["']\/go\/["']/);
  assert.match(server, /async function countClick\s*\(/);
  assert.match(server, /await countClick\(\{\s*src,\s*country,[\s\S]*?clickId,\s*platform\s*\}\)/);
  assert.match(server, /searchParams\.set\(["']click_id["'],\s*clickId\)/);
});

test("removing duplicate click tracking keeps Chaturbate postbacks enabled", () => {
  assert.match(start, /\/api\/chaturbate\/postback/);
  assert.match(start, /async function saveConversion\s*\(/);
  assert.match(start, /await saveConversion\(params\)/);
});

test("BongaCash postbacks remain handled by the route layer", () => {
  const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  assert.match(route, /\/api\/bongacash\/postback/);
  assert.match(route, /bongacash\.save\(pool, params\)/);
});
