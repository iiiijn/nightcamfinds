const KNOWN = [
  "click_id", "source", "track", "transaction_id", "campaign_id", "program_id",
  "program_name", "user_id", "type", "payout", "currency", "amount", "token",
  "timestamp", "date", "time", "country", "device", "language", "referral",
  "attempt", "region"
];
const SUPPORTED_TYPES = new Set(["signup", "purchase", "registration", "revshare", ""]);

export function parsePostback(query, body = {}) {
  const payload = { ...query, ...body };
  const known = {};
  for (const key of KNOWN) {
    if (payload[key] != null && payload[key] !== "") known[key] = String(payload[key]);
  }
  return { payload, known };
}

export function classifyPostback({ provider, known, token, expectedToken, duplicate, clickExists }) {
  if (provider === "bongacash") {
    return { status: "rejected", state: "Rejected", reason: "BongaCash postbacks REQUIRES_VERIFICATION" };
  }
  if (provider !== "chaturbate") {
    return { status: "rejected", state: "Rejected", reason: "unknown provider" };
  }
  if (expectedToken && token !== expectedToken) {
    return { status: "rejected", state: "Rejected", reason: "token mismatch" };
  }
  if (known.type && !SUPPORTED_TYPES.has(known.type.toLowerCase())) {
    return { status: "rejected", state: "Rejected", reason: "unsupported event type" };
  }
  if (!known.transaction_id && !known.click_id) {
    return { status: "rejected", state: "Rejected", reason: "missing transaction_id and click_id" };
  }
  if (duplicate) {
    return { status: "duplicate", state: "Adjusted", reason: "duplicate transaction" };
  }
  const amount = known.payout != null ? Number(known.payout) : known.amount != null ? Number(known.amount) : null;
  if (!known.click_id || clickExists === false) {
    return { status: "unmatched", state: "Unmatched", amount: Number.isFinite(amount) ? amount : null, reason: "unmatched click" };
  }
  return {
    status: "accepted",
    state: Number.isFinite(amount) ? "Confirmed" : "Estimated",
    amount: Number.isFinite(amount) ? amount : null,
    currency: known.currency || null
  };
}
