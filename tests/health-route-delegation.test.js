"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const routeSource = fs.readFileSync(path.join(root, "route.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("dashboard middleware delegates /api/health to the canonical server handler", () => {
  assert.match(routeSource, /if\s*\(incoming\.pathname\s*===\s*["']\/api\/health["']\)\s*return\s+handler\(req,\s*res\)/);
  assert.doesNotMatch(routeSource, /incoming\.pathname\s*===\s*["']\/api\/health["'][\s\S]{0,300}databaseConfigured/);
});

test("canonical /api/health handler returns the A1.89 feed-health snapshot", () => {
  assert.match(serverSource, /pathname\s*===\s*["']\/api\/health["']/);
  assert.match(serverSource, /buildFeedHealthSnapshot\(/);
  assert.match(serverSource, /JSON\.stringify\(\{\s*status:\s*health\.status[\s\S]*?feed:\s*health\s*\}\)/);
});

test("lightweight /healthz liveness route remains independent", () => {
  assert.match(serverSource, /pathname\s*===\s*["']\/healthz["']/);
  assert.match(serverSource, /uptimeSeconds:\s*Math\.floor\(process\.uptime\(\)\)/);
});
