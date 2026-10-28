const TIER1 = new Set([
  "AN", "AT", "AU", "BE", "CA", "CH", "DE", "DK", "FI", "FK", "FO", "FR", "GB", "GG",
  "GI", "GL", "IE", "IS", "JE", "JP", "LI", "LU", "NL", "NO", "NZ", "QA", "SE", "SG",
  "SM", "UM", "US", "VI"
]);
const TIER2 = new Set([
  "AE", "AW", "BN", "BR", "BS", "CY", "ES", "GQ", "GR", "HK", "IL", "IM", "IT", "KR",
  "KW", "KY", "MO", "PF", "PR", "PT", "SI", "VG"
]);
const TIER3 = new Set([
  "AG", "AI", "BB", "BH", "CK", "CL", "CZ", "EE", "GU", "HR", "HU", "KN", "LB", "LT",
  "LV", "MX", "NC", "OM", "PL", "RU", "SA", "SC", "SK", "TR", "TT", "TW", "UY", "VE"
]);

const SUPPORTED_TYPES = new Set([
  "tokens_signup-referral",
  "tokens_broadcaster-referral",
  "ppr_signup-referral",
  "ppr_broadcaster-referral",
  "revshare_signup-referral",
  "revshare_broadcaster-referral",
  "revshare_purchase",
  "revshare_webmaster-commission",
  "revshare_payout-adjustment"
]);

function countryTier(country) {
  const code = String(country || "").trim().toUpperCase();
  if (TIER1.has(code)) return { tier: 1 };
  if (TIER2.has(code)) return { tier: 2 };
  if (TIER3.has(code)) return { tier: 3 };
  return { tier: null };
}

function clean(value, max = 255) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function finiteMoney(value) {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function normalizeChaturbatePostback(raw = {}) {
  const get = (...names) => {
    for (const name of names) {
      const value = raw[name];
      if (value != null && String(value).trim() !== "") return clean(value, 1024);
    }
    return "";
  };

  const type = get("type").toLowerCase();
  const clickId = get("click_id", "clickid", "subid", "sub_id", "sid");
  const transactionId = get("transaction_id", "transactionid", "txid", "tid");
  const payout = finiteMoney(get("payout"));
  const amount = finiteMoney(get("amount"));

  if (!SUPPORTED_TYPES.has(type)) return { ok: false, reason: "unsupported_event_type" };
  if (!clickId) return { ok: false, reason: "missing_click_id" };
  if (!transactionId) return { ok: false, reason: "missing_transaction_id" };
  if (payout == null) return { ok: false, reason: "missing_or_invalid_payout" };

  const country = get("country").toUpperCase();
  const currency = get("currency").toUpperCase();
  if (currency && !/^[A-Z]{3,8}$/.test(currency)) return { ok: false, reason: "invalid_currency" };

  return {
    ok: true,
    event: {
      clickId: clean(clickId, 128),
      transactionId: clean(transactionId, 255),
      type,
      payout,
      currency: currency || "USD",
      amount,
      country: /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN",
      track: get("track"),
      source: get("source"),
      campaignId: get("campaign_id"),
      programId: get("program_id"),
      programName: get("program_name"),
      userId: get("user_id"),
      timestamp: get("timestamp") || get("date"),
      device: get("device"),
      language: get("language"),
      region: get("region"),
      attempt: get("attempt")
    }
  };
}

function buildChaturbateUrl(options = {}) {
  const campaign = clean(options.campaign, 80);
  const tour = clean(options.tour, 80);
  const clickId = clean(options.clickId, 128);
  if (!campaign || !tour || !clickId) return { ok: false, reason: "missing_required_tracking_values" };

  let url;
  const roomUrl = clean(options.roomUrl, 2048);
  if (roomUrl) {
    try {
      const parsed = new URL(roomUrl);
      if (parsed.protocol !== "https:" || !/(^|\.)chaturbate\.com$/i.test(parsed.hostname)) {
        return { ok: false, reason: "room_url_not_allowlisted" };
      }
      url = parsed;
    } catch (_) {
      return { ok: false, reason: "invalid_room_url" };
    }
  } else {
    url = new URL("https://chaturbate.com/in/");
  }

  url.searchParams.set("tour", tour);
  url.searchParams.set("campaign", campaign);
  url.searchParams.set("track", clean(options.track || "nightcamfinds", 100));
  url.searchParams.set("click_id", clickId);
  url.searchParams.set("sid", clickId);
  if (options.source) url.searchParams.set("source", clean(options.source, 255));
  if (options.medium) url.searchParams.set("utm_medium", clean(options.medium, 80));
  if (options.utmCampaign) url.searchParams.set("utm_campaign", clean(options.utmCampaign, 80));
  return { ok: true, url: url.toString() };
}

exports.countryTier = countryTier;
exports.normalizeChaturbatePostback = normalizeChaturbatePostback;
exports.buildChaturbateUrl = buildChaturbateUrl;
