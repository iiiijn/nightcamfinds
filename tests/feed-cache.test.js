const test = require("node:test");
const assert = require("node:assert/strict");
const { FeedCache } = require("../providers/feed-cache");

test("returns fresh cached data within the TTL", async () => {
  const cache = new FeedCache({ ttlMs: 1000, staleMs: 5000 });
  let calls = 0;
  const loader = async () => { calls += 1; return [{ id: calls }]; };

  const first = await cache.get("US", loader);
  const second = await cache.get("US", loader);

  assert.equal(first.rooms[0].id, 1);
  assert.equal(second.rooms[0].id, 1);
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
});

test("serves the last good feed during a short provider failure", async () => {
  const cache = new FeedCache({ ttlMs: 0, staleMs: 5000 });
  let fail = false;
  const loader = async () => {
    if (fail) throw new Error("provider offline");
    return [{ id: "last-good" }];
  };

  await cache.get("GB", loader);
  fail = true;
  const fallback = await cache.get("GB", loader);

  assert.deepEqual(fallback.rooms, [{ id: "last-good" }]);
  assert.equal(fallback.stale, true);
  assert.match(fallback.error, /provider offline/);
});
