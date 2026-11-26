"use strict";

function buildAffiliateConversionHealth({ postbackSecretConfigured, callbackCounts = {}, reconciliation = {} }) {
  const number = value => Math.max(0, Number(value) || 0);
  const total = number(callbackCounts.totalEvents);
  const eligible = number(callbackCounts.eligibleEvents);
  const matched = number(callbackCounts.matchedEvents);
  const unmatched = number(callbackCounts.unmatchedEvents);
  const missingClickId = number(callbackCounts.missingClickId);
  const daysReported = number(reconciliation.daysReported);
  return {
    chaturbate: {
      authentication: postbackSecretConfigured ? "configured" : "not_configured",
      callbackLedger: total > 0 ? "events_received" : "no_events_recorded",
      totalEvents: total,
      eligibleEvents: eligible,
      matchedEvents: matched,
      unmatchedEvents: unmatched,
      missingClickId,
      matchingCoverage: eligible > 0 ? Number((matched / eligible).toFixed(4)) : null,
      duplicateProtection: "database_unique_transaction_id",
      revenueRule: "Only eligible callbacks matched to a NightCamFinds click are included in attributed earnings."
    },
    bongacash: {
      trackingMode: "manual_reconciliation",
      automaticPostbacks: false,
      reconciliationStatus: reconciliation.schemaReady === false
        ? "schema_unavailable"
        : daysReported > 0 ? "reports_recorded" : "no_reports_recorded",
      daysReported,
      latestReportDate: reconciliation.latestReportDate || null,
      revenueRule: "Manually entered partner-reported totals; not click-attributed."
    }
  };
}

module.exports = { buildAffiliateConversionHealth };
