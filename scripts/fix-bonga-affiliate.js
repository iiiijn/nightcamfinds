const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");

if (source.includes("NIGHTCAMFINDS_BONGA_BCS_V1")) {
  console.log("Bonga affiliate patch already applied");
  process.exit(0);
}

const marker = 'const BONGA_LIMIT = Math.max(10, Math.min(500, Number(process.env.BONGACAMS_LIMIT || 100)));';
if (!source.includes(marker)) throw new Error("Bonga configuration marker not found in server.js");

source = source.replace(
  marker,
  `${marker}\nconst BONGA_BCS = String(process.env.BONGACAMS_BCS || "").trim(); // NIGHTCAMFINDS_BONGA_BCS_V1`
);

const routePattern = /if\(pathname\.startsWith\("\/bgo\/"\)\|\|pathname\.startsWith\("\/go\/"\)\)\{[\s\S]*?res\.end\(\);\}/;
if (!routePattern.test(source)) throw new Error("Affiliate redirect route not found in server.js");

const replacement = `if(pathname.startsWith("/bgo/")||pathname.startsWith("/go/")){const isBonga=pathname.startsWith("/bgo/");const id=decodeURIComponent(pathname.slice(isBonga?5:4));const username=id.split(":").pop();const platform=isBonga?"bongacams":"chaturbate";const src=cleanLabel(url.searchParams.get("src"),isBonga?"bonga-card":"cb-card",80);const category=cleanLabel(url.searchParams.get("cat"),"unknown",40);const source=cleanLabel(url.searchParams.get("utm_source")||url.searchParams.get("source"),"direct",40);const medium=cleanLabel(url.searchParams.get("utm_medium")||url.searchParams.get("medium"),"unknown",80);const campaign=cleanLabel(url.searchParams.get("utm_campaign")||url.searchParams.get("campaign"),"unknown",80);const content=cleanLabel(url.searchParams.get("utm_content")||url.searchParams.get("content"),"",120);const country=visitorCountry(req);const agent=String(req.headers["user-agent"]||"").toLowerCase();const device=/mobile|android|iphone|ipad/.test(agent)?"mobile":"desktop";const clickId="ncf_"+Date.now().toString(36)+"_"+require("crypto").randomBytes(8).toString("hex");await countClick({src,country,category,source,campaign,medium,content,device,clickId,platform});const room=cache.rooms.find(r=>r.platform===platform&&r.username===username);let target;if(isBonga){const supplied=room?.href||"";try{const parsed=supplied?new URL(supplied):null;if(parsed&&/(^|\\.)bongacams4?\\.com$/i.test(parsed.hostname)){target=parsed;}}catch(_){}if(!target)target=new URL(\`https://bongacams.com/\${encodeURIComponent(username)}\`);if(BONGA_BCS)target.searchParams.set("bcs",BONGA_BCS);target.searchParams.set("ncf_click_id",clickId);target.searchParams.set("ncf_source",source);target.searchParams.set("ncf_campaign",campaign);target.searchParams.set("ncf_placement",src);}else{const fallback=\`https://chaturbate.com/in/?tour=\${encodeURIComponent(TOUR)}&campaign=\${encodeURIComponent(CAMPAIGN)}&track=\${encodeURIComponent(src)}&room=\${encodeURIComponent(username)}\`;target=room?.href?withTrack(room.href,src):fallback;try{const parsed=new URL(target);parsed.searchParams.set("click_id",clickId);parsed.searchParams.set("source",source);parsed.searchParams.set("campaign",campaign);parsed.searchParams.set("medium",medium);target=parsed.toString();}catch(_){target=fallback;}}res.writeHead(302,{Location:target.toString(),"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});return res.end();}\n  `;

source = source.replace(routePattern, replacement);
fs.writeFileSync(file, source);
console.log("Applied BongaCams affiliate BCS redirect patch");
