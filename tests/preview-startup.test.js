"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("preview startup applies source repairs without running database migrations", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const command = packageJson.scripts["start:preview"];

  assert.equal(typeof command, "string");
  assert.match(command, /scripts\/fix-server-syntax\.js/);
  assert.match(command, /scripts\/patch-country-directory\.js/);
  assert.match(command, /scripts\/patch-spa-seo-routes\.js/);
  assert.match(command, /node route\.js$/);
  assert.doesNotMatch(command, /run-production-migrations|DATABASE_URL/);
  assert.ok(command.indexOf("fix-server-syntax.js") < command.indexOf("route.js"));
  assert.ok(command.indexOf("patch-country-directory.js") < command.indexOf("route.js"));
  assert.ok(command.indexOf("patch-spa-seo-routes.js") < command.indexOf("route.js"));
});

test("production startup remains migration-enabled and unchanged in purpose", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.match(packageJson.scripts.start, /^node scripts\/run-production-migrations\.js/);
});
