"use strict";

function classifyBongaV2Failure(error) {
  const message = String(error && error.message || error || "").toLowerCase();
  if (message.includes("cloudflare origin authentication failed")) return "origin_authentication_failed";
  if (message.includes("trusted proxy header") || message.includes("visitor ipv4")) return "trusted_client_ip_unavailable";
  if (message.includes("response did not contain") || message.includes("models must contain") || message.includes("online_models must")) return "invalid_provider_response";
  if (/feed\s+(401|403)|http\s+(401|403)/.test(message)) return "provider_authorization_failed";
  if (/feed\s+[45]\d\d|http\s+[45]\d\d/.test(message)) return "provider_http_error";
  if (message.includes("timeout")) return "provider_timeout";
  return "request_failed";
}

function summarizeBongaFeedHealth({
  enabled = true,
  requestedApiVersion = "1",
  activeApiVersion = "",
  fallbackReason = "",
  pagination = null,
  checkedAt = null
} = {}) {
  if (!enabled) {
    return { provider: "bongacams", status: "disabled", requestedApiVersion, activeApiVersion: "", fallbackReason: "", checkedAt };
  }

  const requested = requestedApiVersion === "2" ? "2" : "1";
  const active = activeApiVersion === "2" ? "2" : activeApiVersion === "1" ? "1" : "";
  const page = pagination && typeof pagination === "object" ? pagination : null;
  const truncated = Boolean(page && page.truncated === true);
  let status;
  if (!active) status = "unavailable";
  else if (requested === "2" && active === "1") status = "v2_fallback_to_v1";
  else if (active === "2" && truncated) status = "v2_truncated";
  else status = active === "2" ? "active_v2" : "active_v1";

  return {
    provider: "bongacams",
    status,
    requestedApiVersion: requested,
    activeApiVersion: active,
    fallbackReason: requested === "2" && active === "1" ? String(fallbackReason || "unknown") : "",
    checkedAt,
    pagination: page ? {
      pagesFetched: Number.isInteger(page.pagesFetched) ? page.pagesFetched : null,
      receivedCount: Number.isInteger(page.receivedCount) ? page.receivedCount : null,
      uniqueCount: Number.isInteger(page.uniqueCount) ? page.uniqueCount : null,
      duplicateCount: Number.isInteger(page.duplicateCount) ? page.duplicateCount : null,
      truncated,
      stopReason: ["short_page", "max_pages", "empty_page", "repeated_page", "unknown"].includes(page.stopReason) ? page.stopReason : "unknown"
    } : null
  };
}

module.exports = { classifyBongaV2Failure, summarizeBongaFeedHealth };
