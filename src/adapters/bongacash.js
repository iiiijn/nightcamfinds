export const BONGACASH = {
  id: "bongacash",
  campaign: "840970",
  program: "RevShare",
  status: "CONFIGURED",
  apiStatus: "REQUIRES_VERIFICATION",
  ppsStatus: "REQUIRES_VERIFICATION",
  postbackStatus: "REQUIRES_VERIFICATION",
  notes: "Campaign and RevShare are configuration supplied by the operator. API base URL, response schema, destination URL, and postback parameters are not verified in this build. No rooms are fabricated."
};

export async function fetchBongaCashRooms(config) {
  if (!config.apiBase) {
    return {
      status: "REQUIRES_VERIFICATION",
      rooms: [],
      error: "BongaCash API base is not configured. No live rooms returned."
    };
  }
  return {
    status: "REQUIRES_VERIFICATION",
    rooms: [],
    error: "Endpoint is configured but response schema is unverified. Refusing to parse."
  };
}

export function bongaCashDestination() {
  return {
    ok: false,
    reason: "BongaCash affiliate destination REQUIRES_VERIFICATION"
  };
}
