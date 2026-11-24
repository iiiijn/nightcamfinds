const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");

if (source.includes("NIGHTCAMFINDS_BONGA_BCS_V1")) {
  console.log("Bonga affiliate patch already applied");
  process.exit(0);
}

// The verified Direct Link builder supersedes the old feed-URL/BCS patch.
// It deliberately does not add undocumented BongaCash click-ID parameters.
if (source.includes('destination.searchParams.set("models[]", username)')) {
  console.log("Verified BongaCash Direct Link builder detected; legacy BCS patch skipped");
  process.exit(0);
}

const marker = 'const BONGA_LIMIT = Math.max(10, Math.min(500, Number(process.env.BONGACAMS_LIMIT || 100)));';
if (!source.includes(marker)) throw new Error("Bonga configuration marker not found in server.js");
if (!source.includes('buildChaturbateUrl({')) {
  throw new Error("Expected the current shared Chaturbate redirect builder before applying the Bonga patch");
}

source = source.replace(
  marker,
  marker + '\nconst BONGA_BCS = String(process.env.BONGACAMS_BCS || "").trim(); // NIGHTCAMFINDS_BONGA_BCS_V1'
);

const bongaClickIdLine = '          parsed.searchParams.set("click_id", clickId);';
if (!source.includes(bongaClickIdLine)) throw new Error("Allowlisted Bonga destination was not found");
source = source.replace(
  bongaClickIdLine,
  '          if (BONGA_BCS) parsed.searchParams.set("bcs", BONGA_BCS);\n' + bongaClickIdLine
);

fs.writeFileSync(file, source);
console.log("Applied optional Bonga BCS parameter without replacing the Chaturbate redirect builder");
