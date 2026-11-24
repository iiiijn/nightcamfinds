const WEIGHTS = {
  hd: 2,
  fresh: 2,
  viewers: 3,
  newness: 1.5
};

export function scoreRoom(room) {
  const viewers = Math.min(room.viewerCount || 0, 5000) / 5000;
  return (
    (room.isHd ? WEIGHTS.hd : 0) +
    (room.freshness === "FRESH" ? WEIGHTS.fresh : 0) +
    viewers * WEIGHTS.viewers +
    (room.isNew ? WEIGHTS.newness : 0)
  );
}

export function recommend(rooms, { sort = "recommended", limit = 48, category } = {}) {
  let list = rooms.filter((r) => r.isLive && r.freshness !== "EXPIRED");
  if (category && category !== "all" && category !== "live" && category !== "popular") {
    if (category === "hd") list = list.filter((r) => r.isHd);
    else if (category === "new") list = list.filter((r) => r.isNew);
    else list = list.filter((r) => r.gender === category);
  }
  if (sort === "viewers" || category === "popular") {
    list.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
  } else if (sort === "newest") {
    list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  } else {
    list.sort((a, b) => scoreRoom(b) - scoreRoom(a));
  }
  return diversify(list).slice(0, limit);
}

function diversify(list) {
  const out = [];
  const seenProviderRun = { provider: null, run: 0 };
  const deferred = [];
  for (const room of list) {
    if (seenProviderRun.provider === room.provider && seenProviderRun.run >= 4 && deferred.length < list.length) {
      deferred.push(room);
      continue;
    }
    out.push(room);
    if (seenProviderRun.provider === room.provider) seenProviderRun.run += 1;
    else {
      seenProviderRun.provider = room.provider;
      seenProviderRun.run = 1;
    }
  }
  return out.concat(deferred);
}

export function surprise(rooms, recent = []) {
  const eligible = rooms.filter((r) => r.isLive && r.freshness === "FRESH" && !recent.includes(r.id));
  const pool = eligible.length ? eligible : rooms.filter((r) => r.isLive && r.freshness !== "EXPIRED");
  if (!pool.length) return null;
  const weighted = pool.map((r) => ({ r, w: Math.max(scoreRoom(r), 0.2) }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let pick = Math.random() * total;
  for (const item of weighted) {
    pick -= item.w;
    if (pick <= 0) return item.r;
  }
  return weighted[weighted.length - 1].r;
}
