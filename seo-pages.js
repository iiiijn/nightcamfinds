(() => {
  const path = location.pathname.replace(/^\/+|\/+$/g, "") || "home";
  const pages = {
    home: {
      title: "Live cams now — NightCamFinds",
      description: "Discover live adult cam rooms by category, country and current viewer activity on NightCamFinds.",
      heading: "Find live cams worth clicking",
      copy: "NightCamFinds helps adults discover live rooms across Chaturbate and BongaCams. Compare categories, countries and current activity, then continue to the partner platform to watch and chat."
    },
    live: {
      title: "Live cams now — NightCamFinds",
      description: "Find live adult cam rooms that are online now. Browse current rooms by country, category and viewer activity.",
      heading: "Find live cams online now",
      copy: "Start with rooms that are currently online. Viewer counts and availability can change quickly, so NightCamFinds is designed for current live-room discovery rather than fixed listings."
    },
    female: {
      title: "Female live cams — NightCamFinds",
      description: "Browse female live cam rooms by country and current viewer activity on NightCamFinds.",
      heading: "Finding female live cams",
      copy: "Browse female broadcasters who are currently online, compare viewer activity and country, and open a room through the tracked partner link."
    },
    male: {
      title: "Male live cams — NightCamFinds",
      description: "Browse male live cam rooms by country and current viewer activity on NightCamFinds.",
      heading: "Finding male live cams",
      copy: "The male directory helps you discover rooms categorized as male by the available partner feeds. Compare current activity and country before opening a room."
    },
    trans: {
      title: "Trans live cams — NightCamFinds",
      description: "Discover live trans cam rooms by country and viewer activity on NightCamFinds.",
      heading: "Finding trans live cams",
      copy: "Browse rooms categorized as trans by the partner feeds. Availability changes as broadcasters go online and offline, so use the live filters when choosing a room."
    },
    couples: {
      title: "Couple live cams — NightCamFinds",
      description: "Find live couple cam rooms by country and current viewer activity on NightCamFinds.",
      heading: "Finding couple live cams",
      copy: "Use the couples section to discover rooms categorized as couples. Browse current activity and country, then continue to the partner platform for video and chat."
    },
    hd: {
      title: "HD live cams — NightCamFinds",
      description: "Browse live rooms marked HD and compare current viewer activity on NightCamFinds.",
      heading: "Finding HD live cams",
      copy: "Browse rooms marked HD by the partner feeds. HD labels are supplied by the source platform, while actual streaming quality can also depend on the broadcaster, device and network."
    },
    new: {
      title: "New live cam broadcasters — NightCamFinds",
      description: "Discover new live cam broadcasters and browse rooms marked new by partner feeds.",
      heading: "Discover new broadcasters",
      copy: "The new section helps you discover broadcasters marked as new by the partner feed. Listings change as new rooms appear and broadcasters go offline."
    },
    popular: {
      title: "Popular live cams — NightCamFinds",
      description: "Discover popular live cam rooms and compare current viewer activity on NightCamFinds.",
      heading: "Popular live cam rooms",
      copy: "Start with rooms currently attracting more viewers. Popularity changes throughout the day as broadcasters and audiences move between rooms."
    },
    countries: {
      title: "Live cams by country — NightCamFinds",
      description: "Browse live cam rooms by country and compare current viewer activity on NightCamFinds.",
      heading: "Live cams by country",
      copy: "Country browsing lets you focus discovery on broadcasters associated with a particular country. It is also useful when comparing international traffic markets."
    }
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
})();
