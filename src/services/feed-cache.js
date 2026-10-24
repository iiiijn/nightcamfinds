const memory = new Map();

function key(provider) {
  return `rooms:${String(provider).toLowerCase()}`;
}

async function getRooms({ provider, fetcher, ttlMs = 60000, staleMs = 15 * 60000, now = Date.now() }) {
  const k = key(provider);
  const existing = memory.get(k);

  if (existing && now < existing.expiresAt) {
    return { rooms: existing.rooms, stale: false, fetchedAt: existing.fetchedAt };
  }

  try {
    const rooms = await fetcher();
    const entry = {
      rooms: Array.isArray(rooms) ? rooms : [],
      fetchedAt: now,
      expiresAt: now + ttlMs
    };
    memory.set(k, entry);
    return { rooms: entry.rooms, stale: false, fetchedAt: entry.fetchedAt };
  } catch (error) {
    if (existing && now - existing.fetchedAt <= staleMs) {
      return {
        rooms: existing.rooms,
        stale: true,
        fetchedAt: existing.fetchedAt,
        error: error.message
      };
    }
    throw error;
  }
}

function clear(provider) {
  if (provider) memory.delete(key(provider));
  else memory.clear();
}

module.exports = { getRooms, clear };
