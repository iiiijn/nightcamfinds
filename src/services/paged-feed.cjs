"use strict";

async function fetchPagedResults(fetchPage, options = {}) {
  const pageSize = Math.max(1, Math.min(500, Number(options.pageSize) || 500));
  const maxPages = Math.max(1, Math.min(20, Number(options.maxPages) || 10));
  const getKey = typeof options.getKey === "function"
    ? options.getKey
    : (item) => String(item && (item.username || item.id) || "");
  const items = [];
  const seen = new Set();
  const pageSignatures = new Set();
  let pagesFetched = 0;
  let receivedCount = 0;
  let duplicateCount = 0;
  let truncated = false;
  let stopReason = "max_pages";

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const rows = await fetchPage({ offset, limit: pageSize });
    if (!Array.isArray(rows)) throw new TypeError("Partner feed page must be an array.");
    pagesFetched += 1;
    receivedCount += rows.length;
    if (!rows.length) {
      stopReason = "empty_page";
      break;
    }

    const signature = rows.map(getKey).filter(Boolean).join("|");
    if (signature && pageSignatures.has(signature)) {
      duplicateCount += rows.filter((item) => {
        const key = getKey(item);
        return Boolean(key && seen.has(key));
      }).length;
      stopReason = "repeated_page";
      break;
    }
    if (signature) pageSignatures.add(signature);

    for (const item of rows) {
      const key = getKey(item);
      if (!key || !seen.has(key)) {
        if (key) seen.add(key);
        items.push(item);
      } else {
        duplicateCount += 1;
      }
    }

    if (rows.length < pageSize) {
      stopReason = "short_page";
      break;
    }
    if (page === maxPages - 1) {
      truncated = true;
      stopReason = "max_pages";
    }
  }

  return {
    items,
    pagesFetched,
    receivedCount,
    uniqueCount: items.length,
    duplicateCount,
    truncated,
    stopReason
  };
}

module.exports = { fetchPagedResults };
