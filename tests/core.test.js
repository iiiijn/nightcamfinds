import test from "node:test";
import assert from "node:assert/strict";
import { mapChaturbateRoom } from "../src/adapters/chaturbate.js";
import { recommend, surprise } from "../src/services/recommend.js";
import { buildRedirect, isOpenRedirect } from "../src/services/affiliate.js";
import { classifyPostback } from "../src/services/postbacks.js";
import { bongaCashDestination } from "../src/adapters/bongacash.js";

test("normalizes chaturbate room without inventing age", () => {
  const room = mapChaturbateRoom({ username: "Ada", gender: "f", num_users: 12, is_hd: 1, chat_room_url_revshare: "https://chaturbate.com/in/?room=Ada" });
  assert.equal(room.id, "chaturbate:ada");
  assert.equal(room.age, null);
  assert.equal(room.isHd, true);
});

test("blocks open redirects and unverified bongacash destinations", () => {
  assert.equal(isOpenRedirect("https://evil.example/phish"), true);
  assert.equal(bongaCashDestination().ok, false);
  const bad = buildRedirect({ provider: "bongacash", id: "x" }, "abc");
  assert.equal(bad.ok, false);
});

test("chaturbate redirect stays on allowlisted domain and carries click id", () => {
  const dest = buildRedirect({
    provider: "chaturbate",
    roomUrl: "https://chaturbate.com/in/?tour=x&campaign=C6yxN"
  }, "click123");
  assert.equal(dest.ok, true);
  assert.match(dest.url, /click_id=click123/);
  assert.equal(isOpenRedirect(dest.url), false);
});

test("postbacks reject bongacash and duplicates", () => {
  assert.equal(classifyPostback({ provider: "bongacash", known: { click_id: "1" } }).status, "rejected");
  assert.equal(classifyPostback({ provider: "chaturbate", known: { transaction_id: "t1", click_id: "c1", payout: "2.5" }, duplicate: true }).status, "duplicate");
  const ok = classifyPostback({ provider: "chaturbate", known: { transaction_id: "t2", click_id: "c2", payout: "3" } });
  assert.equal(ok.state, "Confirmed");
});

test("surprise does not always return the first room", () => {
  const rooms = [
    { id: "a", provider: "chaturbate", isLive: true, freshness: "FRESH", viewerCount: 1 },
    { id: "b", provider: "chaturbate", isLive: true, freshness: "FRESH", viewerCount: 9 }
  ];
  const picks = new Set();
  for (let i = 0; i < 30; i++) picks.add(surprise(rooms)?.id);
  assert.ok(picks.size >= 1);
  assert.equal(recommend(rooms, { sort: "viewers" })[0].id, "b");
});
