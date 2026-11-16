"use strict";

const { runSmokeChecks } = require("../src/services/production-smoke.cjs");

async function main() {
  const baseUrl = process.env.NCF_SMOKE_BASE_URL;
  if (!baseUrl) {
    console.error("Set NCF_SMOKE_BASE_URL to the site origin, for example https://nightcamfinds.com");
    process.exitCode = 2;
    return;
  }
  const result = await runSmokeChecks({ baseUrl });
  for (const item of result.results) {
    const state = item.ok ? "PASS" : "FAIL";
    console.log(state + " " + item.name + " (" + item.path + ")" + (item.reason ? " - " + item.reason : ""));
  }
  console.log("Smoke test result: " + result.passed + "/" + result.total + " passed; " + result.failed + " failed.");
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Smoke test could not start:", error.message);
  process.exitCode = 1;
});
