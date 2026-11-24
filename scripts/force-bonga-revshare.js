const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "server.js");
const marker = "NIGHTCAMFINDS_BONGA_REVSHARE_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log(`${marker} already applied`);
  process.exit(0);
}

const old = `if(isBonga){const supplied=room?.href||"";try{const parsed=supplied?new URL(supplied):null;if(parsed&&/(^|\\.)bongacams4?\\.com$/i.test(parsed.hostname)){parsed.searchParams.set("click_id",clickId);parsed.searchParams.set("source",source);parsed.searchParams.set("campaign",campaign);parsed.searchParams.set("track",src);target=parsed.toString();}}catch(_){}if(!target)target=\`https://bongacams4.com/track?c=\${encodeURIComponent(BONGA_CAMPAIGN)}&click_id=\${encodeURIComponent(clickId)}&track=\${encodeURIComponent(src)}\`;}else{`;

const replacement = `if(isBonga){target=\`https://bongacams4.com/track?v=2&c=\${encodeURIComponent(BONGA_CAMPAIGN)}&click_id=\${encodeURIComponent(clickId)}&source=\${encodeURIComponent(source)}&campaign=\${encodeURIComponent(campaign)}&track=\${encodeURIComponent(src)}\`;}else{`;

if (!source.includes(old)) {
  throw new Error("Bonga redirect anchor not found; refusing to modify server.js");
}

source = source.replace(old, `${replacement}\n// ${marker}`);
fs.writeFileSync(file, source);
console.log(`Applied ${marker} to server.js`);
