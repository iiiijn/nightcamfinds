"use strict";

function escapeSeoHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function renderCategorySeoHtml(html, categorySeo, categoryUrl, countryLinks = []) {
  if (!html || !categorySeo) return html;
  const escape = escapeSeoHtml;
  const relatedCategories = [
    ["Female rooms", "/female/"], ["Male rooms", "/male/"],
    ["Trans rooms", "/trans/"], ["Couples rooms", "/couples/"],
    ["Browse by country", "/countries/"]
  ];
  const relatedLinks = relatedCategories
    .filter(([, href]) => !categorySeo.currentPath || href !== categorySeo.currentPath)
    .map(([label, href]) => `<a href="${href}">${escape(label)}</a>`)
    .join(" · ");
  const countryLinkMarkup = countryLinks
    .filter((item) => item && /^\/country\/[a-z]{2}\/$/.test(item.href) && item.name)
    .map((item) => `<a href="${item.href}">${escape(item.name)} rooms</a>`)
    .join(" · ");
  const countryNav = countryLinkMarkup
    ? `<nav aria-label="Eligible country room directories"><p>Browse rooms by country: ${countryLinkMarkup}</p></nav>`
    : "";
  const seoSection = `<section class="content-section category-seo-content" aria-labelledby="category-seo-heading">
      <p class="eyebrow">NightCamFinds room directory</p>
      <h2 id="category-seo-heading">${escape(categorySeo.name)}</h2>
      <p>${escape(categorySeo.description)}</p>
      ${(categorySeo.paragraphs || []).map((paragraph) => `<p>${escape(paragraph)}</p>`).join("")}
      <nav aria-label="Related room categories"><p>Explore more: ${relatedLinks}</p></nav>
      ${countryNav}
    </section>`;
  html = html.replace("<footer>", `${seoSection}<footer>`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categorySeo.name,
    description: categorySeo.description,
    url: categoryUrl,
    isPartOf: { "@type": "WebSite", name: "NightCamFinds", url: new URL(categoryUrl).origin }
  };
  const jsonLd = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  const seoTitle = categorySeo.title || categorySeo.fallbackTitle || "";
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(seoTitle)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(categorySeo.description)}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escape(seoTitle)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escape(categorySeo.description)}">`);
  html = html.replace("</head>", `<script type="application/ld+json">${jsonLd}</script></head>`);
  return html;
}

module.exports = { renderCategorySeoHtml };
