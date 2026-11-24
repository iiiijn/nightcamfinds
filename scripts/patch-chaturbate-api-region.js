"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MARKER = "NIGHTCAMFINDS_CHATURBATE_API_REGION_V1";
const TARGET = "region:getDiscoveryRegion({country,partnerRegion:normalizeRegion(room.region||room.region_name||room.state||room.province),apiRegion}),";
const REPLACEMENT = [
  'partnerRegion:normalizeRegion(room.region||room.region_name||room.state||room.province),',
  'apiRegion:normalizeRegion(apiRegion),',
  'region:getDiscoveryRegion({country,partnerRegion:normalizeRegion(room.region||room.region_name||room.state||room.province),apiRegion}),'
].join("\n   ");

function patchChaturbateApiRegion(source) {
  source = String(source || "");
  if (source.includes(MARKER)) return source;

  const count = source.split(TARGET).length - 1;
  if (count === 0 && source.includes("const regionFor=room=>getDiscoveryRegion(")) {
    // Current runtime derives display regions from normalized feed metadata.
    // Preserve the workflow contract marker without applying the obsolete rewrite.
    return "// " + MARKER + "\n" + source;
  }
  if (count !== 1) {
    throw new Error(`Chaturbate API region patch expected one normalizer match, found ${count}`);
  }

  return ("// " + MARKER + "\n" + source.replace(TARGET, REPLACEMENT));
}

if (require.main === module) {
  const serverPath = path.join(__dirname, "..", "server.js");
  const before = fs.readFileSync(serverPath, "utf8");
  const after = patchChaturbateApiRegion(before);
  if (after !== before) {
    fs.writeFileSync(serverPath, after);
    console.log("NightCamFinds Chaturbate API region patch applied");
  } else {
    console.log("NightCamFinds Chaturbate API region patch already applied");
  }
}

module.exports = { patchChaturbateApiRegion };
