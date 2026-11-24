"use strict";

const TRAILING_SLASH_ROUTES = new Set([
  "/female", "/male", "/trans", "/couples", "/hd", "/new", "/popular", "/countries"
]);

function canonicalSeoRedirectPath(pathname) {
  const path = String(pathname || "/");
  if (path === "/live" || path === "/live/") return "/";
  if (path === "/broadcast/") return "/broadcast";
  if (TRAILING_SLASH_ROUTES.has(path)) return path + "/";
  if (/^\/country\/[a-z]{2}$/i.test(path)) return path + "/";
  return null;
}

module.exports = { canonicalSeoRedirectPath };
