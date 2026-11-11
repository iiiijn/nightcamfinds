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
  },
  ie: {
    code: "IE", name: "Ireland", adjective: "Irish", region: "Ireland", language: "en-IE",
    intro: "Explore public live rooms associated with Ireland in the NightCamFinds country directory. The page brings together room listings and the country information supplied by partner feeds, helping adult visitors compare available categories and viewer activity before choosing an external platform. Feed details can change throughout the day, and a room shown as live may be offline by the time you open it.",
    paragraphs: [
      "Use the category links to browse female, male, trans and couples rooms. An Ireland label is a discovery signal based on partner-feed data, not independent proof of a broadcaster's residence, nationality or identity. Some listings may have no country information at all.",
      "NightCamFinds is an independent directory, not a streaming, messaging or payment service. Selecting a room takes you to Chaturbate or BongaCams, where the partner platform controls accounts, video, moderation and transactions. Read its age requirements, privacy information and payment terms before registering or using paid features.",
      "Room activity can vary between Dublin, Cork, Galway and other parts of Ireland simply because visitors and broadcasters follow different schedules. Viewer counts are snapshots rather than guarantees. Check the room description on the partner platform and use its own safety and reporting controls if you decide to interact."
    ],
    faqs: [
      ["Does NightCamFinds host the video?", "No. The directory lists public room information and sends visitors to the external partner platform."],
      ["Does an Ireland label verify someone's location?", "No. Country labels come from partner-feed information and are not independently verified."],
      ["Are partner-platform features free?", "Browsing this directory is free. Partner platforms may offer paid features under their own pricing and terms."]
    ]
  },
  nz: {
    code: "NZ", name: "New Zealand", adjective: "New Zealand", region: "New Zealand", language: "en-NZ",
    intro: "Discover public live rooms associated with New Zealand through the NightCamFinds country directory. Compare the room categories, descriptions and viewer activity made available by partner feeds before continuing to an external platform. Live listings are temporary snapshots, so availability and room details can change between visits.",
    paragraphs: [
      "Browse female, male, trans and couples categories using the links below. A New Zealand country label reflects information supplied by a partner feed. It does not independently confirm a broadcaster's home, citizenship or identity, and some feeds may omit country details.",
      "NightCamFinds is a discovery directory and does not host video or handle partner-platform accounts and payments. When you open a room, the relevant partner platform provides the stream and its own account services. Review the platform's age rules, privacy policy and prices before signing up or purchasing anything.",
      "New Zealand spans multiple local schedules, while broadcasters may be streaming from elsewhere. A room marked live can go offline without notice, and viewer counts can rise or fall quickly. Read the room information on the partner platform and rely on its own community, privacy and reporting controls when deciding whether to participate."
    ],
    faqs: [
      ["Are rooms streamed on NightCamFinds?", "No. Video is supplied by the external platform after you follow a room link."],
      ["Does the country label prove a broadcaster is in New Zealand?", "No. It is based on partner-feed data and may be incomplete or inaccurate."],
      ["Can room availability change?", "Yes. Listings reflect changing partner feeds and are not a guarantee that a room will remain online."]
    ]
  },
  se: {
    code: "SE", name: "Sweden", adjective: "Swedish", region: "Sweden", language: "sv-SE",
    intro: "Browse public live rooms associated with Sweden in the NightCamFinds country directory. The directory helps adult visitors compare available categories, room descriptions and current viewer activity before visiting a partner platform. Listings are supplied by external feeds and may change as broadcasters start, pause or end a session.",
    paragraphs: [
      "Use the category links to explore female, male, trans and couples rooms. A Sweden label is based on country information supplied by a partner feed. It is not independent verification of a person's residence, nationality or identity, and not every listing includes a country value.",
      "NightCamFinds is an independent directory rather than a streaming service. Room links lead to Chaturbate or BongaCams, where video, accounts, moderation and payments are managed. Check the partner platform's age requirements, privacy policy and pricing before creating an account or using a paid feature.",
      "Activity can differ by time of day and broadcaster schedule, including across Stockholm, Gothenburg and other Swedish locations. Viewer counts are momentary feed data, not a promise of continued availability. Review the room details on the partner platform and use its own privacy and reporting tools if you choose to interact."
    ],
    faqs: [
      ["Does NightCamFinds provide the stream?", "No. It lists public room details and links to the platform that hosts the video."],
      ["Is a Sweden label independently verified?", "No. It reflects country information received from a partner feed."],
      ["Do I pay NightCamFinds to browse?", "No. Directory browsing is free. Any paid services are offered by the partner platform under its terms."]
    ]
  },
  no: {
    code: "NO", name: "Norway", adjective: "Norwegian", region: "Norway", language: "nb-NO",
    intro: "Find public live rooms associated with Norway through the NightCamFinds country directory. The page brings partner-feed listings together so adult visitors can compare room categories, available descriptions and current viewer activity before moving to an external platform. Feed information changes frequently, so a room may no longer be live when opened.",
    paragraphs: [
      "Choose a category to browse female, male, trans or couples rooms. A Norway label is drawn from partner-feed country information and should be treated as a discovery aid, not proof of a broadcaster's location, citizenship or identity. Country details may be missing or inaccurate.",
      "NightCamFinds does not host streams, operate performer accounts or process partner payments. Selecting a listing takes you to the platform responsible for the room. Read its age requirements, privacy policy, community rules and pricing before registering or using paid features.",
      "Room activity can vary throughout the day and across Norwegian locations such as Oslo, Bergen and Trondheim. Viewer numbers are snapshots supplied by partner feeds, not a guarantee that a room will remain available. Check the room description and use the partner platform's own privacy, blocking and reporting controls when needed."
    ],
    faqs: [
      ["Are the videos hosted by NightCamFinds?", "No. The videos and accounts are provided by the external partner platforms."],
      ["Does a Norway label confirm where someone lives?", "No. It is based on partner-feed information and is not independently checked."],
      ["Are paid features part of this directory?", "No. Browsing is free. Partner platforms set their own prices for optional paid features."]
    ]
  },
  dk: {
    code: "DK", name: "Denmark", adjective: "Danish", region: "Denmark", language: "da-DK",
    intro: "Explore public live rooms associated with Denmark in the NightCamFinds country directory. Compare the categories, room information and viewer activity currently supplied by partner feeds before choosing an external platform. The listings are live-feed snapshots, so a broadcaster can go offline or details can change after the page loads.",
    paragraphs: [
      "The category links make it easier to browse female, male, trans and couples rooms. A Denmark label comes from country information in a partner feed. It is not independent confirmation of a broadcaster's residence, nationality or identity, and some room feeds do not provide a country value.",
      "NightCamFinds is an independent discovery directory. It does not stream video or manage partner accounts, chat or payments. Following a room link takes you to the relevant platform, where its own age requirements, privacy policy, community standards and prices apply. Review those details before registering or spending.",
      "Room activity changes with time zones and broadcaster schedules, including around Copenhagen, Aarhus and other Danish locations. Viewer counts are temporary indicators, not rankings or promises of availability. Read the room description on the partner site and use its privacy, blocking and reporting options if you decide to interact."
    ],
    faqs: [
      ["Does NightCamFinds stream rooms?", "No. It displays public listing information and links to the external streaming platform."],
      ["Is a Denmark country label proof of location?", "No. It is based on partner-feed information and may be incomplete."],
      ["Is browsing this directory paid?", "No. Browsing is free. Partner platforms may charge for their own optional features."]
    ]
  },
  fi: {
    code: "FI", name: "Finland", adjective: "Finnish", region: "Finland", language: "fi-FI",
    intro: "Browse public live rooms associated with Finland through the NightCamFinds country directory. Adult visitors can compare available room categories, descriptions and current viewer activity before continuing to a partner platform. Listings come from external feeds, which can update at any time and do not guarantee that a room will remain online.",
    paragraphs: [
      "Use the category links to explore female, male, trans and couples rooms. A Finland label is based on country information supplied by a partner feed. It is not independent verification of a person's home, nationality or identity, and some listings may not include country information.",
      "NightCamFinds is a directory, not a streaming or payment provider. Room links open the partner platform that operates the stream and account. Before registering or using paid features, check that platform's age requirements, privacy policy, community rules and current pricing.",
      "Live activity may vary by time of day and broadcaster schedule, including for visitors in Helsinki, Tampere, Turku and other Finnish locations. Viewer counts are snapshots and can change quickly. Read the room description on the partner platform and use its own privacy, blocking and reporting tools to manage your experience."
    ],
    faqs: [
      ["Who provides the live video?", "The external partner platform provides the stream. NightCamFinds only lists public room information."],
      ["Does a Finland label verify someone's identity or address?", "No. Country labels reflect partner-feed data and are not independently verified."],
      ["Can partner platforms charge for features?", "Yes. Directory browsing is free, but partner platforms set their own prices and terms."]
    ]
  },
  ch: {
    code: "CH", name: "Switzerland", adjective: "Swiss", region: "Switzerland", language: "de-CH",
    intro: "Discover public live rooms associated with Switzerland in the NightCamFinds country directory. Compare the categories, room descriptions and viewer activity supplied by partner feeds before continuing to an external platform. Switzerland is multilingual, and a country label alone does not indicate which language a broadcaster or visitor prefers.",
    paragraphs: [
      "Browse female, male, trans and couples rooms using the category links. A Switzerland label is based on partner-feed country information and is not independent proof of a broadcaster's residence, nationality or identity. Language information, when available, is shown separately from country data.",
      "NightCamFinds is an independent directory and does not host video, manage accounts or process partner payments. Selecting a room takes you to the relevant platform, where its own age requirements, privacy policy, community rules and prices apply. Review those terms before creating an account or making a purchase.",
      "Room activity can change throughout the day and across German-, French- and Italian-speaking parts of Switzerland. Viewer counts are temporary feed values rather than guarantees of availability. Read the room details on the partner platform and use its own privacy and reporting controls if you decide to interact."
    ],
    faqs: [
      ["Does NightCamFinds host the video?", "No. The stream and account services are provided by the external partner platform."],
      ["Does a Switzerland label prove where a broadcaster lives?", "No. It is based on partner-feed information and is not independently verified."],
      ["Does the country label identify a preferred language?", "No. Country and language are separate details, and language data may not be available."]
    ]
  },
  at: {
    code: "AT", name: "Austria", adjective: "Austrian", region: "Austria", language: "de-AT",
    intro: "Explore public live rooms associated with Austria through the NightCamFinds country directory. The page helps adult visitors compare available room categories, descriptions and current viewer activity before opening a partner platform. Listings are drawn from external feeds and may change quickly, so the room status shown here is not a guarantee of future availability.",
    paragraphs: [
      "Use the category links to browse female, male, trans and couples rooms. An Austria label reflects country information supplied by a partner feed. It is not independent confirmation of a broadcaster's residence, citizenship or identity, and some room listings may have no country value.",
      "NightCamFinds is an independent discovery directory, not a streaming or payment service. Following a room link takes you to the partner platform that operates it. Check that platform's age requirements, privacy policy, community rules and prices before registering or using paid features.",
      "Room activity can vary by time of day and broadcaster schedule, including around Vienna, Graz, Linz and other Austrian locations. Viewer counts are snapshots from partner feeds and may rise or fall without notice. Review the room information on the partner site and use its privacy, blocking and reporting controls as appropriate."
    ],
    faqs: [
      ["Are rooms streamed on NightCamFinds?", "No. NightCamFinds lists public room information and links to the partner platform."],
      ["Does an Austria label verify a broadcaster's location?", "No. The label is based on partner-feed data and is not independently checked."],
      ["Who handles accounts and payments?", "The partner platform handles accounts and payments under its own terms."]
    ]
  },
  be: {
    code: "BE", name: "Belgium", adjective: "Belgian", region: "Belgium", language: "nl-BE",
    intro: "Browse public live rooms associated with Belgium in the NightCamFinds country directory. The page brings together partner-feed listings so adult visitors can compare categories, available descriptions and viewer activity before continuing to an external platform. Belgium has multiple official languages, so country information should not be mistaken for a language preference.",
    paragraphs: [
      "Explore female, male, trans and couples rooms using the category links. A Belgium label comes from country information supplied by a partner feed. It is not independent verification of a broadcaster's residence, nationality or identity. Language details, if supplied, are separate from country labels.",
      "NightCamFinds is an independent directory and does not host streams or process partner-platform payments. Room links lead to the platform responsible for video, accounts and moderation. Review its age requirements, privacy policy, community rules and pricing before registering or using optional paid features.",
      "Listings may change throughout the day and viewer activity can differ with broadcaster schedules. Whether you are browsing from Brussels, Antwerp, Ghent or elsewhere, treat viewer counts as temporary feed data rather than a promise that a room will stay online. Read the room details on the partner platform and use its own privacy and reporting controls."
    ],
    faqs: [
      ["Does NightCamFinds provide the video?", "No. Video and account services are provided by the external partner platform."],
      ["Does a Belgium label confirm someone's language?", "No. Country and language are separate fields, and language information may be unavailable."],
      ["Are listings guaranteed to remain live?", "No. Partner feeds update frequently and room availability can change at any time."]
    ]
  },
  jp: {
    code: "JP", name: "Japan", adjective: "Japanese", region: "Japan", language: "ja-JP",
    intro: "Discover public live rooms associated with Japan through the NightCamFinds country directory. Compare available room categories, descriptions and current viewer activity before continuing to an external partner platform. Listings come from partner feeds and can change throughout the day, so the information displayed is a snapshot rather than a promise that a room will remain live.",
    paragraphs: [
      "Use the category links to browse female, male, trans and couples rooms. A Japan label reflects country information supplied by a partner feed. It is not independent verification of a broadcaster's residence, nationality or identity, and some feeds may omit country details.",
      "NightCamFinds is an independent discovery directory, not a streaming, account or payment provider. Selecting a room takes you to the partner platform that operates it. Check the platform's age requirements, privacy policy, community rules and pricing before registering or using paid features.",
      "Room activity may vary by time of day and broadcaster schedule, including for visitors in Tokyo, Osaka and other parts of Japan. Viewer counts can change quickly and should not be treated as a ranking or guarantee. Read the room description on the partner platform and use its own privacy, blocking and reporting tools if you choose to interact."
    ],
    faqs: [
      ["Does NightCamFinds host Japanese live streams?", "No. It lists public room information and links to external partner platforms."],
      ["Does a Japan label prove a broadcaster's nationality?", "No. It is based on partner-feed country information and is not independently verified."],
      ["Can I use paid features through NightCamFinds?", "No. Any paid features belong to the partner platform and are subject to its terms."]
    ]
  },
  sg: {
    code: "SG", name: "Singapore", adjective: "Singaporean", region: "Singapore", language: "en-SG",
    intro: "Explore public live rooms associated with Singapore in the NightCamFinds country directory. The page helps adult visitors compare room categories, descriptions and current viewer activity supplied by partner feeds before choosing an external platform. Live listings can change quickly, and a room marked live may be unavailable when you follow its link.",
    paragraphs: [
      "Browse female, male, trans and couples rooms using the category links. A Singapore label is based on country information supplied by a partner feed. It is not independent proof of a broadcaster's residence, nationality or identity, and some listings may not include country data.",
      "NightCamFinds is an independent directory. It does not host video, operate partner accounts or process payments for partner services. Selecting a room takes you to the external platform, where its age requirements, privacy policy, community standards and pricing apply. Review those terms before registering or making a purchase.",
      "Room activity changes with broadcaster schedules and time zones across the region. Viewer counts are temporary feed values rather than guarantees of availability or quality. Read the room information on the partner platform and use its own privacy, blocking and reporting controls if you decide to interact."
    ],
    faqs: [
      ["Does NightCamFinds stream the rooms?", "No. The directory links to public listings hosted by external partner platforms."],
      ["Does a Singapore label verify someone's location?", "No. Country information comes from partner feeds and is not independently checked."],
      ["Are paid partner features included?", "No. Browsing this directory is free, while partner platforms set their own prices and terms."]
    ]
  },
};

// NIGHTCAMFINDS_WORLDWIDE_MARKETS_V1
const worldwideMarkets = require("./src/config/market-countries.cjs");
Object.assign(COUNTRIES, worldwideMarkets.COUNTRIES);
for (const [slug, country] of Object.entries(COUNTRIES)) {
  const metadata = worldwideMarkets.MARKET_META[slug];
  if (metadata) Object.assign(country, metadata);
  const seo = worldwideMarkets.TIER1_SEO[slug];
  if (seo) Object.assign(country, seo);
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function getCountryPage(slug, origin = "https://nightcamfinds.com", roomMarkup = "", hasRooms = false) {
  const country = COUNTRIES[String(slug || "").toLowerCase()];
  if (!country) return null;
  const canonical = `${origin.replace(/\/$/, "")}/country/${String(slug).toLowerCase()}/`;
  const title = country.seoTitle || `${country.name} Live Cams | NightCamFinds`;
  const description = country.metaDescription || `Browse public live rooms associated with ${country.name}. Compare categories and current activity on NightCamFinds.`;
  const paragraphs = [country.intro, ...country.paragraphs];
  const links = [
    ["Female live rooms", "/female/"], ["Male live rooms", "/male/"],
    ["Trans live rooms", "/trans/"], ["Couples live rooms", "/couples/"],
    ["All live rooms", "/live/"], ["Browse countries", "/countries/"], ...(country.regionGroup ? [[`More ${country.regionGroup} markets`, `/#markets-${country.regionGroup.toLowerCase().replace(/[^a-z]+/g, "-")}`]] : [])
  ];
  const faqHtml = country.faqs.map(([question, answer]) =>
    `<section class="country-faq-item"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></section>`
  ).join("");
  const faqStructuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": country.faqs.map(([question, answer]) => ({
      "@type": "Question",
      "name": question,
      "acceptedAnswer": { "@type": "Answer", "text": answer }
    }))
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${country.language || (country.code === "DE" ? "de" : country.code === "FR" ? "fr" : country.code === "NL" ? "nl" : "en")}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${hasRooms ? "index,follow" : "noindex,follow"}"><link rel="canonical" href="${escapeHtml(canonical)}">
<script type="application/ld+json">${faqStructuredData}</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script>
try { if (localStorage.getItem("ncf18") === "1") document.documentElement.classList.add("ok"); else document.documentElement.classList.add("age-pending"); }
catch (_) { document.documentElement.classList.add("age-pending"); }
</script>
</head>
<body>
<div class="age-gate" id="gate"><div class="panel">
<p class="eyebrow">Adults only</p><h2>This site is for people 18 or older.</h2>
<p class="muted">NightCamFinds is an independent directory. It does not host video. You must be 18 or the age of majority where you live.</p>
<div class="actions"><button id="enter" type="button">I am 18 or older</button><a class="btn ghost" href="https://www.google.com">Leave</a></div>
</div></div>
<main class="wrap legal country-landing">
<nav aria-label="Breadcrumb"><ol class="breadcrumbs"><li><a href="/">Home</a></li><li aria-current="page">${escapeHtml(country.name)}</li></ol></nav>
<header class="country-intro"><p class="eyebrow">NightCamFinds country directory</p><h1>${escapeHtml(country.name)} Live Cams</h1>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</header>
<section class="country-live-rooms" aria-labelledby="country-live-heading"><h2 id="country-live-heading">Live rooms associated with ${escapeHtml(country.name)}</h2><div class="grid">${roomMarkup || '<p class="empty-state">No live rooms are available in this directory right now. Please check again soon.</p>'}</div></section>
<section aria-labelledby="country-categories"><h2 id="country-categories">Explore room categories</h2>
<ul class="country-links">${links.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul></section>
<section aria-labelledby="country-faq"><h2 id="country-faq">Frequently asked questions</h2>${faqHtml}</section>
<p class="country-disclosure">NightCamFinds is an independent directory. Room listings and country information are supplied by partner feeds and may be incomplete or out of date. Some links are affiliate links.</p>
<p><a class="btn" href="/live/">Browse live rooms</a></p>
</main>
<script src="/visit-tracking.js"></script>
<script>
(() => {
  const countrySlug = "${country.code.toLowerCase()}";
  const visitId = window.NCFVisitTracking ? window.NCFVisitTracking.getVisitId() : "";
  if (!visitId) return;
  const landingPath = window.NCFVisitTracking ? window.NCFVisitTracking.getLandingPath(location.pathname) : location.pathname;
  const incoming = new URLSearchParams(location.search);
  let referral = "";
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.hostname !== location.hostname) referral = referrer.hostname.toLowerCase().replace(/^www\./, "").slice(0, 40);
  } catch (_) {}
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("ncf_attribution") || "{}"); } catch (_) {}
  const fresh = Number(saved.savedAt || 0) > Date.now() - 30 * 24 * 60 * 60 * 1000;
  const explicitSource = incoming.get("utm_source") || incoming.get("source") || "";
  const attribution = {
    source: explicitSource || referral || (fresh ? saved.source : "") || "unknown",
    sourceEvidence: explicitSource ? "url_parameter" : referral ? "browser_referrer" : fresh ? "stored_attribution" : "unknown",
    medium: incoming.get("utm_medium") || incoming.get("medium") || (referral ? "referral" : fresh ? saved.medium : "unknown"),
    campaign: incoming.get("utm_campaign") || incoming.get("campaign") || (referral ? "referral" : fresh ? saved.campaign : "unknown"),
    content: incoming.get("utm_content") || incoming.get("content") || (fresh ? saved.content : "") || ""
  };
  if (explicitSource || referral) {
    try { localStorage.setItem("ncf_attribution", JSON.stringify({ ...attribution, landingPath: location.pathname, savedAt: Date.now() })); } catch (_) {}
  }
  const placement = "country-" + countrySlug;
  const trackParams = new URLSearchParams({
    src: placement, cat: "all", source: attribution.source, medium: attribution.medium,
    campaign: attribution.campaign, content: attribution.content, placement,
    lp: landingPath.slice(0, 255), vid: visitId
  });
  document.querySelectorAll('a[href^="/go/"],a[href^="/bgo/"]').forEach((link) => {
    try {
      const target = new URL(link.href, location.origin);
      for (const [key, value] of trackParams) target.searchParams.set(key, value);
      link.href = target.pathname + target.search;
    } catch (_) {}
  });
  const sendEngagement = (eventType) => fetch("/api/engage", {
    method: "POST", credentials: "same-origin", keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitId, eventType, pagePath: location.pathname, landingPath,
      platform: "directory", source: attribution.source, medium: attribution.medium,
      campaign: attribution.campaign, content: attribution.content, placement
    })
  }).catch(() => {});
  let activeTimer;
  const scheduleActive = () => {
    clearTimeout(activeTimer);
    if (!document.hidden) activeTimer = setTimeout(() => sendEngagement("active_10s"), 10000);
  };
  document.addEventListener("visibilitychange", scheduleActive);
  scheduleActive();
  let scrolled = false;
  window.addEventListener("scroll", () => {
    if (scrolled) return;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    if (height > 0 && window.scrollY / height >= 0.5) {
      scrolled = true;
      sendEngagement("scroll_50");
    }
  }, { passive: true });
})();
</script>
<script>
const gate = document.getElementById("gate");
document.getElementById("enter")?.addEventListener("click", () => {
  try { localStorage.setItem("ncf18", "1"); } catch (_) {}
  document.documentElement.classList.add("ok");
  document.documentElement.classList.remove("age-pending");
  if (gate) gate.hidden = true;
});
</script>
</body></html>`;
}

module.exports = { COUNTRIES, getCountryPage };
