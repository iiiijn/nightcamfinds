function rankRoomsByPreferredPlatform(rooms, preferredPlatform, sort = "recommended") {
  const list = Array.isArray(rooms) ? rooms.slice() : [];
  const preferred = ["chaturbate", "bongacams"].includes(String(preferredPlatform || "").toLowerCase())
    ? String(preferredPlatform).toLowerCase()
    : null;
  list.sort((a, b) => {
    if (sort === "recommended" && preferred) {
      const rank = Number(b.platform === preferred) - Number(a.platform === preferred);
      if (rank) return rank;
    }
    return sort === "newest"
      ? Number(b.isNew) - Number(a.isNew) || Number(b.viewerCount || 0) - Number(a.viewerCount || 0)
      : Number(b.viewerCount || 0) - Number(a.viewerCount || 0);
  });
  return list;
}

module.exports = { rankRoomsByPreferredPlatform };
