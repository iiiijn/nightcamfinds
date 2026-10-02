import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT = {
  settings: {
    maintenance: false,
    redirectsEnabled: true,
    promotionsEnabled: true,
    postbacksEnabled: true,
    providers: {
      chaturbate: true,
      bongacash: false
    },
    recommendationVersion: "rules-v1",
    staleMs: 10 * 60 * 1000,
    expireMs: 30 * 60 * 1000
  },
  countries: [
    { iso: "US", name: "United States", enabled: true, priority: 10, language: "en", indexable: false },
    { iso: "GB", name: "United Kingdom", enabled: true, priority: 20, language: "en", indexable: false },
    { iso: "DE", name: "Germany", enabled: true, priority: 30, language: "de", indexable: false },
    { iso: "FR", name: "France", enabled: true, priority: 40, language: "fr", indexable: false },
    { iso: "BR", name: "Brazil", enabled: true, priority: 50, language: "pt", indexable: false },
    { iso: "CO", name: "Colombia", enabled: true, priority: 60, language: "es", indexable: false }
  ],
  links: [
    {
      id: "cb-revshare-room",
      provider: "chaturbate",
      campaign: "C6yxN",
      program: "REQUIRES_CONFIRMATION",
      destinationType: "room",
      affiliateDomain: "chaturbate.com",
      status: "Unverified",
      verificationStatus: "REQUIRES_VERIFICATION",
      notes: "Prefer chat_room_url_revshare from API v2 when present. Program selection must be confirmed in the affiliate account."
    },
    {
      id: "bc-direct",
      provider: "bongacash",
      campaign: "840970",
      program: "RevShare",
      destinationType: "room",
      affiliateDomain: null,
      status: "Unverified",
      verificationStatus: "REQUIRES_VERIFICATION",
      notes: "No verified destination URL template. Redirects stay disabled until a documented URL is configured."
    }
  ],
  promotions: [
    { id: "api", provider: "bongacash", tool: "API", enabled: true },
    { id: "dynamic-banner", provider: "bongacash", tool: "Dynamic Banner", enabled: true },
    { id: "geo-banner", provider: "bongacash", tool: "Geo Banner", enabled: true },
    { id: "direct-links", provider: "bongacash", tool: "Direct Links", enabled: true },
    { id: "category-widget", provider: "bongacash", tool: "Category Widget", enabled: true },
    { id: "popunder", provider: "bongacash", tool: "Popunder", enabled: false },
    { id: "postitial", provider: "bongacash", tool: "Postitial", enabled: false },
    { id: "sticky", provider: "bongacash", tool: "Sticky", enabled: false },
    { id: "video-slider", provider: "bongacash", tool: "Video Slider", enabled: false },
    { id: "out-stream", provider: "bongacash", tool: "Out-stream", enabled: false },
    { id: "vast", provider: "bongacash", tool: "VAST", enabled: false }
  ],
  rooms: [],
  clicks: [],
  events: [],
  postbacks: [],
  conversions: [],
  audit: [],
  health: {},
  sessions: {}
};

export function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "store.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(DEFAULT, null, 2));
  }
  const read = () => JSON.parse(fs.readFileSync(file, "utf8"));
  const write = (data) => {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };
  return {
    file,
    read,
    update(mutator) {
      const data = read();
      mutator(data);
      write(data);
      return data;
    },
    id() {
      return crypto.randomBytes(12).toString("hex");
    }
  };
}
