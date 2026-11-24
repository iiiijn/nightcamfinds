(() => {
  const pages = {
    "us-female-live-cams": { country: "US", category: "female", title: "US Female Live Cams — NightCamFinds", description: "Discover female live cam rooms associated with the United States. Browse current activity and open rooms through NightCamFinds." },
    "uk-female-live-cams": { country: "GB", category: "female", title: "UK Female Live Cams — NightCamFinds", description: "Discover female live cam rooms associated with the United Kingdom. Browse current activity and open rooms through NightCamFinds." },
    "canada-female-live-cams": { country: "CA", category: "female", title: "Canada Female Live Cams — NightCamFinds", description: "Discover female live cam rooms associated with Canada. Browse current activity and open rooms through NightCamFinds." },
    "germany-female-live-cams": { country: "DE", category: "female", title: "Germany Female Live Cams — NightCamFinds", description: "Discover female live cam rooms associated with Germany. Browse current activity and open rooms through NightCamFinds." },
    "us-male-live-cams": { country: "US", category: "male", title: "US Male Live Cams — NightCamFinds", description: "Discover male live cam rooms associated with the United States. Browse current activity and open rooms through NightCamFinds." },
    "uk-male-live-cams": { country: "GB", category: "male", title: "UK Male Live Cams — NightCamFinds", description: "Discover male live cam rooms associated with the United Kingdom. Browse current activity and open rooms through NightCamFinds." },
    "us-trans-live-cams": { country: "US", category: "trans", title: "US Trans Live Cams — NightCamFinds", description: "Discover trans live cam rooms associated with the United States. Browse current activity and open rooms through NightCamFinds." },
    "uk-trans-live-cams": { country: "GB", category: "trans", title: "UK Trans Live Cams — NightCamFinds", description: "Discover trans live cam rooms associated with the United Kingdom. Browse current activity and open rooms through NightCamFinds." }
  };
  const path = location.pathname.replace(/^\/+|\/+$/g, "");
  const page = pages[path];
  if (!page) return;
  document.title = page.title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", page.description);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = `${location.origin}/${path}/`;
  const h1 = document.querySelector("#page-title");
  if (h1) h1.textContent = page.title.replace(" — NightCamFinds", "");
  const intro = document.querySelector("#page-intro");
  if (intro) intro.textContent = `Browse ${page.category} live cam rooms associated with this market and compare current viewer activity before opening a room.`;
  const seo = document.querySelector(".seo-content");
  if (seo) {
    const h2 = seo.querySelector("h2");
    if (h2) h2.textContent = `Explore ${page.category} live cams from ${page.country}`;
    const p = seo.querySelector("p:not(.eyebrow)");
    if (p) p.textContent = `NightCamFinds helps visitors discover currently listed ${page.category} rooms associated with this country. Listings and viewer activity can change throughout the day, so use the live directory to compare current options.`;
    const section = document.createElement("div");
    section.className = "seo-money-links";
    section.innerHTML = `<h2>Explore related live cam pages</h2><p><a href="/us-live-cams/">US live cams</a> · <a href="/uk-live-cams/">UK live cams</a> · <a href="/canada-live-cams/">Canada live cams</a> · <a href="/germany-live-cams/">Germany live cams</a> · <a href="/female/">Female live cams</a> · <a href="/male/">Male live cams</a> · <a href="/trans/">Trans live cams</a> · <a href="/guides/best-live-cam-sites.html">Best live cam sites guide</a></p>`;
    seo.appendChild(section);
  }
  const select = document.querySelector("#country");
  const category = document.querySelector("#category");
  const apply = () => {
    if (select) { const opt = [...select.options].find(o => o.value === page.country); if (opt) select.value = page.country; }
    if (category) { const opt = [...category.options].find(o => o.value === page.category); if (opt) category.value = page.category; }
    if (select) select.dispatchEvent(new Event("change", { bubbles: true }));
    if (category) category.dispatchEvent(new Event("change", { bubbles: true }));
  };
  apply();
  setTimeout(apply, 500);
})();
