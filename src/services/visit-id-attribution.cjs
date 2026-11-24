'use strict';

const VISIT_ID_PATTERN = /^[a-f0-9]{32}$/i;

function validVisitId(value) {
  return VISIT_ID_PATTERN.test(String(value || ""));
}

function resolveVisitIdentity({ queryVisitId, cookieVisitId, createVisitId }) {
  if (validVisitId(cookieVisitId)) return { visitId: String(cookieVisitId), origin: "cookie" };
  if (validVisitId(queryVisitId)) return { visitId: String(queryVisitId), origin: "query" };
  if (typeof createVisitId !== "function") throw new TypeError("createVisitId must be a function");
  const generated = createVisitId();
  if (!validVisitId(generated)) throw new TypeError("createVisitId must return a valid visit ID");
  return { visitId: generated, origin: "redirect_fallback" };
}

function buildVisitCookieHeaders({ existingVisitCookie, existingLandingCookie, visitId, landingPath, secure = false }) {
  const attributes = "; Path=/; SameSite=Lax" + (secure ? "; Secure" : "");
  const cookies = [];
  if (!validVisitId(existingVisitCookie) && validVisitId(visitId)) {
    cookies.push("ncf_visit_id=" + encodeURIComponent(visitId) + attributes);
  }
  const safeLandingPath = typeof landingPath === "string" && landingPath.startsWith("/") &&
    !landingPath.startsWith("//") && landingPath.length <= 255 && !/[\r\n]/.test(landingPath);
  const existingLandingIsSafe = typeof existingLandingCookie === "string" &&
    existingLandingCookie.startsWith("/") && !existingLandingCookie.startsWith("//") &&
    existingLandingCookie.length <= 255 && !/[\r\n]/.test(existingLandingCookie);
  if (!existingLandingIsSafe && safeLandingPath) {
    cookies.push("ncf_landing_path=" + encodeURIComponent(landingPath) + attributes);
  }
  return cookies;
}

module.exports = { validVisitId, resolveVisitIdentity, buildVisitCookieHeaders };
