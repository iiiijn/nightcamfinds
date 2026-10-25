const fs = require("fs");
const path = "route.js";
let s = fs.readFileSync(path, "utf8");
const marker = "NIGHTCAMFINDS_CB_POSTBACK_PATCH_V6";
if (!s.includes(marker)) {
  // Chaturbate postback handling lives in start.js. route.js wraps the app and should not
  // create a second handler. This marker keeps startup idempotent and makes the route target explicit.
  s = s.replace('require("./start.js");', '/* ' + marker + ' */\nrequire("./start.js");');
  fs.writeFileSync(path, s);
  console.log("NightCamFinds Chaturbate postback route patch V6 applied");
}
