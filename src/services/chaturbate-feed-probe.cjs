"use strict";

const https = require("node:https");

const PAGE_SIZE = 500;
const REGIONS = Object.freeze(["southamerica", "europe_russia"]);
const OFFSETS = Object.freeze([2000, 2500, 3000, 3500, 4000]);

function requestPage({ wm, clientIp, region, offset, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const url = new URL("https://chaturbate.com/api/public/affiliates/onlinerooms/");
    url.searchParams.set("wm", wm);
    url.searchParams.set("client_ip", clientIp);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("region", region);

    const req = https.get(url, {
      headers: { "User-Agent": "NightCamFinds-Admin-Feed-Probe/1.0", Accept: "application/json" }
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        let data;
        try { data = JSON.parse(body); }
        catch { resolve({ status: res.statusCode, rows: null, error: "non_json_response" }); return; }
        const rows = data && Array.isArray(data.results) ? data.results : null;
        resolve({
          status: res.statusCode,
          rows,
          error: rows ? null : "missing_results_array"
        });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Chaturbate request timed out")));
    req.on("error", reject);
  });
}

async function runChaturbateFeedProbe({
  wm,
  clientIp,
  fetchPage = requestPage,
  regions = REGIONS,
  offsets = OFFSETS,
  delayMs = 1000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  if (!wm || !clientIp) throw new Error("Chaturbate feed credentials are not configured.");
  const reports = [];

  for (const region of regions) {
    const seen = new Set();
    const pages = [];
    let stopReason = "probe_offsets_exhausted";

    for (const offset of offsets) {
      let response;
      try {
        response = await fetchPage({ wm, clientIp, region, offset, limit: PAGE_SIZE });
      } catch {
        pages.push({ offset, status: null, rows: null, uniqueTotal: seen.size, duplicates: null, error: "request_failed" });
        stopReason = "request_failed";
        break;
      }

      if (!response || response.status < 200 || response.status >= 300 || !Array.isArray(response.rows)) {
        pages.push({
          offset,
          status: Number.isInteger(response?.status) ? response.status : null,
          rows: null,
          uniqueTotal: seen.size,
          duplicates: null,
          error: ["non_json_response", "missing_results_array"].includes(response?.error) ? response.error : "http_or_response_error"
        });
        stopReason = "http_or_response_error";
        break;
      }

      let duplicates = 0;
      for (const row of response.rows) {
        const key = String(row && (row.username || row.room_id || row.id) || "").trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) duplicates += 1;
        else seen.add(key);
      }
      pages.push({
        offset,
        status: response.status,
        rows: response.rows.length,
        uniqueTotal: seen.size,
        duplicates,
        error: null
      });

      if (response.rows.length === 0) {
        stopReason = "empty_page";
        break;
      }
      if (response.rows.length < PAGE_SIZE) {
        stopReason = "short_page";
        break;
      }
      if (offset !== offsets[offsets.length - 1] && delayMs > 0) await sleep(delayMs);
    }

    reports.push({ region, pages, uniqueAtProbedOffsets: seen.size, stopReason });
  }

  return {
    pageSize: PAGE_SIZE,
    probedOffsets: [...offsets],
    reports
  };
}

module.exports = { PAGE_SIZE, REGIONS, OFFSETS, runChaturbateFeedProbe };
