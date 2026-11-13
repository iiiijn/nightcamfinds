"use strict";

function coalesceInFlight(inFlight, key, request) {
  if (!(inFlight instanceof Map)) throw new TypeError("inFlight must be a Map.");
  if (typeof request !== "function") throw new TypeError("request must be a function.");
  if (inFlight.has(key)) return inFlight.get(key);

  const pending = Promise.resolve().then(request);
  inFlight.set(key, pending);
  const cleanup = () => {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  };
  pending.then(cleanup, cleanup);
  return pending;
}

module.exports = { coalesceInFlight };
