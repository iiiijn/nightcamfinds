const fs = require("fs");

const path = "server.js";
const marker = "NIGHTCAMFINDS_PROMO_TOURS_V1";
let s = fs.readFileSync(path, "utf8");
if (s.includes(marker)) process.exit(0);

const helper = `
// ${marker}
const CB_PROMO_TOURS = {
  home: process.env.CB_TOUR_HOME || "grqQ",
  female: process.env.CB_TOUR_FEMALE || "uhEc",
  male: process.env.CB_TOUR_MALE || "EyCi",
  trans: process.env.CB_TOUR_TRANS || "2MTk",
  couples: process.env.CB_TOUR_COUPLES || "43Qk",
  hd: process.env.CB_TOUR_HD || process.env.CB_TOUR_HOME || "grqQ"
};
function promoTour(category, placement = "") {
  const c = String(category || "").toLowerCase();
  if (c === "female" || /female/.test(placement)) return CB_PROMO_TOURS.female;
  if (c === "male" || /male/.test(placement)) return CB_PROMO_TOURS.male;
  if (c === "trans" || /trans/.test(placement)) return CB_PROMO_TOURS.trans;
  if (c === "couples" || /couple/.test(placement)) return CB_PROMO_TOURS.couples;
  if (c === "hd") return CB_PROMO_TOURS.hd;
  return CB_PROMO_TOURS.home;
}
`;

const anchor = 'const CONTACT = process.env.CONTACT_EMAIL || "bunnybelle188@gmail.com";';
if (!s.includes(anchor)) throw new Error("server.js promo anchor not found");
s = s.replace(anchor, anchor + helper);

const old = 'const fallback = `https://chaturbate.com/in/?tour=${encodeURIComponent(TOUR)}&campaign=${encodeURIComponent(CAMPAIGN)}&track=${encodeURIComponent(track)}`;';
const replacement = 'const fallback = `https://chaturbate.com/in/?tour=${encodeURIComponent(promoTour(category, track))}&campaign=${encodeURIComponent(CAMPAIGN)}&track=${encodeURIComponent(track)}`;';
if (!s.includes(old)) throw new Error("server.js Chaturbate fallback anchor not found");
s = s.replace(old, replacement);

const envTour = 'CB_TOUR= LQps';
// No-op placeholder kept out of runtime. Tour overrides are optional env vars in production.
fs.writeFileSync(path, s);
console.log("NightCamFinds category-aware promo tours patch applied");
