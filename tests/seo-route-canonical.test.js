const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalSeoRedirectPath } = require("../src/services/seo-route-canonical.cjs");
const { renderCategorySeoHtml } = require("../src/services/category-seo-renderer.cjs");

test("live route variants canonicalize to the homepage", () => {
  assert.equal(canonicalSeoRedirectPath("/live"), "/");
  assert.equal(canonicalSeoRedirectPath("/live/"), "/");
});

test("broadcast has one non-trailing-slash canonical URL", () => {
  assert.equal(canonicalSeoRedirectPath("/broadcast/"), "/broadcast");
  assert.equal(canonicalSeoRedirectPath("/broadcast"), null);
});

test("category and country routes keep their established trailing-slash canonicals", () => {
  for (const route of ["/female", "/male", "/trans", "/couples", "/hd", "/new", "/popular", "/countries"]) {
    assert.equal(canonicalSeoRedirectPath(route), route + "/");
  }
  assert.equal(canonicalSeoRedirectPath("/country/us"), "/country/us/");
  assert.equal(canonicalSeoRedirectPath("/country/US"), "/country/US/");
  assert.equal(canonicalSeoRedirectPath("/country/us/"), null);
});

test("unrelated paths are not redirected", () => {
  for (const route of ["/", "/broadcast.html", "/country/usa/", "/api/rooms", "/sitemap.xml"]) {
    assert.equal(canonicalSeoRedirectPath(route), null);
  }
});

test("XML sitemap source excludes redirecting live route and keeps broadcast canonical destination", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const sitemapMatch = server.match(/function sitemap\(origin, eligibleCountrySlugs = \[\]\) \{ const paths = \[(.*?)\];/);
  assert.ok(sitemapMatch, "sitemap path list should be present");
  assert.doesNotMatch(sitemapMatch[1], /["']\/live\/?["']/);
  assert.match(sitemapMatch[1], /["']\/broadcast["']/);

  const broadcastHtml = fs.readFileSync(path.join(__dirname, "..", "public", "broadcast.html"), "utf8");
  assert.match(broadcastHtml, /<link rel="canonical" href="https:\/\/nightcamfinds\.com\/broadcast">/);
  assert.doesNotMatch(broadcastHtml, /<link rel="canonical" href="https:\/\/nightcamfinds\.com\/broadcast\/">/);
  assert.equal(canonicalSeoRedirectPath("/broadcast/"), "/broadcast");
});


test("priority category metadata is concise and rendered into server HTML", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  for (const [category, title] of [
    ["female", "Female Live Cams Online | NightCamFinds"],
    ["male", "Male Live Cams Online | NightCamFinds"],
    ["couples", "Couples Live Cams Online | NightCamFinds"]
  ]) {
    const block = server.match(new RegExp("\\b" + category + ": \\{([\\s\\S]*?)\\n    \\}"));
    assert.ok(block, category + " SEO metadata should exist");
    assert.ok(block[1].includes("title: \"" + title + "\""), category + " title should be explicit");
    const description = block[1].match(/description: "([^"]+)"/);
    assert.ok(description, category + " description should exist");
    assert.ok(description[1].length <= 160, category + " description should be 160 characters or fewer");
  }
  assert.ok(server.includes("seoTitle") && server.includes("categorySeo.description"), "server should render explicit category metadata");
});

test("broadcaster page title stays within the recommended title length", () => {
  const broadcast = fs.readFileSync(path.join(__dirname, "..", "public", "broadcast.html"), "utf8");
  const titleStart = broadcast.indexOf("<title>") + "<title>".length;
  const titleEnd = broadcast.indexOf("</title>", titleStart);
  const title = titleEnd >= titleStart ? broadcast.slice(titleStart, titleEnd) : "";
  assert.ok(title);
  assert.ok(title.length <= 60);
});


test("category SEO renderer outputs real metadata and eligible country links", () => {
  const baseHtml = [
    "<html><head>",
    "<title>Old title</title>",
    '<meta name="description" content="Old description">',
    '<meta property="og:title" content="Old OG title">',
    '<meta property="og:description" content="Old OG description">',
    "</head><body><main></main><footer></footer></body></html>"
  ].join("");
  const description = "Browse public male live webcam rooms and compare current activity and room details before visiting a partner platform.";
  const rendered = renderCategorySeoHtml(baseHtml, {
    name: "Male live webcam rooms",
    title: "Male Live Cams Online | NightCamFinds",
    description,
    currentPath: "/male/",
    paragraphs: ["Compare current room details."]
  }, "https://nightcamfinds.com/male/", [
    { name: "United States", href: "/country/us/" },
    { name: "Germany", href: "/country/de/" },
    { name: "Unapproved market", href: "/country/zz/" },
    { name: "Invalid path", href: "/country/us" }
  ]);

  assert.ok(rendered.includes("<title>Male Live Cams Online | NightCamFinds</title>"));
  assert.ok(rendered.includes('<meta name="description" content="' + description + '">'));
  assert.ok(rendered.includes('<meta property="og:title" content="Male Live Cams Online | NightCamFinds">'));
  assert.ok(rendered.includes('<meta property="og:description" content="' + description + '">'));
  assert.ok(rendered.includes('<a href="/country/us/">United States rooms</a>'));
  assert.ok(rendered.includes('<a href="/country/de/">Germany rooms</a>'));
  assert.doesNotMatch(rendered, /Unapproved market|Invalid path/);
  assert.ok(!rendered.includes('<a href="/male/">Male rooms</a>'));
});
