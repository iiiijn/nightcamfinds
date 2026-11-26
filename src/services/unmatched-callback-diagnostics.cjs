"use strict";
const { unresolvedMacroPredicate, unsupportedEventTypePredicate, invalidCallbackPredicate } = require("./callback-integrity.cjs");
function buildUnmatchedCallbackDiagnosticsQuery({ from = "", to = "", limit = 50 } = {}) {
  const params = [], where = [];
  if (from) { params.push(`${from}T00:00:00.000Z`); where.push("cc.received_at >= $" + params.length); }
  if (to) { params.push(`${to}T23:59:59.999Z`); where.push("cc.received_at <= $" + params.length); }
  const unresolved = unresolvedMacroPredicate("cc"), unsupported = unsupportedEventTypePredicate("cc"), invalid = invalidCallbackPredicate("cc");
  params.push(Math.max(1, Math.min(100, Number(limit) || 50)));
  const limitParam = params.length, whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    "WITH diagnostic_rows AS (",
    " SELECT cc.id, cc.received_at, cc.conversion_type, cc.country, cc.currency,",
    " (cc.click_id IS NOT NULL AND BTRIM(cc.click_id) <> '') AS has_click_id,",
    " EXISTS (SELECT 1 FROM cb_clicks c WHERE c.click_id = cc.click_id) AS matches_chaturbate_ledger,",
    " EXISTS (SELECT 1 FROM affiliate_clicks a WHERE a.click_id = cc.click_id AND a.platform = 'chaturbate') AS matches_affiliate_ledger,",
    " COALESCE(cc.matched_click, FALSE) AS stored_as_matched,",
    " " + unresolved + " AS has_unresolved_macro,",
    " " + unsupported + " AS unsupported_event_type,",
    " NOT (" + invalid + ") AS eligible",
    " FROM cb_conversions cc", whereSql, ")",
    "SELECT id, received_at, conversion_type, country, currency, has_click_id,",
    " matches_chaturbate_ledger, matches_affiliate_ledger, stored_as_matched,",
    " has_unresolved_macro, unsupported_event_type, eligible, COUNT(*) OVER()::int AS total_in_range",
    "FROM diagnostic_rows",
    "WHERE eligible IS FALSE OR stored_as_matched IS FALSE OR (matches_chaturbate_ledger IS FALSE AND matches_affiliate_ledger IS FALSE)",
    "ORDER BY received_at DESC, id DESC", "LIMIT $" + limitParam
  ].filter(Boolean).join(" ");
  return { text, params, limit: params[limitParam - 1] };
}
function toSafeDiagnosticRows(rows = []) {
  return rows.map(row => {
    const macro = Boolean(row.has_unresolved_macro), unsupported = Boolean(row.unsupported_event_type), eligible = Boolean(row.eligible);
    const callbackClass = macro ? "test_or_unresolved_macro" : unsupported ? "unsupported_event_type" : eligible ? "eligible_unmatched" : "invalid_callback";
    return {
      receivedAt: row.received_at, eventType: String(row.conversion_type || "unknown"),
      country: String(row.country || "UNKNOWN").toUpperCase(), currency: String(row.currency || "").toUpperCase(),
      callbackClass, hasClickId: Boolean(row.has_click_id),
      matchesChaturbateLedger: Boolean(row.matches_chaturbate_ledger),
      matchesAffiliateLedger: Boolean(row.matches_affiliate_ledger), storedAsMatched: Boolean(row.stored_as_matched)
    };
  });
}
module.exports = { buildUnmatchedCallbackDiagnosticsQuery, toSafeDiagnosticRows };
