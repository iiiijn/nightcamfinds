"use strict";

const COUNTRIES = {
  us: {
    code: "US", name: "United States", adjective: "United States", region: "the United States",
    intro: "Explore public live rooms associated with the United States. NightCamFinds helps adult visitors compare currently listed rooms, viewer activity, categories and partner platforms before choosing where to continue. Listings come from partner feeds, so availability, room subjects and viewer counts can change without notice.",
    paragraphs: [
      "Use the category links to narrow the directory to female, male, trans or couples rooms. Where a broadcaster feed supplies a country label, it can help you discover rooms associated with the United States; it is not a guarantee of a performer's residence or nationality.",
      "NightCamFinds is an independent discovery directory, not a streaming service. Selecting a room takes you to the relevant partner platform, where its own account rules, age requirements, privacy policy and payment terms apply. Review those terms before registering or spending.",
      "For visitors in different US time zones, the directory can be useful at different points in the day. A room marked live is simply a snapshot from the feed, not a promise that the broadcaster will remain online. Compare the room description and category, then use the partner site's own controls to decide whether to stay, follow or leave.",
    ],
    faqs: [
      ["Are these rooms hosted by NightCamFinds?", "No. NightCamFinds lists public room information and links to partner platforms. Video and account activity take place on those platforms."],
      ["Are all listed broadcasters in the United States?", "Not necessarily. Country labels depend on information supplied in partner feeds and may be missing or inaccurate."],
      ["Does opening a room cost money?", "Browsing this directory is free. Partner platforms may offer free public rooms and paid features; check their terms before making a purchase."]
    ]
  },
  gb: {
    code: "GB", name: "United Kingdom", adjective: "UK", region: "the United Kingdom",
    intro: "Browse public live rooms associated with the United Kingdom and compare the information available before visiting a partner platform. NightCamFinds brings together room listings, categories and current viewer activity in one independent directory. Live feeds update frequently, so a room may go offline or its viewer count may change between visits.",
    paragraphs: [
      "Choose a category to explore female, male, trans or couples rooms. A UK country label reflects the country information supplied by a partner feed; it should not be treated as independently verified identity or location information.",
      "NightCamFinds does not host streams or process partner-platform payments. When you select a room, you continue to the platform that operates it. Check that platform's age rules, privacy information and pricing before creating an account or purchasing anything.",
      "Visitors across the UK may see different room activity depending on the time of day and broadcaster schedules. The directory is intended for discovery, not as a ranking of people or a guarantee of availability. Check the room details shown by the partner platform and use its reporting, privacy and account controls if you decide to interact.",
    ],
    faqs: [
      ["Does NightCamFinds stream the rooms?", "No. The directory links to public listings on partner platforms, where the video and account services are provided."],
      ["Does a UK label verify where a broadcaster lives?", "No. It is based on partner-feed information and may be incomplete or inaccurate."],
      ["Are paid features included in this directory?", "No. Browsing NightCamFinds is free. Any paid features are offered and charged by the partner platform under its own terms."]
    ]
  },
  ca: {
    code: "CA", name: "Canada", adjective: "Canadian", region: "Canada",
    intro: "Discover public live rooms associated with Canada through the NightCamFinds directory. Compare room categories, available descriptions and live viewer activity before choosing a partner platform. Listings are supplied by external feeds and can change throughout the day, which means a room shown here may no longer be online when you open it.",
    paragraphs: [
      "Browse female, male, trans and couples categories to narrow the listings. Country labels are displayed only when partner feeds provide country information. They are not independent verification of a broadcaster's location, citizenship or identity.",
      "NightCamFinds is a directory rather than a streaming or payment service. Room links take visitors to external partner platforms. Read the relevant platform's privacy policy, age requirements and payment terms before registering or using paid features.",
      "Activity can vary across Canadian time zones, and listings may include broadcasters from other locations as well. Use the country filter as a discovery aid rather than proof of where someone lives. Before interacting, review the room description on the partner site and make your own decision about whether its community rules and features suit you.",
    ],
    faqs: [
      ["Are the listings guaranteed to be online?", "No. Room availability and viewer counts change as broadcasters start and stop streaming."],
      ["Does a Canada label prove a broadcaster is Canadian?", "No. The label comes from partner-feed data and is not independently verified."],
      ["Who handles accounts and payments?", "The partner platform does. NightCamFinds does not host streams or process broadcaster-platform payments."]
    ]
  },
  au: {
    code: "AU", name: "Australia", adjective: "Australian", region: "Australia",
    intro: "Find public live rooms associated with Australia in the NightCamFinds directory. The page helps adult visitors compare available categories, room details and current viewer activity before continuing to a partner platform. Because listings are drawn from live external feeds, availability and room information can change quickly.",
    paragraphs: [
      "Use the category links to browse female, male, trans and couples rooms. Country information appears when a partner feed supplies it, but it should not be understood as verified residence, nationality or identity information.",
      "NightCamFinds does not host video, operate performer accounts or take payments for partner services. Selecting a listing opens the relevant external platform. Check its age requirements, privacy policy and pricing, and make sure any purchase is appropriate for you.",
      "Australian visitors may see room activity change with local time and broadcaster schedules in other parts of the world. The directory does not promise that a particular room will be available at a specific hour. Treat viewer counts as a momentary indicator, read the room information and check the partner platform's rules before interacting.",
    ],
    faqs: [
      ["Does NightCamFinds host live video?", "No. Video is provided by the external partner platform after you follow a room link."],
      ["Are all rooms based in Australia?", "No. A country label is based on partner-feed data and may be absent or inaccurate."],
      ["Can room availability change?", "Yes. Listings reflect live feeds and may change or disappear as broadcasters go offline."]
    ]
  },
  de: {
    code: "DE", name: "Germany", adjective: "German", region: "Germany",
    intro: "Entdecken Sie öffentliche Live-Räume mit Deutschland-Bezug im NightCamFinds-Verzeichnis. Vergleichen Sie verfügbare Kategorien, Rauminformationen und aktuelle Zuschauerzahlen, bevor Sie zur jeweiligen Partnerplattform wechseln. Die Angaben stammen aus externen Feeds und können sich jederzeit ändern. Ein Raum ist möglicherweise nicht mehr live, wenn Sie ihn öffnen.",
    paragraphs: [
      "Über die Kategorie-Links finden Sie Angebote aus den Bereichen Female, Male, Trans und Paare. Ein Länderhinweis wird nur angezeigt, wenn der Partner-Feed entsprechende Daten liefert. Er bestätigt weder Wohnort noch Staatsangehörigkeit oder Identität einer Person.",
      "NightCamFinds ist ein unabhängiges Verzeichnis und hostet keine Videos. Beim Öffnen eines Raums wechseln Sie zur jeweiligen Partnerplattform. Bitte prüfen Sie dort Altersvorgaben, Datenschutzinformationen und Preise, bevor Sie ein Konto erstellen oder kostenpflichtige Funktionen nutzen.",
      "Die Aktivität kann je nach Tageszeit und Zeitzone unterschiedlich ausfallen. Die angezeigten Zuschauerzahlen sind Momentaufnahmen und keine Garantie für die Qualität oder Verfügbarkeit eines Angebots. Lesen Sie die Raumbeschreibung auf der Partnerseite und entscheiden Sie selbst, ob Sie den Chat nutzen möchten. Beachten Sie dabei die dort geltenden Community-Regeln.",
    ],
    faqs: [
      ["Werden die Videos auf NightCamFinds übertragen?", "Nein. Die Videos werden von der jeweiligen Partnerplattform bereitgestellt."],
      ["Bestätigt das Deutschland-Label den Wohnort?", "Nein. Es basiert auf Angaben im Partner-Feed und ist nicht unabhängig überprüft."],
      ["Ist das Verzeichnis kostenpflichtig?", "Das Stöbern auf NightCamFinds ist kostenlos. Kostenpflichtige Funktionen können auf Partnerplattformen angeboten werden."]
    ]
  },
  fr: {
    code: "FR", name: "France", adjective: "French", region: "France",
    intro: "Découvrez dans l'annuaire NightCamFinds des salons publics en direct associés à la France. Comparez les catégories, les informations disponibles et le nombre actuel de spectateurs avant de rejoindre une plateforme partenaire. Les annonces proviennent de flux externes : la disponibilité et les informations peuvent donc changer à tout moment.",
    paragraphs: [
      "Les liens de catégorie permettent de parcourir les salons féminins, masculins, trans et couples. Le pays affiché dépend des données fournies par le flux partenaire. Il ne constitue pas une vérification indépendante du domicile, de la nationalité ou de l'identité d'une personne.",
      "NightCamFinds est un annuaire indépendant et n'héberge pas les vidéos. En ouvrant un salon, vous accédez à la plateforme partenaire correspondante. Consultez ses conditions d'âge, sa politique de confidentialité et ses tarifs avant toute inscription ou dépense.",
      "L'activité peut varier selon l'heure et les horaires des diffuseurs. Le nombre de spectateurs affiché est une indication momentanée, et non une garantie de disponibilité ou de qualité. Prenez le temps de lire la description du salon sur la plateforme partenaire et de consulter ses règles de communauté avant de participer à une conversation ou d'utiliser une fonction payante.",
    ],
    faqs: [
      ["Les vidéos sont-elles hébergées par NightCamFinds ?", "Non. Les vidéos et les comptes sont gérés par les plateformes partenaires."],
      ["L'étiquette France confirme-t-elle le lieu de résidence ?", "Non. Elle provient des données du flux partenaire et n'est pas vérifiée indépendamment."],
      ["L'annuaire est-il payant ?", "La navigation sur NightCamFinds est gratuite. Certaines fonctions des plateformes partenaires peuvent être payantes."]
    ]
  },
  nl: {
    code: "NL", name: "Netherlands", adjective: "Dutch", region: "Nederland",
    intro: "Ontdek openbare livekamers die volgens partnerfeeds met Nederland in verband worden gebracht. NightCamFinds helpt je beschikbare categorieën, kamerinformatie en actuele kijkersaantallen te vergelijken voordat je naar een partnerplatform gaat. De gegevens komen uit externe feeds en kunnen snel veranderen. Een kamer is mogelijk niet meer live wanneer je deze opent.",
    paragraphs: [
      "Gebruik de categorielinks om vrouwelijke, mannelijke, trans- en koppelskamers te bekijken. Een landvermelding wordt alleen getoond wanneer een partnerfeed landgegevens aanlevert. Dit is geen onafhankelijke bevestiging van iemands woonplaats, nationaliteit of identiteit.",
      "NightCamFinds is een onafhankelijke gids en host geen video's. Als je een kamer opent, ga je naar het bijbehorende partnerplatform. Controleer daar de leeftijdsvoorwaarden, het privacybeleid en de prijzen voordat je je registreert of betaalde functies gebruikt.",
      "De activiteit kan verschillen per tijdstip en volgens de planning van broadcasters. Het getoonde aantal kijkers is een momentopname en geen garantie dat een kamer beschikbaar blijft. Lees de kamerbeschrijving op het partnerplatform en bekijk de communityregels voordat je deelneemt aan een gesprek of een betaalde functie gebruikt.",
    ],
    faqs: [
      ["Worden de video's door NightCamFinds gehost?", "Nee. De video's worden aangeboden op het externe partnerplatform."],
      ["Bewijst het label Nederland waar iemand woont?", "Nee. Het label is gebaseerd op gegevens uit partnerfeeds en is niet onafhankelijk gecontroleerd."],
      ["Is NightCamFinds gratis te gebruiken?", "Het bekijken van de directory is gratis. Partnerplatforms kunnen betaalde functies aanbieden."]
    ]
  }
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function getCountryPage(slug, origin = "https://nightcamfinds.com", roomMarkup = "", hasRooms = false) {
  const country = COUNTRIES[String(slug || "").toLowerCase()];
  if (!country) return null;
  const canonical = `${origin.replace(/\/$/, "")}/country/${String(slug).toLowerCase()}/`;
  const title = `${country.name} Live Cams | NightCamFinds`;
  const description = `Browse public live rooms associated with ${country.name}. Compare categories and current activity on NightCamFinds.`;
  const paragraphs = [country.intro, ...country.paragraphs];
  const links = [
    ["Female live rooms", "/female/"], ["Male live rooms", "/male/"],
    ["Trans live rooms", "/trans/"], ["Couples live rooms", "/couples/"],
    ["All live rooms", "/live/"], ["Browse countries", "/countries/"]
  ];
  const faqHtml = country.faqs.map(([question, answer]) =>
    `<section class="country-faq-item"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></section>`
  ).join("");
  return `<!doctype html>
<html lang="${country.code === "DE" ? "de" : country.code === "FR" ? "fr" : country.code === "NL" ? "nl" : "en"}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${hasRooms ? "index,follow" : "noindex,follow"}"><link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css">
</head>
<body><main class="wrap legal country-landing">
<nav aria-label="Breadcrumb"><ol class="breadcrumbs"><li><a href="/">Home</a></li><li aria-current="page">${escapeHtml(country.name)}</li></ol></nav>
<header class="country-intro"><p class="eyebrow">NightCamFinds country directory</p><h1>${escapeHtml(country.name)} Live Cams</h1>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</header>
<section class="country-live-rooms" aria-labelledby="country-live-heading"><h2 id="country-live-heading">Live rooms associated with ${escapeHtml(country.name)}</h2><div class="grid">${roomMarkup || '<p class="empty-state">No live rooms are available in this directory right now. Please check again soon.</p>'}</div></section>
<section aria-labelledby="country-categories"><h2 id="country-categories">Explore room categories</h2>
<ul class="country-links">${links.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul></section>
<section aria-labelledby="country-faq"><h2 id="country-faq">Frequently asked questions</h2>${faqHtml}</section>
<p class="country-disclosure">NightCamFinds is an independent directory. Room listings and country information are supplied by partner feeds and may be incomplete or out of date. Some links are affiliate links.</p>
<p><a class="btn" href="/live/">Browse live rooms</a></p>
</main></body></html>`;
}

module.exports = { COUNTRIES, getCountryPage };
