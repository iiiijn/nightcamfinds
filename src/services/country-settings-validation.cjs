const COUNTRIES = new Set(["US", "GB", "CA", "AU", "DE", "FR", "NL"]);
const PLATFORMS = new Set(["chaturbate", "bongacams"]);
const ACTIONS = new Set(["save_hypothesis", "approve"]);

function validateCountryPlatformPayload(payload) {
  const input = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const country = String(input.country || "").trim().toUpperCase();
  const platform = String(input.preferredPlatform || "").trim().toLowerCase();
  const action = String(input.action || "save_hypothesis");
  const hypothesis = String(input.hypothesis || "").trim().slice(0, 1200);

  if (!COUNTRIES.has(country)) return { error: "Unsupported country." };
  if (!PLATFORMS.has(platform)) return { error: "Choose a supported platform." };
  if (!hypothesis) return { error: "Add a clearly labelled hypothesis before saving." };
  if (!ACTIONS.has(action)) return { error: "Unsupported settings action." };
  if (action === "approve" && input.confirmApproval !== true) {
    return { error: "Explicit approval confirmation is required." };
  }

  return { value: { country, platform, action, hypothesis, status: action === "approve" ? "approved" : "hypothesis" } };
}

module.exports = { validateCountryPlatformPayload };
