"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { STALE_AFTER_MS, buildFeedHealthSnapshot } = require("../src/services/feed-health.cjs");

test("reports a fresh complete feed as healthy without exposing sensitive values", () => {
  const now = Date.parse("2026-11-25T12:00:00.000Z");
  const snapshot = buildFeedHealthSnapshot({
    lastAttemptAt: "2026-11-25T11:59:58.000Z",
    lastCompletedAt: "2026-11-25T11:59:59.000Z",
    lastSuccessfulAt: "2026-11-25T11:59:59.000Z",
    providerHealth: { chaturbate: "available", bongacams: "available" },
    regions: [{ apiRegion: "europe_russia", truncated: false, stopReason: "short_page", pagesFetched: 3, receivedCount: 1200 }],
    bonga: { configuredVersion: "2", activeVersion: "2", fallbackUsed: false },
    visitorIp: "8.8.8.8",
    secret: "never-return-this"
  }, now);
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.ageSeconds, 1);
  assert.equal(snapshot.bonga.activeVersion, "2");
  assert.equal(JSON.stringify(snapshot).includes("8.8.8.8"), false);
  assert.equal(JSON.stringify(snapshot).includes("never-return-this"), false);
});

test("marks missing and stale feed snapshots as degraded", () => {
  assert.equal(buildFeedHealthSnapshot({}, 1000).status, "degraded");
  const now = 10 * STALE_AFTER_MS;
  const snapshot = buildFeedHealthSnapshot({
    lastCompletedAt: new Date(now - STALE_AFTER_MS - 1).toISOString(),
    providerHealth: { chaturbate: "available", bongacams: "disabled" }
  }, now);
  assert.equal(snapshot.stale, true);
  assert.equal(snapshot.status, "degraded");
});

test("marks provider failures and truncated regions as degraded", () => {
  const snapshot = buildFeedHealthSnapshot({
    lastCompletedAt: "2026-11-25T12:00:00.000Z",
    providerHealth: { chaturbate: "available", bongacams: "unavailable" },
    regions: [{ apiRegion: "southamerica", truncated: true, stopReason: "max_pages", pagesFetched: 10, receivedCount: 5000 }]
  }, Date.parse("2026-11-25T12:00:01.000Z"));
  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.regions[0].truncated, true);
});

test("distinguishes a Bonga V2 fallback from successful V2 operation", () => {
  const snapshot = buildFeedHealthSnapshot({
    lastCompletedAt: "2026-11-25T12:00:00.000Z",
    providerHealth: { chaturbate: "available", bongacams: "available" },
    bonga: { configuredVersion: "2", activeVersion: "1", fallbackUsed: true }
  }, Date.parse("2026-11-25T12:00:01.000Z"));
  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.bonga.configuredVersion, "2");
  assert.equal(snapshot.bonga.activeVersion, "1");
  assert.equal(snapshot.bonga.fallbackUsed, true);
});

test("sanitizes malformed diagnostic inputs", () => {
  const snapshot = buildFeedHealthSnapshot({
    providerHealth: { chaturbate: "bad", bongacams: "bad" },
    regions: [{ apiRegion: { secret: "x" }, pagesFetched: -10, receivedCount: "large" }],
    bonga: { configuredVersion: "secret", activeVersion: "secret" }
  }, Date.now());
  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.providerHealth.chaturbate, "unknown");
  assert.equal(snapshot.regions[0].pagesFetched, 0);
  assert.equal(snapshot.regions[0].receivedCount, 0);
  assert.equal(snapshot.bonga.configuredVersion, "1");
  assert.equal(snapshot.bonga.activeVersion, null);
});
