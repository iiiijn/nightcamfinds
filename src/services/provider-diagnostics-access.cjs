"use strict";

function guardProviderFeedDiagnostics({ pathname, searchParams, req, res, isValidSession, sendJson }) {
  if (pathname !== "/api/rooms" || searchParams.get("diagnostics") !== "1") return false;

  let authorized = false;
  try {
    authorized = Boolean(isValidSession(req));
  } catch {
    // Malformed session cookies must fail closed, not escape the HTTP middleware.
    authorized = false;
  }

  if (authorized) return false;
  sendJson(res, 401, { error: "Unauthorized" });
  return true;
}

module.exports = { guardProviderFeedDiagnostics };
