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
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const rows = await fetchPage({ offset, limit: pageSize });
    if (!Array.isArray(rows)) throw new TypeError("Partner feed page must be an array.");
    pagesFetched += 1;
    if (!rows.length) break;

    const signature = rows.map(getKey).filter(Boolean).join("|");
    if (signature && pageSignatures.has(signature)) break;
    if (signature) pageSignatures.add(signature);

    for (const item of rows) {
      const key = getKey(item);
      if (!key || !seen.has(key)) {
        if (key) seen.add(key);
        items.push(item);
      }
    }

    if (rows.length < pageSize) break;
    if (page === maxPages - 1) truncated = true;
  }

  return { items, pagesFetched, truncated };
}

module.exports = { fetchPagedResults };
