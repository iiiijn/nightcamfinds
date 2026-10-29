import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverSource = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");

test("country preference is consulted only for recommended room sorting", () => {
  assert.match(serverSource, /const preferredPlatform\s*=\s*sort\s*===\s*"recommended"\s*\?\s*await approvedCountryPlatformPreference\(visitorCountry\(req\)\)\s*:\s*null/);
  assert.match(serverSource, /list\s*=\s*rankRoomsByPreferredPlatform\(list,\s*preferredPlatform,\s*sort\)/);
});

test("explicit platform filters remain available for both partner platforms", () => {
  assert.match(serverSource, /\["chaturbate",\s*"bongacams"\]\.includes\(platform\)/);
  assert.match(serverSource, /list\s*=\s*list\.filter\(r\s*=>\s*r\.platform\s*===\s*platform\)/);
  assert.match(serverSource, /platforms\s*=\s*\[\.\.\.new Set\(feed\.rooms\.map\(r\s*=>\s*r\.platform\)/);
});

test("Chaturbate and BongaCams use distinct tracked redirect paths", () => {
  assert.ok(serverSource.includes('pathname.startsWith("/bgo/")') && serverSource.includes('pathname.startsWith("/go/")'));
  assert.ok(serverSource.includes('isBonga?"bongacams":"chaturbate"') || serverSource.includes('isBonga ? "bongacams" : "chaturbate"'));
  assert.ok(serverSource.includes("chaturbate.com/in/"));
  assert.ok(serverSource.includes("bongacams4.com/track") || serverSource.includes("bongacams.com/"));
  assert.ok(serverSource.includes('searchParams.set("click_id",clickId)') || serverSource.includes('searchParams.set("click_id", clickId)'));
  assert.ok(serverSource.includes('searchParams.set("track",src)') || serverSource.includes('searchParams.set("track", src)'));
});

test("affiliate destinations keep separate campaign and tracking parameters", () => {
  assert.ok(serverSource.includes("BONGA_CAMPAIGN"));
  assert.ok(serverSource.includes("click_id"));
  assert.ok(serverSource.includes("tour=") && serverSource.includes("CAMPAIGN"));
  assert.ok(serverSource.includes("withTrack(room.href,src)") || serverSource.includes("withTrack(room.href, src)"));
  assert.ok(serverSource.includes('searchParams.set("source",source)') || serverSource.includes('searchParams.set("source", source)'));
  assert.ok(serverSource.includes('searchParams.set("campaign",campaign)') || serverSource.includes('searchParams.set("campaign", campaign)'));
});
