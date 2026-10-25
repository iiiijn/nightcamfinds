(() => {
  const path = location.pathname.replace(/^\/+|\/+$/g, "") || "home";
  const pages = {
    home: { title: "Live cams now — NightCamFinds", description: "Discover live adult cam rooms by category, country and current viewer activity on NightCamFinds.", heading: "Find live cams worth clicking", copy: "NightCamFinds helps adults discover live rooms across Chaturbate and BongaCams. Compare categories, countries and current activity, then continue to the partner platform to watch and chat." },
    live: { title: "Live cams now — NightCamFinds", description: "Find live adult cam rooms that are online now. Browse current rooms by country, category and viewer activity.", heading: "Find live cams online now", copy: "Start with rooms that are currently online. Viewer counts and availability can change quickly, so NightCamFinds is designed for current live-room discovery rather than fixed listings." },
    female: { title: "Female live cams — NightCamFinds", description: "Browse female live cam rooms by country and current viewer activity on NightCamFinds.", heading: "Finding female live cams", copy: "Browse female broadcasters who are currently online, compare viewer activity and country, and open a room through the tracked partner link." },
    male: { title: "Male live cams — NightCamFinds", description: "Browse male live cam rooms by country and current viewer activity on NightCamFinds.", heading: "Finding male live cams", copy: "The male directory helps you discover rooms categorized as male by the available partner feeds. Compare current activity and country before opening a room." },
    trans: { title: "Trans live cams — NightCamFinds", description: "Discover live trans cam rooms by country and viewer activity on NightCamFinds.", heading: "Finding trans live cams", copy: "Browse rooms categorized as trans by the partner feeds. Availability changes as broadcasters go online and offline, so use the live filters when choosing a room." },
    couples: { title: "Couple live cams — NightCamFinds", description: "Find live couple cam rooms by country and current viewer activity on NightCamFinds.", heading: "Finding couple live cams", copy: "Use the couples section to discover rooms categorized as couples. Browse current activity and country, then continue to the partner platform for video and chat." },
    hd: { title: "HD live cams — NightCamFinds", description: "Browse live rooms marked HD and compare current viewer activity on NightCamFinds.", heading: "Finding HD live cams", copy: "Browse rooms marked HD by the partner feeds. HD labels are supplied by the source platform, while actual streaming quality can also depend on the broadcaster, device and network." },
    new: { title: "New live cam broadcasters — NightCamFinds", description: "Discover new live cam broadcasters and browse rooms marked new by partner feeds.", heading: "Discover new broadcasters", copy: "The new section helps you discover broadcasters marked as new by the partner feed. Listings change as new rooms appear and broadcasters go offline." },
    popular: { title: "Popular live cams — NightCamFinds", description: "Discover popular live cam rooms and compare current viewer activity on NightCamFinds.", heading: "Popular live cam rooms", copy: "Start with rooms currently attracting more viewers. Popularity changes throughout the day as broadcasters and audiences move between rooms." },
    countries: { title: "Live cams by country — NightCamFinds", description: "Browse live cam rooms by country and compare current viewer activity on NightCamFinds.", heading: "Live cams by country", copy: "Country browsing lets you focus discovery on broadcasters associated with a particular country. It is also useful when comparing international traffic markets." },
    "us-live-cams": { title: "US live cams — NightCamFinds", description: "Browse live cam rooms associated with the United States and compare current viewer activity.", heading: "US live cams", copy: "Browse rooms associated with the United States and compare current activity before opening a live room. Availability changes throughout the day.", country: "US" },
    "uk-live-cams": { title: "UK live cams — NightCamFinds", description: "Browse live cam rooms associated with the United Kingdom and compare current viewer activity.", heading: "UK live cams", copy: "Discover rooms associated with the United Kingdom and compare current viewer activity before continuing to a partner platform.", country: "GB" },
    "canada-live-cams": { title: "Canada live cams — NightCamFinds", description: "Browse live cam rooms associated with Canada and compare current viewer activity.", heading: "Canada live cams", copy: "Browse rooms associated with Canada and use the live directory to compare current activity, categories and platforms.", country: "CA" },
    "australia-live-cams": { title: "Australia live cams — NightCamFinds", description: "Browse live cam rooms associated with Australia and compare current viewer activity.", heading: "Australia live cams", copy: "Discover rooms associated with Australia and compare current viewer activity before opening a room on the partner site.", country: "AU" },
    "germany-live-cams": { title: "Germany live cams — NightCamFinds", description: "Browse live cam rooms associated with Germany and compare current viewer activity.", heading: "Germany live cams", copy: "Browse rooms associated with Germany and compare current activity, category and platform before opening a live room.", country: "DE" },
    "france-live-cams": { title: "France live cams — NightCamFinds", description: "Browse live cam rooms associated with France and compare current viewer activity.", heading: "France live cams", copy: "Discover rooms associated with France and compare current activity before continuing to the partner platform.", country: "FR" },
    "netherlands-live-cams": { title: "Netherlands live cams — NightCamFinds", description: "Browse live cam rooms associated with the Netherlands and compare current activity.", heading: "Netherlands live cams", copy: "Browse rooms associated with the Netherlands and compare current activity, category and platform before opening a room.", country: "NL" }
  };

  const page = pages[path] || pages.home;
  document.title = page.title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", page.description);
  const h1 = document.querySelector("#page-title");
  if (h1) h1.textContent = page.heading;
  const intro = document.querySelector("#page-intro");
  if (intro) intro.textContent = page.copy;
  const seo = document.querySelector(".seo-content");
  if (seo) {
    const h2 = seo.querySelector("h2");
    if (h2) h2.textContent = page.heading;
    const paragraphs = seo.querySelectorAll("p:not(.eyebrow)");
    if (paragraphs[0]) paragraphs[0].textContent = page.copy;
  }

  const links = [
    ["US live cams", "/us-live-cams/"], ["UK live cams", "/uk-live-cams/"], ["Canada live cams", "/canada-live-cams/"],
    ["Australia live cams", "/australia-live-cams/"], ["Germany live cams", "/germany-live-cams/"], ["France live cams", "/france-live-cams/"], ["Netherlands live cams", "/netherlands-live-cams/"]
  ];
  const quick = document.querySelector("#quick");
  if (quick && !quick.querySelector(".seo-country-links")) {
    const nav = document.createElement("div");
    nav.className = "seo-country-links";
    nav.setAttribute("aria-label", "Country live cam pages");
    nav.innerHTML = `<span class="muted">Country pages:</span> ${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join(" · ")}`;
    quick.parentElement?.appendChild(nav);
  }

  const categoryLinks = [
    ["Female live cams", "/female/"], ["Male live cams", "/male/"], ["Trans live cams", "/trans/"],
    ["Couple live cams", "/couples/"], ["HD live cams", "/hd/"], ["New broadcasters", "/new/"], ["Popular live cams", "/popular/"]
  ];
  const guideLinks = [
    ["Best live cam sites", "/guides/best-live-cam-sites.html"],
    ["Chaturbate vs BongaCams", "/guides/chaturbate-vs-bongacams.html"],
    ["How live cam sites work", "/guides/how-live-cam-sites-work.html"],
    ["Live cams by country guide", "/guides/find-live-cams-by-country.html"],
    ["Privacy and safety guide", "/guides/live-cam-privacy-and-safety.html"],
    ["How to choose a live cam room", "/guides/how-to-choose-a-live-cam-room.html"]
  ];
  const addRelated = () => {
    const seoContent = document.querySelector(".seo-content");
    if (!seoContent || seoContent.querySelector(".seo-related-links")) return;
    const section = document.createElement("div");
    section.className = "seo-related-links";
    section.innerHTML = `<h2>Explore more live cam categories</h2><p>${categoryLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join(" · ")}</p><h2>Helpful live cam guides</h2><p>${guideLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join(" · ")}</p>`;
    seoContent.appendChild(section);
  };
  addRelated();

  if (page.country) {
    const select = document.querySelector("#country");
    const setCountry = () => {
      if (!select) return false;
      const option = [...select.options].find(o => o.value === page.country);
      if (!option) return false;
      select.value = page.country;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    if (!setCountry()) {
      const timer = setInterval(() => { if (setCountry()) clearInterval(timer); }, 250);
      setTimeout(() => clearInterval(timer), 10000);
    }
  }
})();
