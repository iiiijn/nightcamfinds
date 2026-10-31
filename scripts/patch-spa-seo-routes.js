const fs = require("fs");

const FILE = "route.js";
const MARKER = "NIGHTCAMFINDS_SPA_SEO_ROUTES_V14";
let s = fs.readFileSync(FILE, "utf8");

if (s.includes(MARKER)) {
  console.log("SEO SPA route V14 patch already applied");
  process.exit(0);
}

const helper = `
// ${MARKER}
const NCF_SEO_PATHS_V14 = new Set([
  "/",
  "/live/",
  "/female/",
  "/male/",
  "/trans/",
  "/couples/",
  "/hd/",
  "/new/",
  "/popular/",
  "/countries/",
  "/broadcast"
]);

const NCF_ROUTE_META_V14 = {
  "/": {
    title: "NightCamFinds | Discover Live Cam Rooms",
    description: "Discover public live cam rooms on Chaturbate and BongaCams. Compare live rooms, viewer activity, and categories, then continue to the partner platform.",
    ogTitle: "NightCamFinds | Discover Live Cam Rooms",
    ogDescription: "Explore live rooms across Chaturbate and BongaCams with NightCamFinds."
  },
  "/live/": {
    title: "Live Cams Now | Browse Live Rooms | NightCamFinds",
    description: "Browse live webcam rooms currently available on Chaturbate and BongaCams. Compare viewer activity and open rooms on the partner platform.",
    ogTitle: "Live Cams Now | NightCamFinds",
    ogDescription: "Discover live rooms and compare current viewer activity across partner platforms."
  },
  "/female/": {
    title: "Female Live Cams | Browse Live Webcam Rooms | NightCamFinds",
    description: "Browse female live cam rooms on NightCamFinds. Discover live webcam models, compare rooms and viewer activity, and open rooms on Chaturbate or BongaCams.",
    ogTitle: "Female Live Cams | NightCamFinds",
    ogDescription: "Discover female live cam rooms, compare room activity, and open rooms on Chaturbate or BongaCams."
  },
  "/male/": {
    title: "Male Live Cams | Browse Live Rooms | NightCamFinds",
    description: "Browse male live cam rooms on NightCamFinds. Discover live webcam models, compare rooms and viewer activity, and find rooms that match your interests.",
    ogTitle: "Male Live Cams | NightCamFinds",
    ogDescription: "Browse male live cam rooms on NightCamFinds and discover live webcam models and rooms."
  },
  "/trans/": {
    title: "Trans Live Cams | Browse Live Rooms | NightCamFinds",
    description: "Browse trans live cam rooms on NightCamFinds. Explore public rooms, compare viewer activity, and continue to Chaturbate or BongaCams.",
    ogTitle: "Trans Live Cams | NightCamFinds",
    ogDescription: "Discover public trans live cam rooms and compare live room activity."
  },
  "/couples/": {
    title: "Couples Live Cams | Browse Live Rooms | NightCamFinds",
    description: "Browse couples live cam rooms on NightCamFinds. Compare live room activity and continue to the partner platform.",
    ogTitle: "Couples Live Cams | NightCamFinds",
    ogDescription: "Explore couples live cam rooms on Chaturbate and BongaCams."
  },
  "/hd/": {
    title: "HD Live Cams | Browse HD Rooms | NightCamFinds",
    description: "Browse live rooms marked as HD on NightCamFinds. Compare room activity and visit the room on its partner platform.",
    ogTitle: "HD Live Cams | NightCamFinds",
    ogDescription: "Find live rooms marked as HD across partner platforms."
  },
  "/new/": {
    title: "New Live Cams | Discover New Broadcasters | NightCamFinds",
    description: "Discover live rooms marked as new in the partner feeds. Browse current activity and open rooms on Chaturbate or BongaCams.",
    ogTitle: "New Live Cams | NightCamFinds",
    ogDescription: "Discover new broadcasters and live rooms on NightCamFinds."
  },
  "/popular/": {
    title: "Popular Live Cams | Most-Watched Rooms | NightCamFinds",
    description: "Browse popular live rooms sorted by current viewer activity. Discover public rooms on Chaturbate and BongaCams.",
    ogTitle: "Popular Live Cams | NightCamFinds",
    ogDescription: "Explore popular live rooms by current viewer activity."
  },
  "/countries/": {
    title: "Live Cams by Country | Browse Countries | NightCamFinds",
    description: "Browse live cam rooms by country when broadcaster country information is available. Explore rooms across partner platforms.",
    ogTitle: "Live Cams by Country | NightCamFinds",
    ogDescription: "Find live cam rooms by country on NightCamFinds."
  }
};

function ncfRedirectSeoNoSlashV14(req, res) {
  try {
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    const pathname = current.pathname;
    const needsSlash =
      /^\\/(live|female|male|trans|couples|hd|new|popular|countries)$/.test(pathname) ||
      /^\\/country\\/[a-z]{2}$/i.test(pathname);
    if (!needsSlash) return false;
    current.pathname = pathname + "/";
    res.writeHead(301, {
      Location: current.pathname + current.search,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    });
    res.end();
    return true;
  } catch {
    return false;
  }
}

function ncfRewriteSeoRequestV14(req) {
  try {
    const current = new URL(String(req.url || "/"), "http://nightcamfinds.local");
    const pathname = current.pathname;
    if (NCF_SEO_PATHS_V14.has(pathname)) {
      req.seoOriginalPathname = pathname;
      req.url = "/" + current.search;
    }
  } catch {}
}

function ncfApplySeoRouteMetadataV14(req, res) {
  const pathname = String(req.seoOriginalPathname || "");
  if (!pathname) return;

  const originalEnd = res.end;
  const chunks = [];
  let ended = false;

  res.write = function seoBufferedWriteV13(chunk, encoding) {
    if (ended) return false;
    if (chunk !== undefined && chunk !== null) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8"));
    }
    return true;
  };

  res.end = function seoBufferedEndV13(chunk, encoding, callback) {
    if (ended) return res;
    ended = true;

    if (chunk !== undefined && chunk !== null) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8"));
    }

    const done = typeof encoding === "function" ? encoding : callback;

    try {
      const contentType = String(res.getHeader("content-type") || "").toLowerCase();
      if (contentType.includes("text/html") || !contentType) {
        const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
        const host = String(req.headers["x-forwarded-host"] || req.headers.host || "nightcamfinds.com").split(",")[0].trim();
        const origin = proto + "://" + host;
        const canonical = origin + (pathname.startsWith("/") ? pathname : "/" + pathname);
        const countryNames = { us: "United States", gb: "United Kingdom", ca: "Canada", au: "Australia", de: "Germany", fr: "France", nl: "Netherlands" };
        const countryMatch = pathname.match(/^\\/country\\/([a-z]{2})\\/$/i);
        const countryCode = countryMatch ? countryMatch[1].toLowerCase() : "";
        const countryName = countryNames[countryCode] || (countryCode ? countryCode.toUpperCase() : "");
        const meta = NCF_ROUTE_META_V14[pathname] || (countryName ? {
          title: "Live Cams in " + countryName + " | NightCamFinds",
          description: "Browse live cam rooms associated with " + countryName + " on NightCamFinds. Explore available public rooms and continue to Chaturbate or BongaCams.",
          ogTitle: "Live Cams in " + countryName + " | NightCamFinds",
          ogDescription: "Discover available live cam rooms associated with " + countryName + "."
        } : null);
        let html = Buffer.concat(chunks).toString("utf8");

        html = html.replace(
          /<link\\s+rel=["']canonical["']\\s+href=["'][^"']*["'][^>]*>/i,
          '<link rel="canonical" href="' + canonical + '">'
        );
        html = html.replace(
          /(<meta\\s+property=["']og:url["']\\s+content=["'])[^"']*(["'][^>]*>)/i,
          '$1' + canonical + '$2'
        );
        if (!/<meta\\s+property=["']og:url["']/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, '<head$1><meta property="og:url" content="' + canonical + '">');
        }

        if (meta) {
          const escapeAttr = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const replaceOrInsert = (pattern, tag) => {
            const re = new RegExp(pattern.source, pattern.flags);
            if (re.test(html)) html = html.replace(re, tag);
            else html = html.replace(/<head([^>]*)>/i, '<head$1>' + tag);
          };
          replaceOrInsert(/<title(?:\\s[^>]*)?>[\\s\\S]*?<\\/title>/i, '<title>' + escapeAttr(meta.title) + '</title>');
          replaceOrInsert(/<meta\\s+name=["']description["'][^>]*>/i, '<meta name="description" content="' + escapeAttr(meta.description) + '">');
          if (meta.ogTitle) {
            replaceOrInsert(/<meta\\s+property=["']og:title["'][^>]*>/i, '<meta property="og:title" content="' + escapeAttr(meta.ogTitle) + '">');
          }
          if (meta.ogDescription) {
            replaceOrInsert(/<meta\\s+property=["']og:description["'][^>]*>/i, '<meta property="og:description" content="' + escapeAttr(meta.ogDescription) + '">');
          }
        }

        return originalEnd.call(this, html, "utf8", done);
      }
    } catch (err) {
      console.error("SEO buffered route metadata rewrite failed:", err.message);
    }

    return originalEnd.call(this, Buffer.concat(chunks), typeof encoding === "string" ? encoding : done);
  };
}

`;

const listenerAnchor = '  return originalCreateServer.call(http, async (req, res) => {\n';
if (!s.includes(listenerAnchor)) {
  throw new Error("route.js server listener anchor not found");
}

s = s.replace(listenerAnchor, helper + listenerAnchor);

const insertion =
  '    if (ncfRedirectSeoNoSlashV14(req, res)) return;\n' +
  '    ncfRewriteSeoRequestV14(req);\n' +
  '    ncfApplySeoRouteMetadataV14(req, res);\n';

if (!s.includes(insertion)) {
  s = s.replace(listenerAnchor, listenerAnchor + insertion);
}

fs.writeFileSync(FILE, s);
console.log("Applied SEO SPA route patch V14");
