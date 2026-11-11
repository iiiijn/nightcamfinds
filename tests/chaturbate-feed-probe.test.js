"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runChaturbateFeedProbe, PAGE_SIZE } = require("../src/services/chaturbate-feed-probe.cjs");

test("probes only the two capped regions at bounded offsets and returns counts only", async () => {
  const calls = [];
  const result = await runChaturbateFeedProbe({
    wm: "private-wm",
    clientIp: "203.0.113.10",
    delayMs: 0,
    fetchPage: async args => {
      calls.push(args);
      return {
        status: 200,
        rows: Array.from({ length: PAGE_SIZE }, (_, i) => ({
          username: args.offset === 2000 && i === 0 ? "duplicate-model" : args.region + "-" + args.offset + "-" + i
        }))
      };
    }
  });

  assert.equal(calls.length, 10);
  assert.deepEqual([...new Set(calls.map(call => call.region))], ["southamerica", "europe_russia"]);
  assert.deepEqual([...new Set(calls.map(call => call.offset))], [2000, 2500, 3000, 3500, 4000]);
  assert.equal(result.reports.length, 2);
  assert.equal(result.reports[0].pages.length, 5);
  assert.equal(result.reports[0].pages[0].rows, 500);
  assert.equal(result.reports[0].stopReason, "probe_offsets_exhausted");
  assert.equal(JSON.stringify(result).includes("duplicate-model"), false);
  assert.equal(JSON.stringify(result).includes("private-wm"), false);
  assert.equal(JSON.stringify(result).includes("203.0.113.10"), false);
});

test("stops a region on an empty page and does not probe later offsets", async () => {
  const offsets = [];
  const result = await runChaturbateFeedProbe({
    wm: "wm",
    clientIp: "203.0.113.10",
    delayMs: 0,
    regions: ["southamerica"],
    offsets: [2000, 2500, 3000],
    fetchPage: async ({ offset }) => {
      offsets.push(offset);
      return { status: 200, rows: offset === 2000 ? [] : [{ username: "unused" }] };
    }
  });
  assert.deepEqual(offsets, [2000]);
  assert.equal(result.reports[0].stopReason, "empty_page");
  assert.equal(result.reports[0].pages[0].rows, 0);
});

test("reports provider HTTP failures without leaking response bodies", async () => {
  const result = await runChaturbateFeedProbe({
    wm: "wm",
    clientIp: "203.0.113.10",
    delayMs: 0,
    regions: ["europe_russia"],
    offsets: [2000, 2500],
    fetchPage: async () => ({ status: 403, rows: null, error: "private response text" })
  });
  assert.equal(result.reports[0].stopReason, "http_or_response_error");
  assert.equal(result.reports[0].pages[0].status, 403);
  assert.equal(JSON.stringify(result).includes("private response text"), false);
});

test("requires configured credentials", async () => {
  await assert.rejects(() => runChaturbateFeedProbe({ wm: "", clientIp: "" }), /credentials are not configured/);
});
