export const sanitizeTempPlaylist = (ids, validSet) => {
  if (!Array.isArray(ids)) return [];
  const next = [];
  const seen = new Set();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    if (validSet && !validSet.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
};
