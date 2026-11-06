(function (root) {
  "use strict";
  const HOST_RULES = [
    [/^(?:www\.)?google\.(?:com(?:\.[a-z]{2})?|[a-z]{2,3}|co\.[a-z]{2})$/i, "google", "organic"],
    [/^(?:www\.)?bing\.com$/i, "bing", "organic"],
    [/^(?:www\.)?duckduckgo\.com$/i, "duckduckgo", "organic"],
    [/^(?:www\.)?search\.yahoo\.com$/i, "yahoo", "organic"],
    [/^(?:www\.)?chatgpt\.com$/i, "chatgpt", "referral"],
    [/^(?:chat|www)\.openai\.com$/i, "chatgpt", "referral"],
    [/^(?:www\.)?x\.com$/i, "x", "social"],
    [/^(?:www\.)?twitter\.com$/i, "x", "social"],
    [/^t\.co$/i, "x", "social"],
    [/^(?:www\.)?reddit\.com$/i, "reddit", "social"],
    [/^(?:www\.)?t\.me$/i, "telegram", "social"],
    [/^(?:www\.)?telegram\.org$/i, "telegram", "social"],
    [/^(?:www\.)?facebook\.com$/i, "facebook", "social"],
    [/^l\.facebook\.com$/i, "facebook", "social"],
    [/^(?:www\.)?instagram\.com$/i, "instagram", "social"],
    [/^(?:www\.)?youtube\.com$/i, "youtube", "social"],
    [/^(?:www\.)?youtu\.be$/i, "youtube", "social"],
    [/^(?:www\.)?pinterest\.com$/i, "pinterest", "social"],
    [/^(?:www\.)?linkedin\.com$/i, "linkedin", "social"]
  ];
  function classifyReferrer(referrer, currentHost) {
    if (!referrer) return { source: "direct", medium: "direct", referrerHost: "" };
    let parsed;
    try { parsed = new URL(referrer); } catch (_) {
      return { source: "unknown", medium: "unknown", referrerHost: "" };
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const own = String(currentHost || "").toLowerCase().replace(/^www\./, "");
    if (!host || host === own || host.endsWith("." + own)) {
      return { source: "direct", medium: "direct", referrerHost: "" };
    }
    for (const [pattern, source, medium] of HOST_RULES) {
      if (pattern.test(parsed.hostname)) return { source, medium, referrerHost: host.slice(0, 120) };
    }
    return { source: "referral", medium: "referral", referrerHost: host.slice(0, 120) };
  }
  const api = { classifyReferrer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NCFTrafficAttribution = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
