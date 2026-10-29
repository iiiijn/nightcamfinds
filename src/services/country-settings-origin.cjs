function isSameOriginRequest(headers = {}) {
  const origin = headers.origin;
  if (!origin) return false;
  if (String(headers["sec-fetch-site"] || "").toLowerCase() === "cross-site") return false;

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const requestHost = String(headers.host || "").toLowerCase();
  if (!requestHost) return false;
  if (originUrl.host.toLowerCase() !== requestHost) return false;
  if (!["http:", "https:"].includes(originUrl.protocol)) return false;
  if (originUrl.origin === "null") return false;
  return true;
}

module.exports = { isSameOriginRequest };
