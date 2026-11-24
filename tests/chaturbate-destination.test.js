import test from "node:test";
import assert from "node:assert/strict";
import { chaturbateDestination } from "../src/adapters/chaturbate.js";

test("Chaturbate clicks use the masterteja RevShare link", () => {
  const result = chaturbateDestination({ roomUrl: "https://chaturbate.com/in/?tour=wrong&campaign=wrong&room=wrong" }, "ncf_test_123");
  assert.equal(result.ok, true);
  const url = new URL(result.url);
  assert.equal(url.origin, "https://chaturbate.com");
  assert.equal(url.pathname, "/in/");
  assert.equal(url.searchParams.get("tour"), "LQps");
  assert.equal(url.searchParams.get("campaign"), "C6yxN");
  assert.equal(url.searchParams.get("track"), "default");
  assert.equal(url.searchParams.get("room"), "masterteja");
  assert.equal(url.searchParams.get("click_id"), "ncf_test_123");
});
