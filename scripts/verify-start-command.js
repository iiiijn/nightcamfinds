const pkg = require("../package.json");

const expected = [
  "node scripts/run-production-migrations.js",
  "node route.js",
];

const start = String(pkg.scripts?.start || "")
  .split(/\s*&&\s*/)
  .map((part) => part.trim())
  .filter(Boolean);

if (JSON.stringify(start) !== JSON.stringify(expected)) {
  console.error("Unexpected package.json start script:");
  console.error(start.join(" && "));
  console.error("Expected:");
  console.error(expected.join(" && "));
  process.exit(1);
}

console.log("Production start command is valid and contains no build-time patching.");
