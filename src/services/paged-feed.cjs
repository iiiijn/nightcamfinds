"use strict";

async function fetchPagedResults(fetchPage, options = {}) {
  const pageSize = Math.max(1, Math.min(500, Number(options.pageSize) || 500));
  const maxPages = Math.max(1, Math.min(20, Number(options.maxPages) || 10));
  const getKey = typeof options.getKey === "function" ? options.getKey : (item) => String(item && (item.username || item.id) || "");
  const onPage = typeof options.onPage === "function" ? options.onPage : null;
  const items = [], seen = new Set(), pageSignatures = new Set(), pageMetrics = [];
  let pagesFetched = 0, receivedCount = 0, duplicateCount = 0, truncated = false, stopReason = "max_pages";
  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize, startedAt = Date.now();
    const rows = await fetchPage({ offset, limit: pageSize });
    const responseTimeMs = Math.max(0, Date.now() - startedAt);
    if (!Array.isArray(rows)) throw new TypeError("Partner feed page must be an array.");
    pagesFetched += 1; receivedCount += rows.length;
    if (!rows.length) {
      const metric = { offset, responseTimeMs, receivedCount: 0, uniqueCount: 0, duplicateCount: 0 };
      pageMetrics.push(metric); if (onPage) { try { onPage({ ...metric }); } catch {} }
      stopReason = "empty_page"; break;
    }
    const signature = rows.map(getKey).filter(Boolean).join("|");
    if (signature && pageSignatures.has(signature)) {
      const pageDuplicateCount = rows.filter((item) => { const key = getKey(item); return Boolean(key && seen.has(key)); }).length;
      duplicateCount += pageDuplicateCount;
      const metric = { offset, responseTimeMs, receivedCount: rows.length, uniqueCount: 0, duplicateCount: pageDuplicateCount };
      pageMetrics.push(metric); if (onPage) { try { onPage({ ...metric }); } catch {} }
      truncated = true; stopReason = "repeated_page"; break;
    }
    if (signature) pageSignatures.add(signature);
    let pageUniqueCount = 0, pageDuplicateCount = 0;
    for (const item of rows) {
      const key = getKey(item);
      if (!key || !seen.has(key)) { if (key) seen.add(key); items.push(item); pageUniqueCount += 1; }
      else { duplicateCount += 1; pageDuplicateCount += 1; }
    }
    const metric = { offset, responseTimeMs, receivedCount: rows.length, uniqueCount: pageUniqueCount, duplicateCount: pageDuplicateCount };
    pageMetrics.push(metric); if (onPage) { try { onPage({ ...metric }); } catch {} }
    if (rows.length < pageSize) { stopReason = "short_page"; break; }
    if (page === maxPages - 1) { truncated = true; stopReason = "max_pages"; }
  }
  return { items, pagesFetched, receivedCount, uniqueCount: items.length, duplicateCount, truncated, stopReason, pageMetrics };
}
module.exports = { fetchPagedResults };
