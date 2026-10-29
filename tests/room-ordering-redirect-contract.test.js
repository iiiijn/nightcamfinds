import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverSource = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");

test("country preference is consulted only for recommended room sorting", () => {
  assert.match(
    serverSource,
    /const preferredPlatform\s*=\s*sort\s*===\s*"recommended"\s*\?\s*await approvedCountryPlatformPreference\(visitorCountry\(req\)\)\s*:\s*null/
  );
  assert.match(serverSource, /list\s*=\s*rankRoomsByPreferredPlatform\(list,\s*preferredPlatform,\s*sort\)/);
});

test("explicit platform filters remain available for both partner platforms", () => {
  assert.match(serverSource, /\["chaturbate",\s*"bongacams"\]\.includes\(platform\)/);
  assert.match(serverSource, /list\s*=\s*list\.filter\(r\s*=>\s*r\.platform\s*===\s*platform\)/);
  assert.match(serverSource, /platforms\s*=\s*\[\.\.\.new Set\(feed\.rooms\.map\(r\s*=>\s*r\.platform\)/);
});

test("Chaturbate and BongaCams use distinct tracked redirect paths", () => {
  assert.match(serverSource, /pathname\.startsWith\("\/bgo\/"\)\s*\|\|\s*pathname\.startsWith\("\/go\/"\)/);
  assert.match(serverSource, /const platform\s*=\s*isBonga\s*\?\s*"bongacams"\s*:\s*"chaturbate"/);
  assert.match(serverSource, /https:\/\/chaturbate\.com\/in\//);
  assert.match(serverSource, /https:\/\/bongacams\.com\//);
  assert.match(serverSource, /searchParams\.set\("click_id",\s*clickId\)/);
  assert.match(serverSource, /searchParams\.set\("ncf_click_id",\s*clickId\)/);
  assert.match(serverSource, /searchParams\.set\("track",\s*src\)/);
});

test("BongaCams attribution and Chaturbate affiliate parameters remain platform-specific", () => {
  assert.match(serverSource, /BONGA_BCS\)\)\s*target\.searchParams\.set\("bcs",\s*BONGA_BCS\)/);
  assert.match(serverSource, /target\.searchParams\.set\("ncf_source",\s*source\)/);
  assert.match(serverSource, /target\.searchParams\.set\("ncf_campaign",\s*campaign\)/);
  assert.match(serverSource, /target\.searchParams\.set\("ncf_placement",\s*src\)/);
  assert.match(serverSource, /tour=\$\{encodeURIComponent\(TOUR\)\}&campaign=\$\{encodeURIComponent\(CAMPAIGN\)\}&track=/);
  assert.match(serverSource, /withTrack\(room\.href,\s*src\)/);
});
