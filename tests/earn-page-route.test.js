import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.js", "utf8");
const page = readFileSync("public/earn.html", "utf8");

test("the earning page has an explicit static route before the generic SPA fallback", () => {
  const routeStart = server.indexOf('if (pathname === "/earn" || pathname === "/earn/")');
  const spaFallback = server.indexOf('if(pathname.endsWith("/")||forced)');
  assert.ok(routeStart >= 0, "server.js explicitly handles /earn and /earn/");
  assert.ok(spaFallback > routeStart, "the earning route runs before trailing-slash SPA fallback");
  const routeBlock = server.slice(routeStart, spaFallback);
  assert.ok(routeBlock.includes('path.join(PUBLIC, "earn.html")'));
  assert.ok(routeBlock.includes('send(res, 200, earnHtml, "text/html; charset=utf-8")'));
});

test("the served earning page contains its distinct title and all four earning paths", () => {
  assert.ok(page.includes("<title>Earn with Chaturbate | NightCamFinds</title>"));
  for (const phrase of ["For members", "For broadcasters", "For webmasters", "For room promoters"]) {
    assert.ok(page.includes(phrase), `earning page is missing: ${phrase}`);
  }
});
