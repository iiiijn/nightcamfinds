"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyBongaV2Failure, summarizeBongaFeedHealth } = require("../src/services/bonga-feed-health.cjs");

test("Bonga V2 failures are reduced to safe operational reason codes", () => {
  assert.equal(classifyBongaV2Failure(new Error("Cloudflare origin authentication failed; secret abc")), "origin_authentication_failed");
  assert.equal(classifyBongaV2Failure(new Error("No valid visitor IPv4 found in the configured trusted proxy header")), "trusted_client_ip_unavailable");
  assert.equal(classifyBongaV2Failure(new Error("BongaCash V2 response did not contain a models array")), "invalid_provider_response");
  assert.equal(classifyBongaV2Failure(new Error("Feed 403")), "provider_authorization_failed");
  assert.equal(classifyBongaV2Failure(new Error("Feed 503")), "provider_http_error");
  assert.equal(classifyBongaV2Failure(new Error("request timeout")), "provider_timeout");
  assert.equal(classifyBongaV2Failure(new Error("unexpected socket close")), "request_failed");
});

test("Bonga health distinguishes configured V2 fallback from healthy V2", () => {
  const fallback = summarizeBongaFeedHealth({
    requestedApiVersion: "2",
    activeApiVersion: "1",
    fallbackReason: "origin_authentication_failed",
    pagination: { pagesFetched: 1, receivedCount: 100, uniqueCount: 98, duplicateCount: 2, truncated: false, stopReason: "unknown" },
    checkedAt: "2026-11-18T00:00:00.000Z"
  });
  assert.equal(fallback.status, "v2_fallback_to_v1");
  assert.equal(fallback.fallbackReason, "origin_authentication_failed");
  assert.equal(fallback.activeApiVersion, "1");
  assert.equal(fallback.coverageStatus, "single_response_limit_unverified");
  assert.equal(JSON.stringify(fallback).includes("secret"), false);

  const healthy = summarizeBongaFeedHealth({
    requestedApiVersion: "2",
    activeApiVersion: "2",
    pagination: { pagesFetched: 2, receivedCount: 150, uniqueCount: 150, duplicateCount: 0, truncated: false, stopReason: "short_page" }
  });
  assert.equal(healthy.status, "active_v2");
  assert.equal(healthy.fallbackReason, "");
  assert.equal(healthy.coverageStatus, "pagination_completed");
});

test("Bonga health reports truncation and disabled feed without claiming complete coverage", () => {
  const truncated = summarizeBongaFeedHealth({
    requestedApiVersion: "2",
    activeApiVersion: "2",
    pagination: { pagesFetched: 5, receivedCount: 500, uniqueCount: 490, duplicateCount: 10, truncated: true, stopReason: "max_pages" }
  });
  assert.equal(truncated.status, "v2_truncated");
  assert.equal(truncated.coverageStatus, "truncated");
  assert.equal(truncated.pagination.stopReason, "max_pages");

  const disabled = summarizeBongaFeedHealth({ enabled: false, requestedApiVersion: "2", activeApiVersion: "1" });
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.activeApiVersion, "");
});

test("Bonga health accepts only bounded pagination metadata", () => {
  const result = summarizeBongaFeedHealth({
    requestedApiVersion: "2",
    activeApiVersion: "2",
    pagination: { pagesFetched: -1, receivedCount: "100", uniqueCount: 10, duplicateCount: 0, truncated: false, stopReason: "secret" }
  });
  assert.equal(result.pagination.pagesFetched, null);
  assert.equal(result.pagination.receivedCount, null);
  assert.equal(result.pagination.uniqueCount, 10);
  assert.equal(result.pagination.stopReason, "unknown");
});

test("server records V2 fallback reasons as safe codes and exposes feed health through protected diagnostics", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.match(server, /classifyBongaV2Failure\(error\)/);
  assert.match(server, /feedHealth\}\s*;/);
  assert.match(server, /reason:latestBongaV2FallbackReason/);
  assert.doesNotMatch(server, /falling back to V1:\",error\.message/);
  assert.match(server, /providerIngestion: latestProviderFeedDiagnostics/);
});
